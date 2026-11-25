import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseHTML } from "linkedom";
import { validateConfig } from "../config.js";
import { formatMigrationReport, formatUrlList, scanOldSite } from "../migrate/scan.js";
import { KIT_VERSION, syncFiles } from "./sync.js";

const STARTER = fileURLToPath(new URL("../../templates/init/", import.meta.url));
const OLD_URLS = "migration/old-urls.txt";
const GITIGNORE = ["node_modules/", "_site/", ".tmp/"];
const SCRIPTS = (port) => ({ build: "eleventy", start: `eleventy --serve --port=${port}`, test: "site-kit test" });

// The https origin of the old site, from its home page's canonical link or its sitemap.
export function guessSiteUrl(root) {
  const candidates = [];
  const index = join(root, "index.html");
  if (existsSync(index)) {
    const { document } = parseHTML(readFileSync(index, "utf8"));
    candidates.push(document.querySelector('link[rel="canonical"]')?.getAttribute("href"));
    candidates.push(document.querySelector('meta[property="og:url"]')?.getAttribute("content"));
  }
  const sitemap = join(root, "sitemap.xml");
  if (existsSync(sitemap)) candidates.push(/<loc>\s*([^<\s]+)/.exec(readFileSync(sitemap, "utf8"))?.[1]);
  for (const c of candidates) {
    try {
      const u = new URL(c);
      if (u.protocol === "https:") return u.origin;
    } catch {
      // not a URL
    }
  }
  return null;
}

// Paths that _headers marks noindex (e.g. "/thank-you/*"), as sitemap exclusions ("/thank-you/").
export function noindexPaths(headersText) {
  const out = [];
  let path = null;
  for (const line of String(headersText).split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    if (!/^\s/.test(line)) { path = line.trim(); continue; }
    if (path?.startsWith("/") && /^\s*X-Robots-Tag:.*noindex/i.test(line)) out.push(path.replace(/\*$/, ""));
  }
  return out.filter((p) => p !== "/");
}

const js = (v) => (Array.isArray(v) ? `[${v.map((x) => JSON.stringify(x)).join(", ")}]` : JSON.stringify(v));

export function siteKitConfigSource({ url, port, care, fonts, services, exclude, oldUrls, date }) {
  const hostNotes = services.length
    ? ["  // The old site used these outside services (see MIGRATION.md). Approve the ones the new site keeps,", '  // each with a reason, e.g. { host: "fonts.googleapis.com", types: ["stylesheet"], reason: "Design fonts" }:', ...services.map((s) => `  //   ${s.host} (${s.type})`)]
    : [];
  return [
    "// site-kit settings for this site. Developer-only: loosening anything here needs a written reason.",
    `// Written by \`site-kit init\` on ${date}; review each line before the first commit.`,
    "export default {",
    `  site: { url: ${js(url)} },`,
    '  productionBranch: "main",',
    `  previewPort: ${port},`,
    `  claude: { care: ${care} },`,
    '  // "fail" stops a production build while flags remain; "hide" while production is only a client preview.',
    '  flags: { production: "fail" },',
    "  // Text and links every footer must show, e.g. the phone number and the accessibility and privacy pages.",
    "  footer: { text: [], links: [] },",
    `  fonts: ${js(fonts)},`,
    ...hostNotes,
    "  allowedHosts: [],",
    `  sitemap: { exclude: ${js(exclude)} },`,
    ...(oldUrls ? ["  // Every URL the old site served must keep working; remove this once the new site is live.", `  migration: { oldUrls: ${js(OLD_URLS)} },`] : []),
    "};",
    "",
  ].join("\n");
}

