import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { parseHTML } from "linkedom";
import { SENSITIVE } from "../checks/sensitive-fields.js";
import { parseRedirects } from "./redirects.js";
import { sitemapPaths, urlForFile, walkOldSite } from "./old-site.js";

// Files other sites may link to directly, so their URLs must keep working.
const DOCUMENTS = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".xml", ".ics", ".vcf"];
const WEB_IMAGES = [".jpg", ".jpeg", ".png", ".webp", ".avif", ".svg", ".gif", ".ico"];
const OTHER_IMAGES = [".bmp", ".tif", ".tiff", ".heic", ".heif"];
const IMAGE_BUDGET = 300 * 1024;
const REFS = [
  ["script", "script[src]", "src"],
  ["stylesheet", 'link[rel="stylesheet"][href]', "href"],
  ["iframe", "iframe[src]", "src"],
  ["img", "img[src]", "src"],
  ["form", "form[action]", "action"],
];
// Tracking and chat snippets, named so the report says what they are.
const KNOWN_SNIPPETS = [
  [/googletagmanager\.com|google-analytics\.com|\bgtag\(/, "Google Analytics / Tag Manager (analytics)"],
  [/connect\.facebook\.net|\bfbq\(/, "Meta Pixel (tracking)"],
  [/hotjar/i, "Hotjar (tracking)"],
  [/clarity\.ms/, "Microsoft Clarity (tracking)"],
  [/tawk\.to|intercom|crisp\.chat|livechat/i, "Chat widget"],
];
const SCRIPT_HOST = /https?:\/\/([a-z0-9-]+(?:\.[a-z0-9-]+)+)/gi;

const text = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

export function scanOldSite(root) {
  const files = walkOldSite(root);
  const pages = [];
  const urls = new Map(); // url -> where it came from
  const addUrl = (url, from) => { if (url && !urls.has(url)) urls.set(url, from); };
  const services = new Map(); // "type host" -> { type, host, pages:Set }
  const inline = new Map(); // name -> Set of pages
  const fonts = new Set();
  const forms = [];
  const images = [];

  for (const rel of files) {
    const ext = extname(rel).toLowerCase();
    const size = statSync(join(root, rel)).size;
    if (OTHER_IMAGES.includes(ext)) images.push({ rel, size, problem: `${ext} isn't a web image format` });
    else if (WEB_IMAGES.includes(ext) && size > IMAGE_BUDGET) images.push({ rel, size, problem: `${Math.round(size / 1024)} KB (budget 300 KB)` });
    if (DOCUMENTS.includes(ext) && rel !== "sitemap.xml") addUrl(`/${rel}`, "file");
    if (ext !== ".html") continue;
    const url = urlForFile(rel);
    const html = readFileSync(join(root, rel), "utf8");
    const { document: doc } = parseHTML(html);
    const robots = doc.querySelector('meta[name="robots"]')?.getAttribute("content") ?? "";
    const page = {
      rel,
      url: url ?? `/${rel}`,
      title: text(doc.querySelector("title")?.textContent),
      description: text(doc.querySelector('meta[name="description"]')?.getAttribute("content")),
      canonical: doc.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? "",
      h1: doc.querySelectorAll("h1").length,
      noindex: /noindex/i.test(robots),
      styleAttrs: doc.querySelectorAll("[style]").length,
      styleBlocks: doc.querySelectorAll("style").length,
      inlineScripts: [...doc.querySelectorAll("script:not([src])")].filter((s) => !/json/i.test(s.getAttribute("type") ?? "")).length,
    };
    pages.push(page);
    if (url) addUrl(url, "page");
    for (const [type, selector, attr] of REFS) {
      for (const el of doc.querySelectorAll(selector)) {
        const ref = el.getAttribute(attr) ?? "";
        if (!/^(https?:)?\/\//i.test(ref)) continue;
        const host = new URL(ref, "https://x").host.toLowerCase();
        const key = `${type} ${host}`;
        if (!services.has(key)) services.set(key, { type, host, pages: new Set() });
        services.get(key).pages.add(page.url);
        if (host === "fonts.googleapis.com") {
          for (const m of ref.matchAll(/family=([^:&]+)/g)) fonts.add(decodeURIComponent(m[1]).replace(/\+/g, " "));
        }
      }
    }
    // Inline scripts can load or send to services without any src or action the checks would see.
    const inlineCode = [...doc.querySelectorAll("script:not([src])")].filter((s) => !/json/i.test(s.getAttribute("type") ?? "")).map((s) => s.textContent).join("\n");
    const found = new Set(KNOWN_SNIPPETS.filter(([pattern]) => pattern.test(inlineCode)).map(([, name]) => name));
    for (const m of inlineCode.matchAll(SCRIPT_HOST)) found.add(m[1].toLowerCase());
    for (const name of found) {
      if (!inline.has(name)) inline.set(name, new Set());
      inline.get(name).add(page.url);
    }
    for (const form of doc.querySelectorAll("form")) {
      const fields = [...form.querySelectorAll("input, select, textarea")]
        .filter((f) => !/^(hidden|submit|button|reset|image)$/i.test(f.getAttribute("type") ?? ""))
        .map((f) => f.getAttribute("name") || f.getAttribute("id") || f.localName);
      const labels = [...form.querySelectorAll("label")].map((l) => text(l.textContent));
      const sensitive = [...new Set([...fields.map((f) => f.replace(/[_-]/g, " ")), ...labels].map((t) => SENSITIVE.exec(t)?.[0]).filter(Boolean))];
      forms.push({ page: page.url, action: form.getAttribute("action") || null, fields, sensitive });
    }
  }

  for (const p of sitemapPaths(root)) addUrl(p, "sitemap");
  const redirectsFile = join(root, "_redirects");
  const redirects = existsSync(redirectsFile) ? parseRedirects(readFileSync(redirectsFile, "utf8")) : [];
  for (const r of redirects) if (r.from.startsWith("/") && !r.from.includes("*") && !r.from.includes(":")) addUrl(r.from, "redirect");

  return {
    pages,
    urls: [...urls.entries()].map(([url, from]) => ({ url, from })).sort((a, b) => a.url.localeCompare(b.url)),
    services: [...services.values()].map((s) => ({ ...s, pages: [...s.pages].sort() })).sort((a, b) => a.host.localeCompare(b.host) || a.type.localeCompare(b.type)),
    inline: [...inline.entries()].map(([name, set]) => ({ name, pages: [...set].sort() })),
    fonts: [...fonts].sort(),
    forms,
    images,
    redirects,
    headers: existsSync(join(root, "_headers")),
  };
}

export function formatUrlList(scan) {
  return [
    "# URLs the old site served. site-kit's `urls` check fails if any of them stops working:",
    "# each needs a page or file at the same URL, or a rule in src/_redirects.",
    "# Remove a line only when the developer has decided that URL can go.",
    ...scan.urls.map((u) => u.url),
    "",
  ].join("\n");
}

const list = (pages, max = 4) => (pages.length > max ? `${pages.slice(0, max).join(", ")} and ${pages.length - max} more` : pages.join(", "));

export function formatMigrationReport(scan, { date = new Date().toISOString().slice(0, 10) } = {}) {
  const out = [
    "# Migration report",
    "",
    `Written by \`site-kit migrate scan\` on ${date} from the old site's files. It lists what the move to`,
    "Eleventy and site-kit has to carry over or decide. Developer-facing; work through it top to bottom.",
    "",
    "## URLs to keep",
    "",
    `${scan.urls.length} URLs are recorded in \`migration/old-urls.txt\` (${scan.pages.length} pages, plus documents, sitemap entries and redirects).`,
    "With `migration.oldUrls` set in `site-kit.config.js`, `npx --no site-kit test` fails until each one has a page or a redirect.",
    "",
  ];
  const htmlUrls = scan.pages.filter((p) => p.rel.endsWith(".html") && !p.rel.endsWith("index.html") && p.rel !== "404.html");
  if (htmlUrls.length) {
    out.push(`- ${htmlUrls.length} page${htmlUrls.length === 1 ? " is a" : "s are"} \`name.html\` file${htmlUrls.length === 1 ? "" : "s"} (${list(htmlUrls.map((p) => p.rel))}). Eleventy writes \`name/index.html\`, served at \`/name/\`; Cloudflare Pages redirects \`/name\` there, so those URLs keep working.`, "");
  }
  if (scan.redirects.length) out.push(`- The old \`_redirects\` has ${scan.redirects.length} rule${scan.redirects.length === 1 ? "" : "s"}. Move it to \`src/_redirects\` and pass it through, or the old sources stop redirecting.`, "");

  out.push("## Outside services", "", "Each needs a developer decision: approve it in `site-kit.config.js` `allowedHosts` (with a reason), update the CSP in `src/_headers`, or drop it. Analytics and chat widgets are developer-only and need the client's agreement.", "");
  if (!scan.services.length && !scan.inline.length) out.push("None found.", "");
  else {
    out.push("| Service | Loaded as | Pages |", "|---|---|---|");
    for (const s of scan.services) out.push(`| ${s.host} | ${s.type} | ${list(s.pages)} |`);
    for (const s of scan.inline) out.push(`| ${s.name} | inline script (fetch, embed or tracking code) | ${list(s.pages)} |`);
    out.push("");
  }
  if (scan.fonts.length) out.push(`Google Fonts in use: ${scan.fonts.join(", ")}. List the ones the new design keeps in \`fonts\`.`, "");

  out.push("## Forms", "");
  if (!scan.forms.length) out.push("None found.", "");
  for (const f of scan.forms) {
    out.push(`- ${f.page}: ${f.action ? `sends to ${f.action}` : "no action, so a script sends it (see the inline script hosts above)"}; fields: ${f.fields.join(", ") || "(none)"}.${f.sensitive.length ? ` **Asks for ${f.sensitive.join(", ")}: the sensitive-fields check will fail; remove it or move it to a phone call.**` : ""}`);
  }
  if (scan.forms.length) out.push("", "A form is a change to the accessibility page and needs its service approved (`form` in `allowedHosts`).", "");

  const styled = scan.pages.filter((p) => p.styleAttrs || p.styleBlocks || p.inlineScripts);
  out.push("## Inline styles and scripts", "");
  if (!styled.length) out.push("None found.", "");
  else {
    out.push("site-kit sites keep styles in the stylesheet and scripts in files (the CSP and the design rules expect it). Move these into the design system as each page is converted:", "");
    out.push("| Page | style attributes | style blocks | inline scripts |", "|---|---|---|---|");
    for (const p of styled) out.push(`| ${p.url} | ${p.styleAttrs} | ${p.styleBlocks} | ${p.inlineScripts} |`);
    out.push("");
  }

  out.push("## Images", "");
  if (!scan.images.length) out.push("Every image is a web format under 300 KB.", "");
  else {
    out.push("Prepare these with `npx --no site-kit add-photo` before they go into `src/`:", "");
    for (const i of scan.images) out.push(`- ${i.rel}: ${i.problem}`);
    out.push("");
  }

  const pageNotes = scan.pages.map((p) => {
    const notes = [];
    if (p.h1 !== 1) notes.push(`${p.h1} h1 headings (needs exactly 1)`);
    if (!p.noindex && (p.description.length < 50 || p.description.length > 160)) notes.push(p.description ? `description is ${p.description.length} characters (50–160)` : "no description");
    if (!p.title) notes.push("no title");
    return notes.length ? `- ${p.url}: ${notes.join("; ")}` : null;
  }).filter(Boolean);
  out.push("## Page structure", "");
  out.push(pageNotes.length ? pageNotes.join("\n") : "Every page has one h1, a title and a 50–160 character description.", "");
  const noindex = scan.pages.filter((p) => p.noindex).map((p) => p.url);
  if (noindex.length) out.push(`Not indexed (add to \`sitemap.exclude\`): ${noindex.join(", ")}.`, "");

  out.push(
    "## Next steps",
    "",
    "1. Convert each page into `src/<page>/index.njk` on a shared layout. Wrap copy nobody has confirmed in `{% flag %}` (care sites: claims about care, staffing, licensing, pricing and hours).",
    "2. Move facts that repeat (phone, address, hours, menu) into `src/_data/`.",
    "3. Run `npx --no site-kit migrate compare` to list old text that's missing from the new pages.",
    "4. Run `npx --no site-kit test` until everything passes, then delete the old files from the repo root.",
    "5. Record the decisions in `SITE.md`, and add site tests in `tests/` for the copy decisions that are settled.",
    "",
  );
  return out.join("\n");
}
