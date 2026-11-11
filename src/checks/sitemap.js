import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isNoindex } from "../runner/pages.js";

export const id = "sitemap";
export const browser = false;

export async function run({ pages, loadPage, outDir, config }) {
  const file = join(outDir, "sitemap.xml");
  if (!existsSync(file)) return [{ page: "(site)", message: "There is no sitemap.xml. Search engines use it to find every page." }];
  const problems = [];
  const site = (message) => problems.push({ page: "(site)", message });
  const exclude = config.sitemap.exclude;
  const locs = [...readFileSync(file, "utf8").matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1].replaceAll("&amp;", "&"));
  const listed = new Set();
  for (let loc of locs) {
    if (loc === config.site.url) loc = `${loc}/`;
    if (!loc.startsWith(`${config.site.url}/`)) { site(`sitemap.xml lists ${loc}, which isn't on ${config.site.url}.`); continue; }
    const path = loc.slice(config.site.url.length);
    if (listed.has(path)) { site(`sitemap.xml lists ${path} more than once.`); continue; }
    listed.add(path);
    if (!pages.includes(path)) site(`sitemap.xml lists ${path}, which doesn't exist.`);
    else if (isNoindex(loadPage(path))) site(`sitemap.xml lists ${path}, which is marked noindex.`);
    else if (exclude.includes(path)) site(`sitemap.xml lists ${path}, which site-kit.config.js excludes.`);
  }
  for (const page of pages) {
    if (exclude.includes(page) || isNoindex(loadPage(page))) continue;
    if (!listed.has(page)) problems.push({ page, message: "This page is missing from sitemap.xml." });
  }
  return problems;
}