export async function runInit({ root, url, care = false, port = 8080, name, now = new Date() }) {
  const lines = [];
  const say = (...text) => lines.push(...text);
  const date = now.toISOString().slice(0, 10);

  if (existsSync(join(root, "site-kit.config.js"))) {
    return { ok: false, lines: ["This repo already has site-kit.config.js. Use `npx --no site-kit sync` and `doctor` instead of init."] };
  }
  const siteUrl = (url ?? guessSiteUrl(root) ?? "").replace(/\/$/, "");
  if (!/^https:\/\/[^/\s]+$/.test(siteUrl)) {
    return { ok: false, lines: ["Couldn't tell the site's address from the old pages. Run init again with --url https://www.example.com."] };
  }
  if (!Number.isInteger(port) || port < 1024 || port > 65535) return { ok: false, lines: ["--port must be a whole number between 1024 and 65535."] };
  const siteName = name ?? basename(root);

  // 1. Record the old site before anything moves.
  const scan = scanOldSite(root);
  const hasOldSite = scan.pages.length > 0;
  if (hasOldSite) {
    mkdirSync(join(root, "migration"), { recursive: true });
    if (!existsSync(join(root, OLD_URLS))) {
      writeFileSync(join(root, OLD_URLS), formatUrlList(scan));
      say(`created: ${OLD_URLS} (${scan.urls.length} URLs the new site must keep)`);
    }
    writeFileSync(join(root, "MIGRATION.md"), formatMigrationReport(scan, { date }));
    say("created: MIGRATION.md (what to carry over or decide)");
  }

  // 2. Scaffold Eleventy and site-kit, never overwriting a file.
  const headersText = existsSync(join(root, "_headers")) ? readFileSync(join(root, "_headers"), "utf8") : "";
  const exclude = [...new Set([...noindexPaths(headersText), ...scan.pages.filter((p) => p.noindex).map((p) => p.url), "/404.html"])];
  const fill = (text) => text.replaceAll("__NAME__", siteName).replaceAll("__URL__", siteUrl);
  const files = [
    ["site-kit.config.js", () => siteKitConfigSource({ url: siteUrl, port, care, fonts: scan.fonts, services: scan.services, exclude, oldUrls: hasOldSite, date })],
    ["eleventy.config.js", () => readFileSync(join(STARTER, "eleventy.config.js"), "utf8")],
    ["src/_data/site.js", () => fill(readFileSync(join(STARTER, "site.js"), "utf8"))],
    ["src/_includes/base.njk", () => readFileSync(join(STARTER, "base.njk"), "utf8")],
    ["src/404.njk", () => fill(readFileSync(join(STARTER, "404.njk"), "utf8"))],
    ["src/sitemap.njk", () => readFileSync(join(STARTER, "sitemap.njk"), "utf8")],
    ["src/assets/css/styles.css", () => readFileSync(join(STARTER, "styles.css"), "utf8")],
  ];
  for (const [rel, content] of files) {
    const file = join(root, rel);
    if (existsSync(file)) { say(`kept: ${rel} (already exists)`); continue; }
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content());
    say(`created: ${rel}`);
  }
  // The old site's _headers (security headers and CSP), _redirects and robots.txt carry over as they are.
  for (const rel of ["_headers", "_redirects", "robots.txt"]) {
    const target = join(root, "src", rel);
    if (existsSync(target)) continue;
    if (existsSync(join(root, rel))) {
      copyFileSync(join(root, rel), target);
      if (rel === "_headers" && !/Content-Security-Policy:/i.test(headersText)) {
        appendFileSync(target, `${headersText.endsWith("\n") ? "" : "\n"}\n# Added by site-kit init: the old headers had no Content-Security-Policy.\n${readFileSync(join(STARTER, "_headers"), "utf8")}`);
        say("copied: _headers → src/_headers, adding a strict Content-Security-Policy (the old one had none)");
      } else say(`copied: ${rel} → src/${rel}${rel === "_headers" ? " (review it: the csp check compares it with allowedHosts)" : ""}`);
    } else if (rel === "_headers") {
      copyFileSync(join(STARTER, "_headers"), target);
      say("created: src/_headers (strict default security headers)");
    }
  }

  const pkgFile = join(root, "package.json");
  if (!existsSync(pkgFile)) {
    const pkg = { name: siteName.toLowerCase().replace(/[^a-z0-9-]+/g, "-"), private: true, type: "module", scripts: SCRIPTS(port), engines: { node: ">=22" } };
    writeFileSync(pkgFile, `${JSON.stringify(pkg, null, 2)}\n`);
    say("created: package.json");
  } else {
    let pkg = {};
    try {
      pkg = JSON.parse(readFileSync(pkgFile, "utf8"));
    } catch {
      // reported below
    }
    const missing = Object.entries(SCRIPTS(port)).filter(([k]) => !pkg.scripts?.[k]).map(([k, v]) => `"${k}": "${v}"`);
    if (pkg.type !== "module") missing.unshift('"type": "module"');
    say(missing.length ? `kept: package.json; add ${missing.join(", ")}` : "kept: package.json");
  }

  const ignoreFile = join(root, ".gitignore");
  const ignored = existsSync(ignoreFile) ? readFileSync(ignoreFile, "utf8").split(/\r?\n/).map((l) => l.trim()) : [];
  const add = GITIGNORE.filter((l) => !ignored.includes(l) && !ignored.includes(l.replace(/\/$/, "")));
  if (add.length) {
    appendFileSync(ignoreFile, `${ignored.length && ignored.at(-1) !== "" ? "\n" : ""}${add.join("\n")}\n`);
    say(`updated: .gitignore (${add.join(", ")})`);
  }

  // 3. The files site-kit manages: Claude guidance, protected files, the Stop hook, CI, SITE.md.
  const { config } = validateConfig((await import(`${pathToFileURL(join(root, "site-kit.config.js")).href}?t=${Date.now()}`)).default);
  for (const c of syncFiles(root, config)) say(`${c.action === "create" ? "created" : "updated"}: ${c.path}`);

  say(
    "",
    "Next:",
    "  1. Install with npm 10 (npm 11 lockfiles fail on Linux hosts):",
    `     npx -y -p npm@10.9.9 npm install --save-dev @11ty/eleventy github:scottgroup-sites/site-kit#v${KIT_VERSION}`,
    "  2. Read MIGRATION.md, then convert each old page into src/<page>/index.njk on the base layout.",
    "  3. npx --no site-kit migrate compare   (old text missing from the new pages)",
    "  4. npx --no site-kit test               (until everything passes)",
    "  5. Fill in SITE.md, set the hosting build to `npm run build` with output `_site`, and delete the old files.",
  );
  return { ok: true, lines };
}
