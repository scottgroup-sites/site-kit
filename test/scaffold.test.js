import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("package exposes the CLI, the plugin and the test helpers", () => {
  assert.equal(pkg.name, "site-kit");
  assert.equal(pkg.type, "module");
  assert.equal(pkg.bin["site-kit"], "bin/site-kit.mjs");
  assert.equal(pkg.exports["./eleventy"], "./src/eleventy/plugin.js");
  assert.equal(pkg.exports["."], "./src/index.js");
});

test("lockfile has no required platform-only packages (written by npm 10)", () => {
  const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));
  const bad = Object.entries(lock.packages).filter(([, v]) => v.os && !v.optional && !v.devOptional && !v.peer).map(([k]) => k);
  assert.deepEqual(bad, []);
});
