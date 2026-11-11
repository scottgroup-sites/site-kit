import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPageLoader, builtPages, fileForUrl } from "../src/runner/pages.js";
import { validateConfig } from "../src/config.js";
import * as performance from "../src/checks/performance.js";
import * as hosts from "../src/checks/hosts.js";
import * as csp from "../src/checks/csp.js";
import * as sensitive from "../src/checks/sensitive-fields.js";
import * as html from "../src/checks/html.js";

const doc = (body, head = "") => `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>T</title>${head}</head><body><main id="main">${body}</main></body></html>`;

function site(files, raw = {}) {
  const out = mkdtempSync(join(tmpdir(), "site-kit-check-"));
  for (const [rel, content] of Object.entries(files)) {
    mkdirSync(join(out, rel, ".."), { recursive: true });
    writeFileSync(join(out, rel), content);
  }
  const { config } = validateConfig({ site: { url: "https://www.example.com" }, ...raw });
  return { root: out, outDir: out, config, pages: builtPages(out), loadPage: createPageLoader(out), fileForUrl: (u) => fileForUrl(out, u) };
}

test("performance: image attributes, lazy iframes, autoplay, weight, image files, fonts", async () => {
  const ctx = site({
    "index.html": doc('<img src="/a.jpg"><iframe src="https://www.google.com/maps" title="Map"></iframe><video autoplay></video>', '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Other+Font&display=swap">'),
    "a.jpg": Buffer.alloc(400 * 1024),
    "b.bmp": Buffer.alloc(10),
  }, { budgets: { pageTotal: "300 KB" } });
  const messages = (await performance.run(ctx)).map((f) => f.message);
  assert.ok(messages.some((m) => /needs width and height/.test(m)));
  assert.ok(messages.some((m) => /has no alt attribute/.test(m)));
  assert.ok(messages.some((m) => /should have loading="lazy"/.test(m)));
  assert.ok(messages.some((m) => /autoplays/.test(m)));
  assert.ok(messages.some((m) => /page weight is 400 KB \(budget 300 KB\)/.test(m)));
  assert.ok(messages.some((m) => /a\.jpg is 400 KB \(budget 300 KB\)/.test(m)));
  assert.ok(messages.some((m) => /\.bmp isn't a web image format/.test(m)));
  assert.ok(messages.some((m) => /font "Other Font", which isn't in site-kit.config.js/.test(m)));
});

test("hosts: only approved outside services for the right type", async () => {
  const ctx = site({ "index.html": doc('<script src="https://cdn.example.org/x.js"></script><iframe src="https://www.google.com/maps" title="Map" loading="lazy"></iframe><form action="https://forms.example.org/submit"></form>') }, {
    allowedHosts: [{ host: "www.google.com", types: ["iframe"], reason: "Map" }],
  });
  const messages = (await hosts.run(ctx)).map((f) => f.message);
  assert.deepEqual(messages, [
    "Loads a script from cdn.example.org, which isn't an approved service. A developer must approve it in site-kit.config.js.",
    "Loads a form from forms.example.org, which isn't an approved service. A developer must approve it in site-kit.config.js.",
  ]);
});

test("csp: parse, permits, inline scripts and blocked approved hosts", async () => {
  const [{ policy }] = csp.parseCsp("/*\n  Content-Security-Policy: default-src 'self'; frame-src https://*.google.com; form-action 'self'\n");
  assert.ok(csp.permits(policy, "frame-src", "www.google.com"));
  assert.ok(!csp.permits(policy, "script-src", "cdn.example.org"));
  assert.ok(!csp.permits(policy, "form-action", "forms.example.org"));
  const ctx = site({
    "index.html": doc('<script>alert(1)</script><script type="application/ld+json">{}</script><button onclick="x()">x</button>'),
    "_headers": "/*\n  Content-Security-Policy: default-src 'self'\n",
  }, { allowedHosts: [{ host: "www.google.com", types: ["iframe"], reason: "Map" }] });
  const messages = (await csp.run(ctx)).map((f) => f.message);
  assert.ok(messages.some((m) => /inline <script>/.test(m)));
  assert.ok(messages.some((m) => /onclick/.test(m)));
  assert.ok(messages.some((m) => /doesn't allow www\.google\.com for frame-src/.test(m)));
});

test("sensitive-fields: health, insurance and ID questions fail; ordinary fields pass", async () => {
  const ctx = site({ "index.html": doc('<form><label for="d">Diagnosis</label><input id="d" name="d"><input name="medication_list"><label><input type="checkbox" name="terms"> I agree to the terms and conditions</label><input name="email" placeholder="Email"><input type="hidden" name="insurance_token"></form>') });
  const messages = (await sensitive.run(ctx)).map((f) => f.message);
  assert.equal(messages.length, 2);
  assert.match(messages[0], /asks for "Diagnosis"/i);
  assert.match(messages[1], /medication/i);
});

test("sensitive-fields: a field id containing quotes doesn't throw", async () => {
  const ctx = site({ "index.html": doc('<form><label for="a&quot;]b">Diagnosis</label><input id="a&quot;]b" name="x"></form>') });
  const messages = (await sensitive.run(ctx)).map((f) => f.message);
  assert.equal(messages.length, 1);
  assert.match(messages[0], /Diagnosis/);
});

test("csp: warns when src/_headers exists but isn't in the build", async () => {
  const ctx = site({ "index.html": doc("<p>x</p>"), "src/_headers": "/*\n  Content-Security-Policy: default-src 'self'\n" });
  const messages = (await csp.run(ctx)).map((f) => f.message);
  assert.ok(messages.some((m) => /src\/_headers isn't copied into the build/.test(m)));
});

test("html: recommended rules with documented changes", async () => {
  const bad = site({ "index.html": doc("<span><div>Block inside inline</div></span>") });
  assert.ok((await html.run(bad)).some((f) => /element-permitted-content/.test(f.message)));
  const changed = site({ "index.html": doc('<p style="color: red">x</p>') }, { htmlValidate: [{ rule: "no-inline-style", level: "off", reason: "Test" }] });
  assert.deepEqual(await html.run(changed), []);
});

test("csp: only the site-wide /* policy counts; path blocks are ignored", async () => {
  const headers = "/*\n  Content-Security-Policy: default-src 'self'; frame-src https://www.google.com\n/admin/*\n  Content-Security-Policy: default-src 'none'\n";
  assert.deepEqual(csp.parseCsp(headers).map((e) => e.path), ["/*", "/admin/*"]);
  const ctx = site({ "index.html": doc("<p>x</p>"), "_headers": headers }, { allowedHosts: [{ host: "www.google.com", types: ["iframe"], reason: "Map" }] });
  assert.deepEqual(await csp.run(ctx), []);
});

test("csp: _headers with CSP lines but no /* policy is reported", async () => {
  const ctx = site({ "index.html": doc("<p>x</p>"), "_headers": "/admin/*\n  Content-Security-Policy: default-src 'none'\n" }, { allowedHosts: [{ host: "www.google.com", types: ["iframe"], reason: "Map" }] });
  assert.deepEqual((await csp.run(ctx)).map((f) => f.message), ["_headers has no site-wide (/*) Content-Security-Policy."]);
});

test("csp: a blocked host and directive is reported once", async () => {
  const ctx = site({ "index.html": doc("<p>x</p>"), "_headers": "/*\n  Content-Security-Policy: default-src 'self'\n" }, {
    allowedHosts: [
      { host: "www.google.com", types: ["iframe"], reason: "Map" },
      { host: "www.google.com", types: ["iframe"], reason: "Map again" },
    ],
  });
  assert.equal((await csp.run(ctx)).length, 1);
});

test("csp: sources with a path, port or wildcard path match by host", () => {
  const [{ policy }] = csp.parseCsp("/*\n  Content-Security-Policy: default-src 'self'; frame-src https://www.google.com/maps; script-src https://cdn.example.org:443; img-src https://*.example.com/images/\n");
  assert.ok(csp.permits(policy, "frame-src", "www.google.com"));
  assert.ok(csp.permits(policy, "script-src", "cdn.example.org"));
  assert.ok(csp.permits(policy, "img-src", "a.example.com"));
  assert.ok(!csp.permits(policy, "img-src", "example.com"));
  assert.ok(!csp.permits(policy, "frame-src", "maps.example.org"));
});

test("csp: missing _headers is skipped, inline script still reported", async () => {
  const ctx = site({ "index.html": doc("<script>alert(1)</script>") }, { allowedHosts: [{ host: "www.google.com", types: ["iframe"], reason: "Map" }] });
  const messages = (await csp.run(ctx)).map((f) => f.message);
  assert.equal(messages.length, 1);
  assert.match(messages[0], /inline <script>/);
});

test("csp: scheme-less sources, ports and path-only sources match by host", () => {
  const [{ policy }] = csp.parseCsp("/*\n  Content-Security-Policy: img-src *.example.com; script-src example.com:443; frame-src example.com/path; connect-src https://cdn.example.org:*\n");
  assert.ok(csp.permits(policy, "img-src", "www.example.com"));
  assert.ok(!csp.permits(policy, "img-src", "example.com"));
  assert.ok(csp.permits(policy, "script-src", "example.com"));
  assert.ok(csp.permits(policy, "frame-src", "example.com"));
  assert.ok(csp.permits(policy, "connect-src", "cdn.example.org"));
});

test("csp: # comment lines and blank lines do not start a new path", async () => {
  const headers = "/*\n# fonts\n\n  Content-Security-Policy: frame-src https://www.google.com\n";
  assert.deepEqual(csp.parseCsp(headers).map((e) => e.path), ["/*"]);
  const ctx = site({ "index.html": doc("<p>x</p>"), "_headers": headers }, { allowedHosts: [{ host: "www.google.com", types: ["iframe"], reason: "Map" }] });
  assert.deepEqual(await csp.run(ctx), []);
});
