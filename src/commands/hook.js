import { spawnSync } from "node:child_process";
import { runTest } from "./test.js";

const WATCHED = ["src", "tests", "eleventy.config.js", "eleventy.config.mjs", "eleventy.config.cjs", ".eleventy.js", "site-kit.config.js", "package.json", "package-lock.json"];

export async function runHook({ root, stdin }) {
  let input = {};
  try {
    input = JSON.parse(stdin || "{}");
  } catch {
    // treat unreadable input as an ordinary stop
  }
  if (input.stop_hook_active) return { code: 0, message: "" };
  try {
    const status = spawnSync("git", ["status", "--porcelain", "--", ...WATCHED], { cwd: root, encoding: "utf8" });
    if (status.status !== 0 || !status.stdout.trim()) return { code: 0, message: "" };
    const result = await runTest({ root });
    if (result.ok) return { code: 0, message: "" };
    if (String(result.json.summary ?? "").startsWith("The checks couldn't run")) {
      return { code: 2, message: `${result.json.summary}. Tell the user the checks couldn't run and ask a developer to look at it.\n` };
    }
    const failures = result.json.failures ?? [];
    const lines = [
      "The site's checks failed after your changes. Fix the content (never the checks), run `npx --no site-kit test` again, and explain the problem to the user in plain language.",
      "",
      result.json.summary ?? result.report,
      ...failures.slice(0, 20).map((f) => `${f.page} [${f.check}] ${f.message}`),
    ];
    if (!failures.length) lines.push(result.report);
    if (result.json.siteTests && !result.json.siteTests.ok) lines.push("", "Site tests in tests/ also failed; run `npx --no site-kit test` to see them.");
    return { code: 2, message: `${lines.join("\n")}\n` };
  } catch (err) {
    return { code: 2, message: `The site's checks couldn't run: ${err.message}. Tell the user and ask a developer to look at it.\n` };
  }
}
