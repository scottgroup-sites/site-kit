import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// Folders that never hold the old site's pages.
const SKIP_DIRS = new Set(["node_modules", "_site", "src", "migration", "tests", "fixtures"]);

export function walkOldSite(dir, base = dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".") || SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walkOldSite(full, base));
    else out.push(relative(base, full).replace(/\\/g, "/"));
  }
  return out.sort();
}

// The URL a static host serves a file at. Cloudflare Pages serves about.html at /about and
// about/index.html at /about/.
export function urlForFile(rel) {
  if (rel === "index.html") return "/";
  if (rel.endsWith("/index.html")) return `/${rel.slice(0, -"index.html".length)}`;
  if (rel === "404.html") return null;
  if (rel.endsWith(".html")) return `/${rel.slice(0, -".html".length)}`;
  return `/${rel}`;
}

// The file that serves an old URL, or null.
export function fileForOldUrl(root, url) {
  const clean = decodeURIComponent(url.split(/[?#]/)[0]);
  const tries = clean.endsWith("/") ? [`${clean}index.html`] : [clean, `${clean}.html`, `${clean}/index.html`];
  for (const t of tries) {
    const file = join(root, t);
    if (existsSync(file) && statSync(file).isFile()) return file;
  }
  return null;
}

export function sitemapPaths(root) {
  const file = join(root, "sitemap.xml");
  if (!existsSync(file)) return [];
  return [...readFileSync(file, "utf8").matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => {
    try {
      return new URL(m[1]).pathname;
    } catch {
      return null;
    }
  }).filter(Boolean);
}

// Old URLs are read from a text file: one path per line, # comments and blank lines ignored.
export function parseUrlList(text) {
  return String(text).split(/\r?\n/).map((l) => l.replace(/#.*$/, "").trim()).filter(Boolean);
}
