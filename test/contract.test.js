import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { runTest } from "../src/commands/test.js";
import { CHECK_IDS } from "../src/config.js";
import { KIT_ROOT, copyDemo } from "./helpers.js";

test("the demo site passes every check with no warnings", async () => {
  const result = await runTest({ root: copyDemo("contract-pass") });
  assert.equal(result.ok, true, result.report);
  assert.deepEqual(result.json.warnings, []);
  assert.equal(result.json.pageCount, 6);
});

for (const check of CHECK_IDS) {
  test(`breaking ${check} fails only ${check}`, async () => {
    const dir = copyDemo(`contract-${check}`);
    const { mutate } = await import(pathToFileURL(join(KIT_ROOT, "fixtures", "broken", `${check}.mjs`)).href);
    mutate(dir);
    const result = await runTest({ root: dir, siteTests: false });
    assert.equal(result.ok, false, `expected a failure\n${result.report}`);
    assert.deepEqual([...new Set(result.json.failures.map((f) => f.check))], [check], result.report);
  });
}

test("readability gives sizes in px and, on a non-16px root, in rem", async () => {
  const dir = copyDemo("contract-readability-rem");
  const { mutate } = await import(pathToFileURL(join(KIT_ROOT, "fixtures", "broken", "readability.mjs")).href);
  mutate(dir);
  const messages = (await runTest({ root: dir, siteTests: false })).json.failures.map((f) => f.message);
  assert.ok(messages.includes('Text "Tiny print." is 11px (0.611rem with this site\'s 18px root); the minimum is 14px (0.778rem here).'), messages.join("\n"));
  assert.ok(messages.includes('Body text "Our home" is 15.3px (0.85rem with this site\'s 18px root); body text, including small labels, must be at least 16px (0.889rem here).'), messages.join("\n"));
});
