import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { runDoctor, compareVersions, newestDecision, decisionAge } from "../src/commands/doctor.js";
import { syncFiles } from "../src/commands/sync.js";
import { loadConfig } from "../src/config.js";
import { copyDemo } from "./helpers.js";

test("compareVersions and newestDecision", () => {
  assert.equal(compareVersions("1.2.0", "1.10.0"), -1);
  assert.equal(compareVersions("2.0.0", "2.0.0"), 0);
  assert.equal(newestDecision("## Decisions\n\n- 2026-01-05: A\n- 2026-03-01: B\n- YYYY-MM-DD: template\n"), "2026-03-01");
  assert.equal(newestDecision("# nothing"), null);
});

test("decisionAge reads naturally", () => {
  const now = new Date("2026-11-11T15:00:00Z");
  assert.equal(decisionAge("2026-11-11", now), "today");
  assert.equal(decisionAge("2026-11-10", now), "1 day ago");
  assert.equal(decisionAge("2026-11-01", now), "10 days ago");
  assert.equal(decisionAge("2026-12-01", now), "in the future");
});

test("doctor reports a healthy synced site", async () => {
  const root = copyDemo("doctor-ok");
  const { config } = await loadConfig(root);
  syncFiles(root, config);
  writeFileSync(join(root, "SITE.md"), "## Decisions\n\n- 2026-11-01: Launched.\n");
  execFileSync("git", ["init", "-q"], { cwd: root });
  const { lines, code } = await runDoctor({ root, checkLatest: false, now: new Date("2026-11-10") });
  const text = lines.map((l) => `${l.level} ${l.text}`).join("\n");
  assert.equal(code, 0, text);
  assert.match(text, /^OK +site-kit 1\.0\.0/m);
  assert.match(text, /^OK +Managed files are up to date/m);
  assert.match(text, /^OK +✔ All checks passed on 6 pages/m);
  assert.match(text, /^WARN +2 open review items/m);
  assert.match(text, /^OK +SITE\.md: newest decision 2026-11-01 \(9 days ago\)/m);
});

test("doctor flags drift, failures and a missing SITE.md", async () => {
  const root = copyDemo("doctor-bad");
  writeFileSync(join(root, "src", "about", "index.njk"), "---\nlayout: base.njk\ntitle: About\ndescription: x\n---\n<p>No heading</p>\n");
  const { lines, code } = await runDoctor({ root, checkLatest: false });
  const text = lines.map((l) => `${l.level} ${l.text}`).join("\n");
  assert.equal(code, 1);
  assert.match(text, /^WARN +\d+ managed files? out of date/m);
  assert.match(text, /^FAIL +✖ /m);
  assert.match(text, /^WARN +No SITE\.md/m);
});

test("a corrupt package-lock.json warns instead of crashing", async () => {
  const root = copyDemo("doctor-lock");
  writeFileSync(join(root, "package-lock.json"), "{ not json");
  const { lines } = await runDoctor({ root, checkLatest: false, now: new Date("2026-11-10") });
  const text = lines.map((l) => `${l.level} ${l.text}`).join("\n");
  assert.match(text, /^WARN +package-lock\.json can't be read/m);
  assert.match(text, /^WARN +No SITE\.md|^OK +SITE\.md/m);
});
