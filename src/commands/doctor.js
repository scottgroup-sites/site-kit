import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../config.js";
import { syncFiles, KIT_VERSION } from "./sync.js";
import { runTest } from "./test.js";

const REPO = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")).repository.url;

export function compareVersions(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  return 0;
}

export function newestDecision(siteMd) {
  const dates = [...siteMd.matchAll(/^\s*-\s*(\d{4}-\d{2}-\d{2})\b/gm)].map((m) => m[1]).sort();
  return dates.at(-1) ?? null;
}

const git = (root, args) => spawnSync("git", args, { cwd: root, encoding: "utf8" });

export async function runDoctor({ root, checkLatest = true, now = new Date() }) {
  const lines = [];
  const add = (level, text) => lines.push({ level, text });

  let latest = null;
  if (checkLatest) {
    const r = spawnSync("git", ["ls-remote", "--tags", "--refs", REPO], {
      encoding: "utf8",
      timeout: 10000,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
    if (r.status === 0) latest = r.stdout.split("\n").map((l) => /refs\/tags\/v(\d+\.\d+\.\d+)$/.exec(l)?.[1]).filter(Boolean).sort(compareVersions).at(-1) ?? null;
  }
  if (!latest) add("OK", `site-kit ${KIT_VERSION}${checkLatest ? " (couldn't check for a newer release)" : ""}`);
  else if (compareVersions(KIT_VERSION, latest) < 0) add("WARN", `site-kit ${KIT_VERSION} is installed; ${latest} is available. See the CHANGELOG before upgrading.`);
  else add("OK", `site-kit ${KIT_VERSION} (latest)`);

  const nodeMajor = Number(process.versions.node.split(".")[0]);
  add(nodeMajor >= 22 ? "OK" : "FAIL", `Node ${process.versions.node}${nodeMajor >= 22 ? "" : " (site-kit needs 22 or newer)"}`);

  let loaded;
  try {
    loaded = await loadConfig(root);
  } catch (err) {
    add("FAIL", err.message);
    return { lines, code: 1 };
  }
  const { config, warnings } = loaded;

  try {
    const drift = syncFiles(root, config, { check: true });
    if (drift.length) add("WARN", `${drift.length} managed file${drift.length === 1 ? "" : "s"} out of date (${drift.map((d) => d.path).join(", ")}); run \`npx --no site-kit sync\``);
    else add("OK", "Managed files are up to date");
  } catch (err) {
    add("FAIL", `Couldn't check managed files: ${err.message}`);
  }

  const lockFile = join(root, "package-lock.json");
  if (!existsSync(lockFile)) add("WARN", "No package-lock.json; run npm install with npm 10 and commit it");
  else {
    let lock = null;
    try {
      lock = JSON.parse(readFileSync(lockFile, "utf8"));
    } catch {
      add("WARN", "package-lock.json can't be read; regenerate it with npm 10");
    }
    if (lock) {
      const bad = Object.entries(lock.packages ?? {}).filter(([, v]) => v.os && !v.optional && !v.devOptional && !v.peer).map(([k]) => k);
      if (bad.length) add("WARN", `package-lock.json lists platform-only packages as required (${bad.join(", ")}); regenerate it with npm 10`);
      else add("OK", "package-lock.json installs on every platform");
    }
  }

  const branch = git(root, ["branch", "--show-current"]);
  if (branch.status === 0) {
    const dirty = git(root, ["status", "--porcelain"]).stdout.trim().split("\n").filter(Boolean).length;
    add(dirty ? "WARN" : "OK", `Branch ${branch.stdout.trim() || "(none)"}${dirty ? `, ${dirty} uncommitted change${dirty === 1 ? "" : "s"}` : ", no uncommitted changes"}`);
    const behind = git(root, ["rev-list", "--count", `HEAD..origin/${config.productionBranch}`]);
    const n = Number(behind.stdout.trim());
    if (behind.status === 0 && n > 0) add("WARN", `${n} commit${n === 1 ? "" : "s"} behind origin/${config.productionBranch} (as of the last git fetch); run \`git pull\``);
  }

  try {
    const test = await runTest({ root });
    if (test.ok) add("OK", test.json.summary);
    else add("FAIL", `${test.json.summary ?? "Checks didn't run"}; run \`npx --no site-kit test\` for details`);
  } catch (err) {
    add("FAIL", `Checks didn't run: ${err.message}; run \`npx --no site-kit test\` for details`);
  }

  const reviewFile = join(root, "CONTENT-REVIEW.md");
  const count = existsSync(reviewFile) ? /\*\*(\d+) items?\*\*: (.*)/.exec(readFileSync(reviewFile, "utf8")) : null;
  if (count) add("WARN", `${count[1]} open review item${count[1] === "1" ? "" : "s"} (${count[2]}); see CONTENT-REVIEW.md`);
  else add("OK", "No open review items");

  for (const w of warnings) add("WARN", w);
  for (const e of config.exceptions) add("WARN", `Exception: ${e.check} on ${e.page}: ${e.reason}`);

  const siteMd = join(root, "SITE.md");
  if (!existsSync(siteMd)) add("WARN", "No SITE.md; run `npx --no site-kit sync` and fill it in");
  else {
    const newest = newestDecision(readFileSync(siteMd, "utf8"));
    if (!newest) add("WARN", "SITE.md has no dated decisions yet");
    else {
      const days = Math.round((now - new Date(`${newest}T00:00:00Z`)) / 86400000);
      add(days > 180 ? "WARN" : "OK", `SITE.md: newest decision ${newest} (${days} days ago)${days > 180 ? "; check it's still current" : ""}`);
    }
  }

  return { lines, code: lines.some((l) => l.level === "FAIL") ? 1 : 0 };
}
