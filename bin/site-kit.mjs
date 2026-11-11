#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { runTest } from "../src/commands/test.js";
import { runReview } from "../src/commands/review.js";
import { addPhoto } from "../src/commands/add-photo.js";
import { loadConfig } from "../src/config.js";
import { syncFiles } from "../src/commands/sync.js";
import { runHook } from "../src/commands/hook.js";
import { runDoctor } from "../src/commands/doctor.js";

const [command, ...args] = process.argv.slice(2);
const root = process.cwd();

const USAGE = `Usage: site-kit <command>

  test [--json]              Build the site and run every check
  review                     Write CONTENT-REVIEW.md from the flags
  add-photo <file> <name>    Prepare a photo for the site
  sync [--check]             Update the files site-kit manages in this repo
  doctor                     Report this site's status
  hook                       Claude Code Stop hook (reads JSON on stdin)`;

const commands = {
  async test() {
    const result = await runTest({ root });
    process.stdout.write(args.includes("--json") ? `${JSON.stringify(result.json, null, 2)}\n` : `${result.report}\n`);
    return result.ok ? 0 : 1;
  },
  async review() {
    const r = await runReview({ root });
    (r.ok ? console.log : console.error)(r.message);
    return r.ok ? 0 : 1;
  },
  async "add-photo"() {
    const r = await addPhoto({ root, input: args[0], name: args[1] });
    (r.ok ? console.log : console.error)(r.message);
    if (r.tag) console.log(r.tag);
    return r.ok ? 0 : 1;
  },
  async sync() {
    const { config } = await loadConfig(root);
    const check = args.includes("--check");
    const changes = syncFiles(root, config, { check });
    if (!changes.length) {
      console.log("✔ Everything site-kit manages is up to date.");
      return 0;
    }
    for (const c of changes) console.log(`${check ? "out of date" : c.action === "create" ? "created" : "updated"}: ${c.path}`);
    if (check) console.log("Run `npx --no site-kit sync` and commit the result.");
    return check ? 1 : 0;
  },
  async doctor() {
    const { lines, code } = await runDoctor({ root });
    for (const l of lines) console.log(`${l.level.padEnd(5)} ${l.text}`);
    return code;
  },
  async hook() {
    let stdin = "";
    try {
      stdin = readFileSync(0, "utf8");
    } catch {
      // no input
    }
    const { code, message } = await runHook({ root: process.env.CLAUDE_PROJECT_DIR || root, stdin });
    if (message) process.stderr.write(message);
    return code;
  },
};

const run = commands[command];
if (!run) {
  console.error(USAGE);
  process.exit(command ? 1 : 0);
}
try {
  process.exitCode = await run();
} catch (err) {
  console.error(err?.message ?? String(err));
  process.exitCode = 1;
}
