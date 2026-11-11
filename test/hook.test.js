import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { join } from "node:path";
import { runHook } from "../src/commands/hook.js";
import { copyDemo } from "./helpers.js";

function gitRepo(name) {
  const root = copyDemo(name);
  const git = (...args) => execFileSync("git", ["-c", "user.email=test@example.com", "-c", "user.name=Test", ...args], { cwd: root });
  git("init", "-q");
  git("add", "-A");
  git("commit", "-q", "-m", "init");
  return root;
}

test("lets Claude stop when the hook is already active", async () => {
  assert.deepEqual(await runHook({ root: gitRepo("hook-active"), stdin: '{"stop_hook_active":true}' }), { code: 0, message: "" });
});

test("lets Claude stop when no site files changed", async () => {
  assert.equal((await runHook({ root: gitRepo("hook-clean"), stdin: "{}" })).code, 0);
});

test("blocks with a summary when a change breaks a check", async () => {
  const root = gitRepo("hook-broken");
  appendFileSync(join(root, "src", "about", "index.njk"), '\n<p><a href="/missing-page/">Missing</a></p>\n');
  const r = await runHook({ root, stdin: '{"stop_hook_active":false}' });
  assert.equal(r.code, 2);
  assert.match(r.message, /Fix the content \(never the checks\)/);
  assert.match(r.message, /\/about\/ \[links\] Links to \/missing-page\//);
});

test("blocks with an explanation when the checks themselves can't run", async () => {
  const root = gitRepo("hook-cant-run");
  appendFileSync(join(root, "src", "about", "index.njk"), "\n<p>Edited.</p>\n");
  const before = process.env.PW_CHANNEL;
  process.env.PW_CHANNEL = "no-such-channel";
  try {
    const r = await runHook({ root, stdin: '{"stop_hook_active":false}' });
    assert.equal(r.code, 2);
    assert.match(r.message, /couldn't run/);
  } finally {
    if (before === undefined) delete process.env.PW_CHANNEL; else process.env.PW_CHANNEL = before;
  }
});
