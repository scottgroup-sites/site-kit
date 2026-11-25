import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadConfig } from "../config.js";
import { comparePages, formatComparison } from "../migrate/compare.js";
import { parseUrlList } from "../migrate/old-site.js";
import { formatMigrationReport, formatUrlList, scanOldSite } from "../migrate/scan.js";
import { buildSite } from "../runner/build.js";

const OLD_URLS = "migration/old-urls.txt";

// Reads the old static site (default: the repo root) and writes MIGRATION.md and the old URL list.
export function runScan({ root, from = root, now = new Date() }) {
  const oldRoot = resolve(root, from);
  if (!existsSync(oldRoot)) return { ok: false, message: `There's no folder ${from}.` };
  const scan = scanOldSite(oldRoot);
  if (!scan.pages.length) return { ok: false, message: `No .html pages found in ${from}. Point --from at the old site's files.` };
  mkdirSync(join(root, "migration"), { recursive: true });
  const urlFile = join(root, OLD_URLS);
  const kept = existsSync(urlFile);
  if (!kept) writeFileSync(urlFile, formatUrlList(scan));
  writeFileSync(join(root, "MIGRATION.md"), formatMigrationReport(scan, { date: now.toISOString().slice(0, 10) }));
  return {
    ok: true,
    message: [
      `✔ Scanned ${scan.pages.length} pages: ${scan.services.length + scan.inline.length} outside services, ${scan.forms.length} forms, ${scan.images.length} images to prepare.`,
      "  Wrote MIGRATION.md.",
      kept ? `  Kept the existing ${OLD_URLS} (delete it to record the URLs again).` : `  Wrote ${OLD_URLS} (${scan.urls.length} URLs).`,
    ].join("\n"),
  };
}

// Builds the new site and lists old text that isn't on the new pages.
export async function runCompare({ root, from = root }) {
  const urlFile = join(root, OLD_URLS);
  if (!existsSync(urlFile)) return { ok: false, message: `No ${OLD_URLS}. Run \`npx --no site-kit migrate scan\` first.` };
  try {
    await loadConfig(root);
  } catch (err) {
    return { ok: false, message: err.message };
  }
  const build = buildSite(root, { mode: "hide" });
  try {
    if (!build.ok) return { ok: false, message: `✖ The site didn't build:\n${build.output.trim()}` };
    const results = comparePages({ oldRoot: resolve(root, from), outDir: build.outDir, urls: parseUrlList(readFileSync(urlFile, "utf8")) });
    const { text, gaps } = formatComparison(results);
    writeFileSync(join(root, "migration", "content-comparison.md"), text);
    return { ok: gaps === 0, message: `${gaps ? `✖ ${gaps} of ${results.length} pages have text missing` : `✔ All ${results.length} pages carry over their text`}; see migration/content-comparison.md.` };
  } finally {
    rmSync(build.outDir, { recursive: true, force: true });
  }
}
