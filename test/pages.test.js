import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { builtPages, createPageLoader } from "../src/runner/pages.js";
import { serveSite } from "../src/runner/serve.js";

// A tiny built-site folder: "/", "/about/" (a folder), "/404.html".
function makeSite(dir = mkdtempSync(join(tmpdir(), "site-kit-pages-test-"))) {
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(dir, "about"));
  writeFileSync(join(dir, "index.html"), "<!doctype html><title>Home</title>");
  writeFileSync(join(dir, "about", "index.html"), "<!doctype html><title>About</title>");
  writeFileSync(join(dir, "404.html"), "<!doctype html><title>Missing</title>");
  return dir;
}

test("builtPages lists the built pages, sorted", () => {
  assert.deepEqual(builtPages(makeSite()), ["/", "/404.html", "/about/"]);
});

test("a malformed percent-escape is reported as a missing page, not a crash", () => {
  const loader = createPageLoader(makeSite());
  assert.throws(() => loader("/offers/100%"), (err) => err instanceof Error && !(err instanceof URIError) && err.message === "Page not built: /offers/100%");
});

test("a folder is not a built page", () => {
  const loader = createPageLoader(makeSite());
  assert.throws(() => loader("/about"), { message: "Page not built: /about" });
});

test("the server answers 404 for a malformed percent-escape instead of crashing", async () => {
  const server = await serveSite(makeSite());
  try {
    const res = await fetch(server.url + "/offers/100%25zz%");
    assert.equal(res.status, 404);
  } finally {
    await server.close();
  }
});

test("the server answers 404 for paths that resolve outside the built folder", async () => {
  // secret.txt sits next to the built folder, so "/..%2fsecret.txt" would reach it if unchecked.
  const root = mkdtempSync(join(tmpdir(), "site-kit-pages-root-"));
  writeFileSync(join(root, "secret.txt"), "not for the web");
  const outDir = makeSite(join(root, "site"));
  const server = await serveSite(outDir);
  try {
    const res = await fetch(server.url + "/..%2fsecret.txt");
    assert.equal(res.status, 404);
    assert.notEqual(await res.text(), "not for the web");
  } finally {
    await server.close();
  }
});

test("text responses declare utf-8", async () => {
  const server = await serveSite(makeSite());
  try {
    const res = await fetch(server.url + "/index.html");
    assert.equal(res.headers.get("content-type"), "text/html; charset=utf-8");
  } finally {
    await server.close();
  }
});
