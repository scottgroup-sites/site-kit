import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { rmSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { buildSite } from "../src/runner/build.js";
import { serveSite } from "../src/runner/serve.js";
import { launchBrowser } from "../src/runner/browser.js";
import { copyDemo } from "./helpers.js";

let build, server, browser;
before(async () => {
  const dir = copyDemo("tooltip");
  appendFileSync(join(dir, "src", "about", "index.njk"), '\n<p>Short words here and then {% flag "NEW", "A long note that would overflow the right edge of a phone screen if it were anchored to the flag" %}right side{% endflag %}</p>\n');
  build = buildSite(dir, { mode: "show" });
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

test("on a phone the note is a strip inside the screen, even for a flag on the right", async () => {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto(`${server.url}/about/`);
  const flag = page.locator(".site-kit-flag").last();
  const left = await flag.evaluate((f) => f.getBoundingClientRect().left);
  assert.ok(left > 187, `flag should sit in the right half, left is ${left}`);
  await flag.tap();
  const m = await page.evaluate(() => {
    const r = [...document.querySelectorAll(".site-kit-flag__note")].find((n) => getComputedStyle(n).display !== "none").getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, w: window.innerWidth, h: window.innerHeight, scrollW: document.documentElement.scrollWidth };
  });
  assert.ok(m.left >= 0 && m.right <= m.w, `note ${m.left}..${m.right} within 0..${m.w}`);
  assert.ok(m.top >= 0 && m.bottom <= m.h, `note ${m.top}..${m.bottom} within 0..${m.h}`);
  assert.ok(m.scrollW <= m.w, `page scrollWidth ${m.scrollW} should not exceed ${m.w}`);
  await context.close();
});
