import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { buildSite } from "../runner/build.js";

export async function runReview({ root }) {
  const build = buildSite(root, { mode: "show" });
  rmSync(build.outDir, { recursive: true, force: true });
  if (!build.ok) return { ok: false, message: `The site didn't build:\n${build.output.trim()}` };
  const md = readFileSync(join(root, "CONTENT-REVIEW.md"), "utf8");
  const count = /\*\*(\d+ items?)\*\*: (.*)/.exec(md);
  return { ok: true, message: `Wrote CONTENT-REVIEW.md: ${count ? `${count[1]} (${count[2]})` : "no open items"}.` };
}
