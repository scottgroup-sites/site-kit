import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../config.js";
import { buildSite } from "../runner/build.js";
import { runChecks } from "../runner/run.js";
import { applyExceptions, formatReport, summarize } from "../runner/results.js";

function siteTestFiles(root) {
  const dir = join(root, "tests");
  if (!existsSync(dir)) return [];
  const walk = (d) => readdirSync(d).flatMap((name) => {
    const full = join(d, name);
    return statSync(full).isDirectory() ? walk(full) : name.endsWith(".test.js") ? [full] : [];
  });
  return walk(dir);
}

export async function runTest({ root, siteTests = true }) {
  let loaded;
  try {
    loaded = await loadConfig(root);
  } catch (err) {
    return { ok: false, report: err.message, json: { ok: false, summary: err.message } };
  }
  const { config, warnings } = loaded;
  const build = buildSite(root, { mode: "show" });
  try {
    if (!build.ok) {
      const report = `✖ The site didn't build:\n${build.output.trim()}`;
      return { ok: false, report, json: { ok: false, summary: "The site didn't build" } };
    }
    let problems, pageCount;
    try {
      ({ problems, pageCount } = await runChecks({ root, config, outDir: build.outDir }));
    } catch (err) {
      const summary = `The checks couldn't run: ${err.message}`;
      return { ok: false, report: `✖ ${summary}`, json: { ok: false, summary, failures: [], pageCount: 0 } };
    }
    const { failures, excepted } = applyExceptions(problems, config.exceptions);
    const files = siteTests ? siteTestFiles(root) : [];
    const site = { ran: files.length > 0, ok: true, output: "" };
    if (files.length) {
      const r = spawnSync(process.execPath, ["--test", ...files], { cwd: root, env: { ...process.env, SITE_KIT_OUT_DIR: build.outDir }, encoding: "utf8" });
      site.ok = r.status === 0 && !r.error;
      site.output = `${r.stdout ?? ""}${r.stderr ?? ""}${r.error ? r.error.message : ""}`;
    }
    const ok = failures.length === 0 && site.ok;
    const report = formatReport({ failures, warnings, exceptions: config.exceptions, pageCount, siteTests: site });
    return {
      ok,
      report,
      json: { ok, summary: summarize(failures, pageCount, site.ok), pageCount, failures, excepted, warnings, exceptions: config.exceptions, siteTests: { ran: site.ran, ok: site.ok } },
    };
  } finally {
    rmSync(build.outDir, { recursive: true, force: true });
  }
}
