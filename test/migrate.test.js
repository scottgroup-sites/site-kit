import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseRedirects, redirectFor } from "../src/migrate/redirects.js";
import { parseUrlList, urlForFile } from "../src/migrate/old-site.js";
import { formatMigrationReport, scanOldSite } from "../src/migrate/scan.js";
import { missingText } from "../src/migrate/compare.js";
import { guessSiteUrl, noindexPaths, runInit } from "../src/commands/init.js";
import { runCompare, runScan } from "../src/commands/migrate.js";
import { runTest } from "../src/commands/test.js";
import { loadConfig } from "../src/config.js";
import { KIT_ROOT } from "./helpers.js";

const oldPage = (title, body, head = "") =>
  `<!doctype html><html lang="en"><head><title>${title}</title><meta name="description" content="A description of this old page that is longer than fifty characters.">${head}</head><body><header><nav><a href="/">Home</a></nav></header><main>${body}</main><footer><p>Example Care Home</p></footer></body></html>`;

// A small static site like the ones being migrated: pretty and .html URLs, a redirect, a PDF,
// a noindex thank-you page, Google Fonts, analytics and a form that asks too much.
const OLD_SITE = {
  "index.html": oldPage("Home", "<h1>Welcome</h1><p>A small home with a big garden.</p><form><label for=m>Current medications</label><input id=m name=meds></form>",
    '<link rel="canonical" href="https://www.example.com/"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400&display=swap"><script async src="https://www.googletagmanager.com/gtag/js?id=G-X"></script><script>gtag("config","G-X"); fetch("https://api.forms.example.org/submit");</script>'),
  "about.html": oldPage("About", '<h1>About us</h1><p style="color:red">Our team has cared for older adults for many years.</p><ul><li>Home-cooked meals</li><li>Garden walks</li></ul>'),
  "blog/first-post/index.html": oldPage("Post", "<h1>First post</h1><p>Hello.</p>"),
  "thank-you/index.html": oldPage("Thanks", "<h1>Thank you</h1><p>We will call you.</p>"),
  "downloads/checklist.pdf": "%PDF-1.4",
  "images/photo.bmp": "BM",
  "sitemap.xml": "<urlset><url><loc>https://www.example.com/</loc></url><url><loc>https://www.example.com/about</loc></url></urlset>",
  "_redirects": "# moved\n/services /about 301\n",
  "_headers": "/thank-you/*\n  X-Robots-Tag: noindex\n/*\n  X-Content-Type-Options: nosniff\n",
};

function oldSite(name) {
  const dir = join(KIT_ROOT, ".tmp", name);
  rmSync(dir, { recursive: true, force: true });
  for (const [rel, content] of Object.entries(OLD_SITE)) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), content);
  }
  return dir;
}

const write = (dir, rel, content) => {
  mkdirSync(dirname(join(dir, rel)), { recursive: true });
  writeFileSync(join(dir, rel), content);
};
const njk = (title, body) => `---\nlayout: base.njk\ntitle: ${title} — Example Care Home\ndescription: ${title} at Example Care Home, a small residential care home with a homely setting.\n---\n${body}\n`;

test("redirect rules match exact paths, placeholders and splats, ignoring a trailing slash", () => {
  const rules = parseRedirects("# c\n/services /about 301\n/blog/:slug /resources/:slug\n/old/* /new/:splat 302\nhttps://x.example.com/* https://example.com/:splat\n");
  assert.equal(rules.length, 4);
  assert.equal(redirectFor(rules, "/services/")?.to, "/about");
  assert.equal(redirectFor(rules, "/blog/a-post/")?.to, "/resources/:slug");
  assert.equal(redirectFor(rules, "/blog/a/b"), null);
  assert.equal(redirectFor(rules, "/old/x/y.html")?.to, "/new/:splat");
  assert.equal(redirectFor(rules, "/old")?.to, "/new/:splat");
  assert.equal(redirectFor(rules, "/other"), null);
});

