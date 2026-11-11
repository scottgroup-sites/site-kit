import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { buildSite } from "../src/runner/build.js";
import { copyDemo } from "./helpers.js";

test("show mode: flags highlighted, review file written, stylesheet linked and copied", () => {
  const root = copyDemo("plugin-show");
  const r = buildSite(root, { mode: "show" });
  assert.ok(r.ok, r.output);
  const about = readFileSync(join(r.outDir, "about", "index.html"), "utf8");
  assert.match(about, /data-flag="CONFIRM"/);
  assert.match(about, /PHOTO NEEDED: The front garden in summer/);
  assert.match(about, /<link rel="stylesheet" href="\/assets\/site-kit\/review.css">/);
  assert.ok(existsSync(join(r.outDir, "assets", "site-kit", "review.css")));
  const review = readFileSync(join(root, "CONTENT-REVIEW.md"), "utf8");
  assert.match(review, /\*\*2 items\*\*: 1 CONFIRM, 1 PHOTO/);
  assert.match(review, /## About us — `\/about\/`/);
  rmSync(r.outDir, { recursive: true, force: true });
});

test("hide mode: plain text and neutral photo boxes, no review file", () => {
  const root = copyDemo("plugin-hide");
  const r = buildSite(root, { mode: "hide" });
  assert.ok(r.ok, r.output);
  const about = readFileSync(join(r.outDir, "about", "index.html"), "utf8");
  assert.ok(!about.includes("data-flag"));
  assert.ok(!about.includes("PHOTO NEEDED"));
  assert.match(about, /site-kit-photo--clean/);
  assert.ok(!existsSync(join(root, "CONTENT-REVIEW.md")));
  rmSync(r.outDir, { recursive: true, force: true });
});

test("fail mode: the build fails and lists the open items", () => {
  const root = copyDemo("plugin-fail");
  const r = buildSite(root, { mode: "fail" });
  assert.equal(r.ok, false);
  assert.match(r.output, /Launch blocked: 2 open review items/);
  assert.match(r.output, /\/about\/ — CONFIRM: How many residents can the home take\?/);
  rmSync(r.outDir, { recursive: true, force: true });
});

test("fail mode: placeholder facts still block launch when no flags remain", () => {
  const root = copyDemo("plugin-placeholders");
  writeFileSync(join(root, "src", "about", "index.njk"), "---\nlayout: base.njk\ntitle: About us — Example Care Home\ndescription: Learn about Example Care Home, a small residential care home with a homely setting and a dedicated team.\n---\n<h1>About us</h1>\n<p>Our team has cared for older adults for many years.</p>\n");
  const configPath = join(root, "eleventy.config.js");
  writeFileSync(configPath, readFileSync(configPath, "utf8").replace("placeholders: []", 'placeholders: ["email"]'));
  const r = buildSite(root, { mode: "fail" });
  assert.equal(r.ok, false);
  assert.match(r.output, /placeholder facts remain: email/);
  rmSync(r.outDir, { recursive: true, force: true });
});
