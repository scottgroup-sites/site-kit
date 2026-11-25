import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseHTML } from "linkedom";
import { fileForOldUrl } from "./old-site.js";
import { parseRedirects, redirectFor } from "./redirects.js";

const BLOCKS = "h1, h2, h3, h4, h5, h6, p, li, dt, dd, td, th, blockquote, figcaption, summary";
const CHROME = "header, nav, footer, script, style, noscript, template, [aria-hidden='true']";

export const normalize = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/&nbsp;| /g, " ")
    .replace(/\s+/g, " ")
    .trim();

function readable(html) {
  const { document } = parseHTML(html);
  document.querySelectorAll(CHROME).forEach((el) => el.remove());
  return document;
}

// The text blocks of an old page, without the header, menu and footer every page shares.
export function textBlocks(html) {
  const doc = readable(html);
  const seen = new Set();
  const out = [];
  for (const el of doc.querySelectorAll(BLOCKS)) {
    if (el.querySelector(BLOCKS)) continue; // the innermost block carries the text
    const t = el.textContent.replace(/\s+/g, " ").trim();
    const key = normalize(t);
    if (key.length < 3 || seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

export function missingText(oldHtml, newHtml) {
  const haystack = normalize(readable(newHtml).body?.textContent ?? "");
  const blocks = textBlocks(oldHtml);
  return { total: blocks.length, missing: blocks.filter((b) => !haystack.includes(normalize(b))) };
}

function builtFile(outDir, url) {
  const clean = decodeURIComponent(url.split(/[?#]/)[0]);
  for (const t of clean.endsWith("/") ? [`${clean}index.html`] : [clean, `${clean}/index.html`, `${clean}.html`]) {
    const f = join(outDir, t);
    if (existsSync(f) && statSync(f).isFile()) return f;
  }
  return null;
}

// Compares each old page with the page now built at the same URL (or the one its redirect points to).
export function comparePages({ oldRoot, outDir, urls }) {
  const redirectsFile = join(outDir, "_redirects");
  const rules = existsSync(redirectsFile) ? parseRedirects(readFileSync(redirectsFile, "utf8")) : [];
  const results = [];
  for (const url of urls) {
    const oldFile = fileForOldUrl(oldRoot, url);
    if (!oldFile || !oldFile.endsWith(".html")) continue;
    const rule = redirectFor(rules, url);
    const newUrl = builtFile(outDir, url) ? url : rule?.to.startsWith("/") ? rule.to : null;
    const newFile = newUrl ? builtFile(outDir, newUrl) : null;
    if (!newFile) {
      results.push({ url, newUrl: null, total: 0, missing: [] });
      continue;
    }
    results.push({ url, newUrl, ...missingText(readFileSync(oldFile, "utf8"), readFileSync(newFile, "utf8")) });
  }
  return results;
}

export function formatComparison(results, { max = 15 } = {}) {
  const out = ["# Content comparison", "", "Text from each old page that isn't on the new page. Header, menu and footer are left out. Some gaps are deliberate rewrites; check each one.", ""];
  let gaps = 0;
  for (const r of results) {
    if (!r.newUrl) {
      out.push(`## ${r.url}`, "", "**No new page and no redirect yet.**", "");
      gaps++;
      continue;
    }
    if (!r.missing.length) continue;
    gaps++;
    out.push(`## ${r.url}${r.newUrl !== r.url ? ` → ${r.newUrl}` : ""}`, "", `${r.missing.length} of ${r.total} text blocks missing:`, "");
    for (const m of r.missing.slice(0, max)) out.push(`- ${m.length > 160 ? `${m.slice(0, 157)}…` : m}`);
    if (r.missing.length > max) out.push(`- …and ${r.missing.length - max} more`);
    out.push("");
  }
  const checked = results.filter((r) => r.newUrl).length;
  out.splice(4, 0, gaps ? `**${gaps} of ${results.length} pages have gaps.**` : `All ${checked} pages carry over every text block.`, "");
  return { text: out.join("\n"), gaps };
}
