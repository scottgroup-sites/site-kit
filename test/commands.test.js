import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { runReview } from "../src/commands/review.js";
import { addPhoto } from "../src/commands/add-photo.js";
import { copyDemo } from "./helpers.js";

test("review writes CONTENT-REVIEW.md and reports the count", async () => {
  const root = copyDemo("cmd-review");
  const r = await runReview({ root });
  assert.equal(r.ok, true, r.message);
  assert.match(r.message, /2 items/);
  assert.ok(existsSync(join(root, "CONTENT-REVIEW.md")));
});

test("add-photo resizes, compresses, strips metadata and prints the tag", async () => {
  const root = copyDemo("cmd-photo");
  const input = join(root, "big.jpg");
  await sharp({ create: { width: 4000, height: 3000, channels: 3, background: "#7799aa" } })
    .withMetadata({ exif: { IFD0: { Copyright: "Example" } } })
    .jpeg({ quality: 95 })
    .toFile(input);
  const r = await addPhoto({ root, input, name: "Front Garden" });
  assert.equal(r.ok, true, r.message);
  const out = join(root, "src", "assets", "img", "front-garden.jpg");
  const meta = await sharp(out).metadata();
  assert.equal(Math.max(meta.width, meta.height), 1600);
  assert.equal(meta.exif, undefined);
  assert.ok(statSync(out).size <= 300 * 1024);
  assert.equal(r.tag, `<img src="/assets/img/front-garden.jpg" width="${meta.width}" height="${meta.height}" alt="DESCRIBE THE PHOTO" loading="lazy">`);

  const again = await addPhoto({ root, input, name: "front-garden" });
  assert.equal(again.ok, false);
  assert.match(again.message, /already exists/);
});

test("add-photo never enlarges and rejects non-images", async () => {
  const root = copyDemo("cmd-photo-small");
  const input = join(root, "small.png");
  await sharp({ create: { width: 300, height: 200, channels: 3, background: "#ffffff" } }).png().toFile(input);
  const r = await addPhoto({ root, input, name: "small" });
  assert.equal(r.ok, true, r.message);
  assert.match(r.tag, /width="300" height="200"/);
  writeFileSync(join(root, "notes.txt"), "not a photo");
  const bad = await addPhoto({ root, input: join(root, "notes.txt"), name: "notes" });
  assert.equal(bad.ok, false);
  assert.match(bad.message, /isn't a photo format/);
});

test("add-photo rejects a name with no letters or numbers before checking files", async () => {
  const root = copyDemo("cmd-photo-empty-name");
  const r = await addPhoto({ root, input: join(root, "missing.jpg"), name: "!!!" });
  assert.equal(r.ok, false);
  assert.equal(r.message, "Choose a name with letters or numbers, e.g. front-porch.");
  assert.equal(existsSync(join(root, "src", "assets", "img", ".jpg")), false);
});

test("add-photo removes the output when it is still over budget", async () => {
  const root = copyDemo("cmd-photo-budget");
  const configPath = join(root, "site-kit.config.js");
  const config = readFileSync(configPath, "utf8");
  writeFileSync(configPath, config.replace("fonts: [],", 'fonts: [],\n  budgets: { imageFile: "1 KB" },'));
  const input = join(root, "noisy.png");
  await sharp({
    create: { width: 1600, height: 1200, channels: 3, background: "#808080", noise: { type: "gaussian", mean: 128, sigma: 60 } },
  }).png().toFile(input);
  const r = await addPhoto({ root, input, name: "noisy" });
  assert.equal(r.ok, false);
  assert.match(r.message, /still/);
  assert.equal(existsSync(join(root, "src", "assets", "img", "noisy.jpg")), false);
});

test("add-photo flattens transparency onto white", async () => {
  const root = copyDemo("cmd-photo-alpha");
  const input = join(root, "alpha.png");
  await sharp({ create: { width: 200, height: 200, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toFile(input);
  const r = await addPhoto({ root, input, name: "alpha" });
  assert.equal(r.ok, true, r.message);
  const { data } = await sharp(join(root, "src", "assets", "img", "alpha.jpg")).raw().toBuffer({ resolveWithObject: true });
  assert.ok(data[0] > 240 && data[1] > 240 && data[2] > 240, `top-left pixel was ${data[0]},${data[1]},${data[2]}`);
});

test("runTest reports a plain failure instead of throwing when a check can't run", async () => {
  const { runTest } = await import("../src/commands/test.js");
  const root = copyDemo("cmd-cant-run");
  const before = process.env.PW_CHANNEL;
  process.env.PW_CHANNEL = "no-such-channel";
  try {
    const r = await runTest({ root, siteTests: false });
    assert.equal(r.ok, false);
    assert.match(r.report, /couldn't run/);
    assert.match(r.json.summary, /^The checks couldn't run:/);
    assert.deepEqual(r.json.failures, []);
  } finally {
    if (before === undefined) delete process.env.PW_CHANNEL; else process.env.PW_CHANNEL = before;
  }
});

test("add-photo explains a broken config instead of throwing", async () => {
  const root = copyDemo("cmd-photo-badconfig");
  writeFileSync(join(root, "site-kit.config.js"), "export default { site: {} };\n");
  writeFileSync(join(root, "p.jpg"), await sharp({ create: { width: 10, height: 10, channels: 3, background: "#888" } }).jpeg().toBuffer());
  const r = await addPhoto({ root, input: join(root, "p.jpg"), name: "x" });
  assert.equal(r.ok, false);
  assert.ok(r.message.length > 0);
});
