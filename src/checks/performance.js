import { existsSync, readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";

export const id = "performance";
export const browser = false;

const WEB_IMAGES = [".jpg", ".jpeg", ".png", ".webp", ".avif", ".svg", ".gif"];
const ANY_IMAGE = [...WEB_IMAGES, ".bmp", ".tif", ".tiff", ".heic", ".heif"];
const KB = 1024;
const fmt = (bytes) => `${Math.round(bytes / KB)} KB`;
const isExternal = (src) => /^(https?:)?\/\//i.test(src);

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

export async function run({ pages, loadPage, fileForUrl, outDir, config }) {
  const { budgets, budgetLabels } = config;
  const problems = [];
  for (const page of pages) {
    const doc = loadPage(page);
    const p = (message) => problems.push({ page, message });
    const htmlBytes = statSync(fileForUrl(page)).size;
    if (htmlBytes > budgets.htmlPerPage) p(`The HTML is ${fmt(htmlBytes)} (budget ${budgetLabels.htmlPerPage}); split the page or trim repeated markup.`);
    const local = new Set();
    const add = (src) => { if (src && !src.startsWith("data:") && !isExternal(src)) local.add(src.split(/[?#]/)[0]); };
    doc.querySelectorAll("script[src]").forEach((s) => add(s.getAttribute("src")));
    doc.querySelectorAll('link[rel="stylesheet"][href]').forEach((l) => add(l.getAttribute("href")));
    doc.querySelectorAll("img").forEach((img) => {
      const src = img.getAttribute("src");
      add(src);
      if (!img.hasAttribute("width") || !img.hasAttribute("height")) p(`<img src="${src}"> needs width and height so the page doesn't jump while loading.`);
      if (!img.hasAttribute("alt")) p(`<img src="${src}"> has no alt attribute (use alt="" only if the image is purely decorative).`);
    });
    doc.querySelectorAll("iframe").forEach((f) => { if (f.getAttribute("loading") !== "lazy") p(`<iframe src="${f.getAttribute("src")}"> should have loading="lazy".`); });
    doc.querySelectorAll("video[autoplay], audio[autoplay]").forEach((m) => p(`A <${m.localName}> autoplays; let visitors start media themselves.`));
    for (const link of doc.querySelectorAll('link[rel="stylesheet"][href*="fonts.googleapis.com"]')) {
      for (const m of link.getAttribute("href").matchAll(/family=([^:&]+)/g)) {
        const family = decodeURIComponent(m[1]).replace(/\+/g, " ");
        if (!config.fonts.includes(family)) p(`Loads the font "${family}", which isn't in site-kit.config.js. Use the site's design fonts.`);
      }
    }
    let total = htmlBytes;
    for (const src of local) {
      const file = fileForUrl(src);
      if (existsSync(file) && statSync(file).isFile()) total += statSync(file).size;
    }
    if (total > budgets.pageTotal) p(`The page weight is ${fmt(total)} (budget ${budgetLabels.pageTotal}); compress or resize images.`);
  }
  let css = 0;
  let js = 0;
  for (const file of walk(outDir)) {
    const ext = extname(file).toLowerCase();
    const rel = file.slice(outDir.length).replace(/\\/g, "/").replace(/^\/?/, "/");
    if (ext === ".css") css += statSync(file).size;
    if (ext === ".js") js += statSync(file).size;
    if (!ANY_IMAGE.includes(ext)) continue;
    if (!WEB_IMAGES.includes(ext)) problems.push({ page: "(site)", message: `${rel}: ${ext} isn't a web image format; convert it with site-kit add-photo.` });
    const size = statSync(file).size;
    if (size > budgets.imageFile) problems.push({ page: "(site)", message: `${rel} is ${fmt(size)} (budget ${budgetLabels.imageFile}); prepare it with site-kit add-photo.` });
  }
  if (css > budgets.cssTotal) problems.push({ page: "(site)", message: `CSS totals ${fmt(css)} (budget ${budgetLabels.cssTotal}).` });
  if (js > budgets.jsTotal) problems.push({ page: "(site)", message: `JavaScript totals ${fmt(js)} (budget ${budgetLabels.jsTotal}).` });
  return problems;
}
