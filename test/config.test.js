import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateConfig, parseSize, ConfigError, DEFAULT_BUDGETS, CHECK_IDS, loadConfig } from "../src/config.js";

const minimal = { site: { url: "https://www.example.com" } };

test("allowedHosts hosts are lower-cased", () => {
  const { config } = validateConfig({ site: { url: "https://www.example.com" }, allowedHosts: [{ host: "CDN.Example.org", types: ["script"], reason: "Approved" }] });
  assert.equal(config.allowedHosts[0].host, "cdn.example.org");
});

test("parseSize reads KB and MB", () => {
  assert.equal(parseSize("60 KB"), 60 * 1024);
  assert.equal(parseSize("1.5 MB"), 1.5 * 1024 * 1024);
  assert.equal(parseSize("lots"), null);
});

test("defaults are applied to a minimal config", () => {
  const { config, warnings } = validateConfig(minimal);
  assert.equal(config.site.url, "https://www.example.com");
  assert.equal(config.productionBranch, "main");
  assert.equal(config.previewPort, 8080);
  assert.equal(config.claude.care, false);
  assert.equal(config.flags.production, "fail");
  assert.deepEqual(config.footer, { text: [], links: [] });
  assert.equal(config.budgets.htmlPerPage, 60 * 1024);
  assert.equal(config.budgetLabels.pageTotal, DEFAULT_BUDGETS.pageTotal);
  assert.deepEqual(config.allowedHosts, []);
  assert.deepEqual(config.exceptions, []);
  assert.deepEqual(warnings, []);
});

test("a trailing slash on site.url is removed", () => {
  assert.equal(validateConfig({ site: { url: "https://www.example.com/" } }).config.site.url, "https://www.example.com");
});

test("every problem is reported at once, naming the field", () => {
  assert.throws(
    () => validateConfig({
      site: { url: "http://example.com/page" },
      flags: { production: "maybe" },
      allowedHosts: [{ host: "https://cdn.example.org", types: ["video"] }],
      exceptions: [{ check: "spelling", page: "about" }],
      colour: "red",
    }),
    (err) => {
      assert.ok(err instanceof ConfigError);
      for (const part of ["site.url", "flags.production", "allowedHosts[0].host", "allowedHosts[0].types", "allowedHosts[0].reason", "exceptions[0].check", "exceptions[0].page", "exceptions[0].reason", 'Unknown setting "colour"']) {
        assert.match(err.message, new RegExp(part.replace(/[[\]().]/g, "\\$&")));
      }
      return true;
    },
  );
});

test("budgets above the defaults are allowed with a warning", () => {
  const { config, warnings } = validateConfig({ ...minimal, budgets: { pageTotal: "2 MB" } });
  assert.equal(config.budgets.pageTotal, 2 * 1024 * 1024);
  assert.deepEqual(warnings, ["Budget pageTotal is 2 MB, above the default 1200 KB."]);
});

test("unknown budgets and unreadable sizes are rejected", () => {
  assert.throws(() => validateConfig({ ...minimal, budgets: { fonts: "10 KB" } }), /budgets.fonts/);
  assert.throws(() => validateConfig({ ...minimal, budgets: { imageFile: "big" } }), /budgets.imageFile/);
});

test("html-validate changes and exceptions need reasons", () => {
  assert.throws(() => validateConfig({ ...minimal, htmlValidate: [{ rule: "no-inline-style", level: "off" }] }), /htmlValidate\[0\]\.reason/);
  const { config } = validateConfig({ ...minimal, exceptions: [{ check: "readability", page: "/legal/", reason: "Statutory text" }] });
  assert.equal(config.exceptions[0].check, "readability");
});

test("CHECK_IDS lists the eleven checks", () => {
  assert.deepEqual(CHECK_IDS, ["a11y", "html", "links", "structure", "consistency", "performance", "hosts", "csp", "readability", "sitemap", "sensitive-fields"]);
});

test("unknown keys inside sections are rejected", () => {
  assert.throws(() => validateConfig({ ...minimal, claude: { cares: true } }), /Unknown setting "claude\.cares"/);
  assert.throws(() => validateConfig({ ...minimal, site: { url: "https://www.example.com", name: "x" } }), /Unknown setting "site\.name"/);
  assert.throws(() => validateConfig({ ...minimal, footer: { text: [], links: [], extra: 1 } }), /Unknown setting "footer\.extra"/);
  assert.throws(() => validateConfig({ ...minimal, sitemap: { exclude: [], include: [] } }), /Unknown setting "sitemap\.include"/);
  assert.throws(() => validateConfig({ ...minimal, flags: { production: "fail", preview: true } }), /Unknown setting "flags\.preview"/);
});

test("sections must be objects", () => {
  assert.throws(() => validateConfig({ ...minimal, flags: "hide" }), /flags must be an object/);
  assert.throws(() => validateConfig({ ...minimal, claude: [] }), /claude must be an object/);
  assert.throws(() => validateConfig({ ...minimal, footer: "none" }), /footer must be an object/);
});

test("a missing reason on an exception is reported", () => {
  assert.throws(() => validateConfig({ ...minimal, exceptions: [{ check: "readability", page: "/legal/" }] }), /exceptions\[0\]\.reason/);
});

test("loadConfig reports a missing config file", async () => {
  const dir = mkdtempSync(join(tmpdir(), "site-kit-cfg-"));
  try {
    await assert.rejects(() => loadConfig(dir), (err) => err instanceof ConfigError && /No site-kit\.config\.js/.test(err.message));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("loadConfig loads a valid config file", async () => {
  const dir = mkdtempSync(join(tmpdir(), "site-kit-cfg-"));
  try {
    writeFileSync(join(dir, "site-kit.config.js"), `export default { site: { url: "https://www.example.com" } };\n`);
    const { config } = await loadConfig(dir);
    assert.equal(config.site.url, "https://www.example.com");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("loadConfig wraps a syntax error in the config file", async () => {
  const dir = mkdtempSync(join(tmpdir(), "site-kit-cfg-"));
  try {
    writeFileSync(join(dir, "site-kit.config.js"), `export default { site: { url: "https://www.example.com" `);
    await assert.rejects(() => loadConfig(dir), (err) => {
      assert.ok(err instanceof ConfigError);
      assert.match(err.message, /^site-kit\.config\.js couldn't be loaded: /);
      return true;
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
