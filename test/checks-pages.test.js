import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPageLoader, builtPages, fileForUrl } from "../src/runner/pages.js";
import { validateConfig } from "../src/config.js";
import * as links from "../src/checks/links.js";
import * as structure from "../src/checks/structure.js";
import * as consistency from "../src/checks/consistency.js";
import * as sitemap from "../src/checks/sitemap.js";

const page = ({ title = "Home — Example", description = "A description that is comfortably longer than fifty characters in total.", canonical = "https://www.example.com/", body = "<h1>Hi</h1>", nav = '<a href="/">Home</a><a href="/about/">About</a>', footer = '<p>(555) 010-0100</p><a href="/privacy/">Privacy</a>' } = {}) =>
  `<!DOCTYPE html><html lang="en"><head><title>${title}</title><meta name="description" content="${description}"><link rel="canonical" href="${canonical}"></head><body><a href="#main">Skip to main content</a><header><nav>${nav}</nav></header><main id="main">${body}</main><footer>${footer}</footer></body></html>`;

function site(files) {
  const out = mkdtempSync(join(tmpdir(), "site-kit-check-"));
  for (const [rel, html] of Object.entries(files)) {
    mkdirSync(join(out, rel, ".."), { recursive: true });
    writeFileSync(join(out, rel), html);
  }
  const { config } = validateConfig({ site: { url: "https://www.example.com" }, footer: { text: ["(555) 010-0100"], links: ["/privacy/"] } });
  return { root: out, outDir: out, config, pages: builtPages(out), loadPage: createPageLoader(out), fileForUrl: (u) => fileForUrl(out, u) };
}

const good = () => ({
  "index.html": page(),
  "about/index.html": page({ title: "About — Example", description: "About this example site, which is also longer than fifty characters.", canonical: "https://www.example.com/about/", body: '<h1>About</h1><p id="team">Team</p>' }),
  "privacy/index.html": page({ title: "Privacy — Example", description: "Privacy information for this example, longer than fifty characters too.", canonical: "https://www.example.com/privacy/" }),
  "sitemap.xml": "<urlset><url><loc>https://www.example.com/</loc></url><url><loc>https://www.example.com/about/</loc></url><url><loc>https://www.example.com/privacy/</loc></url></urlset>",
});

test("a clean site passes all four checks", async () => {
  const ctx = site(good());
  for (const check of [links, structure, consistency, sitemap]) assert.deepEqual(await check.run(ctx), [], check.id);
});

test("links: missing pages and missing anchors", async () => {
  const files = good();
  files["index.html"] = page({ body: '<h1>Hi</h1><a href="/nope/">x</a><a href="/about/#missing">y</a><a href="/about/#team">z</a>' });
  const found = await links.run(site(files));
  assert.deepEqual(found.map((f) => f.message), ["Links to /nope/, which doesn't exist.", "Links to /about/#missing, but /about/ has no element with id \"missing\"."]);
});

test("structure: headings, skip link, description, canonical, duplicates", async () => {
  const files = good();
  files["about/index.html"] = page({ title: "Home — Example", description: "Short", canonical: "https://www.example.com/wrong/", body: "<h1>A</h1><h1>B</h1>" });
  const messages = (await structure.run(site(files))).map((f) => f.message);
  assert.ok(messages.some((m) => /exactly one main heading \(h1\); this page has 2/.test(m)));
  assert.ok(messages.some((m) => /meta description should be 50–160 characters; it's 5/.test(m)));
  assert.ok(messages.some((m) => /canonical link should be https:\/\/www\.example\.com\/about\//.test(m)));
  assert.ok(messages.some((m) => /Same title as \//.test(m)));
});

test("consistency: menu differs and footer details missing", async () => {
  const files = good();
  files["about/index.html"] = page({ title: "About — Example", description: "About this example site, which is also longer than fifty characters.", canonical: "https://www.example.com/about/", nav: '<a href="/">Home</a>', footer: "<p>Nothing</p>" });
  const messages = (await consistency.run(site(files))).map((f) => f.message);
  assert.ok(messages.some((m) => /main menu differs from the home page's/.test(m)));
  assert.ok(messages.includes('The footer is missing "(555) 010-0100".'));
  assert.ok(messages.includes("The footer is missing a link to /privacy/."));
});

test("links: other URI schemes and bare # links are not file references", async () => {
  const files = good();
  files["index.html"] = page({ body: '<h1>Hi</h1><a href="#">Top</a><a href="#top">Top</a><a href="javascript:void(0)">J</a><a href="ftp://example.com/x">F</a><a href="whatsapp://send">W</a>' });
  assert.deepEqual(await links.run(site(files)), []);
});

test("sitemap: a bare origin counts as the home page and &amp; is decoded", async () => {
  const files = good();
  files["sitemap.xml"] = "<urlset><url><loc>https://www.example.com</loc></url><url><loc>https://www.example.com/about/</loc></url><url><loc>https://www.example.com/privacy/</loc></url></urlset>";
  assert.deepEqual(await sitemap.run(site(files)), []);
  files["sitemap.xml"] = "<urlset><url><loc>https://www.example.com/a?x=1&amp;y=2</loc></url></urlset>";
  const messages = (await sitemap.run(site(files))).map((f) => `${f.page} ${f.message}`);
  assert.ok(messages.includes("(site) sitemap.xml lists /a?x=1&y=2, which doesn't exist."));
});

test("sitemap: missing pages, unknown pages and duplicates", async () => {
  const files = good();
  files["sitemap.xml"] = "<urlset><url><loc>https://www.example.com/</loc></url><url><loc>https://www.example.com/</loc></url><url><loc>https://www.example.com/gone/</loc></url></urlset>";
  const found = await sitemap.run(site(files));
  const messages = found.map((f) => `${f.page} ${f.message}`);
  assert.ok(messages.includes("(site) sitemap.xml lists / more than once."));
  assert.ok(messages.includes("(site) sitemap.xml lists /gone/, which doesn't exist."));
  assert.ok(messages.includes("/about/ This page is missing from sitemap.xml."));
});
