import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { buildSite } from "../src/runner/build.js";
import { serveSite } from "../src/runner/serve.js";
import { launchBrowser } from "../src/runner/browser.js";
import { copyDemo } from "./helpers.js";

let build, server, browser;
before(async () => {
  build = buildSite(copyDemo("tooltip"), { mode: "show" });
  assert.ok(build.ok, build.output);
  server = await serveSite(build.outDir);
  browser = await launchBrowser();
});
after(async () => {
  await browser?.close();
  await server?.close();
  rmSync(build.outDir, { recursive: true, force: true });
});

const noteVisible = (page) => page.$eval(".site-kit-flag__note", (n) => getComputedStyle(n).display !== "none" && n.getBoundingClientRect().height > 0);

test("flag notes stay out of the text flow until hovered, focused or tapped", async () => {
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await context.newPage();
  await page.goto(`${server.url}/about/`);
  assert.equal(await noteVisible(page), false, "hidden at rest");
  await page.hover(".site-kit-flag");
  assert.equal(await noteVisible(page), true, "shown on hover");
  await page.mouse.move(0, 0);
  assert.equal(await noteVisible(page), false, "hidden again after hover");
  await page.focus(".site-kit-flag");
  assert.equal(await noteVisible(page), true, "shown on keyboard focus");
  await context.close();
});

test("a tap shows the note on touch screens", async () => {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto(`${server.url}/about/`);
  await page.tap(".site-kit-flag");
  assert.equal(await noteVisible(page), true, "shown after a tap");
  await context.close();
});

test("the note sits above the text, not inside the line", async () => {
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await context.newPage();
  await page.goto(`${server.url}/about/`);
  await page.hover(".site-kit-flag");
  const { note, flag } = await page.evaluate(() => ({
    note: document.querySelector(".site-kit-flag__note").getBoundingClientRect().bottom,
    flag: document.querySelector(".site-kit-flag").getBoundingClientRect().top,
  }));
  assert.ok(note <= flag, `note bottom ${note} should be at or above flag top ${flag}`);
  await context.close();
});