test("old file names map to the URLs a static host serves", () => {
  assert.equal(urlForFile("index.html"), "/");
  assert.equal(urlForFile("blog/index.html"), "/blog/");
  assert.equal(urlForFile("about.html"), "/about");
  assert.equal(urlForFile("404.html"), null);
  assert.equal(urlForFile("downloads/a.pdf"), "/downloads/a.pdf");
  assert.deepEqual(parseUrlList("# c\n/\n\n/about # moved?\n"), ["/", "/about"]);
  assert.deepEqual(noindexPaths("/thank-you/*\n  X-Robots-Tag: noindex\n/*\n  X-Robots-Tag: noindex\n"), ["/thank-you/"]);
});

test("scan records URLs, services, fonts, forms, inline styles and images", () => {
  const root = oldSite("migrate-scan");
  const scan = scanOldSite(root);
  assert.deepEqual(scan.urls.map((u) => u.url), ["/", "/about", "/blog/first-post/", "/downloads/checklist.pdf", "/services", "/thank-you/"]);
  assert.deepEqual(scan.fonts, ["Figtree"]);
  assert.deepEqual(scan.services.map((s) => `${s.type} ${s.host}`), ["stylesheet fonts.googleapis.com", "script www.googletagmanager.com"]);
  assert.deepEqual(scan.inline.map((s) => s.name).sort(), ["Google Analytics / Tag Manager (analytics)", "api.forms.example.org"]);
  assert.deepEqual(scan.forms[0].sensitive, ["medications"]);
  assert.equal(scan.pages.find((p) => p.url === "/about").styleAttrs, 1);
  assert.match(scan.images[0].problem, /\.bmp isn't a web image format/);
  const report = formatMigrationReport(scan, { date: "2026-11-24" });
  assert.match(report, /6 URLs are recorded in `migration\/old-urls\.txt`/);
  assert.match(report, /1 page is a `name\.html` file \(about\.html\)/);
  assert.match(report, /The old `_redirects` has 1 rule/);
  assert.match(report, /\*\*Asks for medications: the sensitive-fields check will fail/);
  assert.match(report, /\| \/about \| 1 \| 0 \| 0 \|/);
  assert.match(report, /images\/photo\.bmp: \.bmp isn't a web image format/);
});

test("missingText finds old text blocks the new page lacks, ignoring header, footer and typography", () => {
  const before = oldPage("About", "<h1>About us</h1><p>Our team’s carers are awake all night.</p><p>We have a piano.</p>");
  const after = "<html><body><header>Home</header><main><h1>About us</h1><p>Our team's carers are   awake all night.</p></main><footer>Example Care Home</footer></body></html>";
  const r = missingText(before, after);
  assert.equal(r.total, 3);
  assert.deepEqual(r.missing, ["We have a piano."]);
});

test("init records the old site and scaffolds a site that passes every check once its pages are converted", async () => {
  const root = oldSite("migrate-init");
  const r = await runInit({ root, care: true, port: 8090, name: "Example Care Home", now: new Date("2026-11-24T12:00:00Z") });
  assert.ok(r.ok, r.lines.join("\n"));
  for (const f of ["migration/old-urls.txt", "MIGRATION.md", "site-kit.config.js", "eleventy.config.js", "src/_data/site.js", "src/_includes/base.njk", "src/404.njk", "src/sitemap.njk", "src/_headers", "src/_redirects", "package.json", "CLAUDE.md", "SITE.md", ".claude/settings.json", ".github/workflows/site-kit.yml"]) {
    assert.ok(existsSync(join(root, f)), f);
  }
  const headers = readFileSync(join(root, "src", "_headers"), "utf8");
  assert.ok(headers.startsWith(OLD_SITE._headers), headers);
  assert.match(headers, /the old headers had no Content-Security-Policy\.\n\/\*\n  Content-Security-Policy: default-src 'self'/);
  const { config } = await loadConfig(root);
  assert.equal(config.site.url, "https://www.example.com");
  assert.equal(config.previewPort, 8090);
  assert.equal(config.claude.care, true);
  assert.deepEqual(config.fonts, ["Figtree"]);
  assert.deepEqual(config.allowedHosts, []);
  assert.deepEqual(config.sitemap.exclude, ["/thank-you/", "/404.html"]);
  assert.equal(config.migration.oldUrls, "migration/old-urls.txt");
  assert.match(readFileSync(join(root, "site-kit.config.js"), "utf8"), /\/\/ +www\.googletagmanager\.com \(script\)/);
  assert.match(readFileSync(join(root, "CLAUDE.md"), "utf8"), /@node_modules\/site-kit\/CLAUDE\.care\.md/);
  assert.equal(JSON.parse(readFileSync(join(root, "package.json"), "utf8")).scripts.test, "site-kit test");
  assert.match(r.lines.join("\n"), /npm@10\.9\.9 npm install --save-dev @11ty\/eleventy github:scottgroup-sites\/site-kit#v\d+\.\d+\.\d+/);
  // Stand in for the npm install: without its own package.json the copy resolves site-kit from the kit.
  rmSync(join(root, "package.json"));

  // Two pages converted: only the URLs that are still missing fail, and every other check passes.
  write(root, "src/index.njk", njk("Home", "<h1>Welcome</h1>\n<p>A small home with a big garden.</p>"));
  write(root, "src/about/index.njk", njk("About", "<h1>About us</h1>\n<p>Our team has cared for older adults for many years.</p>"));
  const partial = await runTest({ root, siteTests: false });
  assert.ok(partial.json.failures, partial.report);
  assert.deepEqual(partial.json.failures.map((f) => `${f.check} ${f.page}`), ["urls /blog/first-post/", "urls /downloads/checklist.pdf", "urls /thank-you/"], partial.report);

  const compare = await runCompare({ root });
  assert.equal(compare.ok, false);
  const comparison = readFileSync(join(root, "migration", "content-comparison.md"), "utf8");
  assert.match(comparison, /## \/about\n\n2 of 4 text blocks missing:\n\n- Home-cooked meals\n- Garden walks/);
  assert.match(comparison, /## \/blog\/first-post\/\n\n\*\*No new page and no redirect yet\.\*\*/);

  write(root, "src/blog/first-post/index.njk", njk("First post", "<h1>First post</h1>\n<p>Hello.</p>"));
  write(root, "src/thank-you/index.njk", "---\nlayout: base.njk\nnoindex: true\ntitle: Thank you — Example Care Home\ndescription: Thanks.\n---\n<h1>Thank you</h1>\n<p>We will call you.</p>\n");
  write(root, "src/_redirects", `${OLD_SITE._redirects}/downloads/checklist.pdf /about 301\n`);
  const done = await runTest({ root, siteTests: false });
  assert.equal(done.ok, true, done.report);
  rmSync(join(KIT_ROOT, ".tmp", "migrate-init"), { recursive: true, force: true });
});

test("init never overwrites, and refuses a repo that already uses site-kit", async () => {
  const root = oldSite("migrate-init-keep");
  write(root, "eleventy.config.js", "// mine\n");
  write(root, "package.json", '{ "name": "x", "scripts": {} }\n');
  const r = await runInit({ root, url: "https://www.example.org/" });
  assert.ok(r.ok, r.lines.join("\n"));
  assert.equal(readFileSync(join(root, "eleventy.config.js"), "utf8"), "// mine\n");
  assert.match(r.lines.join("\n"), /kept: package\.json; add "type": "module", "build": "eleventy"/);
  assert.equal((await loadConfig(root)).config.site.url, "https://www.example.org");
  const again = await runInit({ root });
  assert.equal(again.ok, false);
  assert.match(again.lines[0], /already has site-kit\.config\.js/);
});

test("init asks for --url when the old pages don't say, and scan needs pages", async () => {
  const root = join(KIT_ROOT, ".tmp", "migrate-empty");
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
  assert.equal(guessSiteUrl(root), null);
  const r = await runInit({ root });
  assert.equal(r.ok, false);
  assert.match(r.lines[0], /--url https:\/\/www\.example\.com/);
  assert.match(runScan({ root }).message, /No \.html pages found/);
});
