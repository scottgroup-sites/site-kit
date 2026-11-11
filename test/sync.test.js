import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { syncFiles, claudeImports, KIT_VERSION } from "../src/commands/sync.js";
import { loadConfig } from "../src/config.js";
import { copyDemo } from "./helpers.js";

test("sync creates managed files, CLAUDE.md and SITE.md, then --check is clean", async () => {
  const root = copyDemo("sync-fresh");
  const { config } = await loadConfig(root);
  const changes = syncFiles(root, config);
  assert.deepEqual(changes.map((c) => c.path).sort(), [
    ".claude/launch.json", ".claude/settings.json", ".claude/skills/new-blog-post/SKILL.md",
    ".claude/skills/new-page/SKILL.md", ".claude/skills/send-for-review/SKILL.md",
    ".gitattributes", ".github/workflows/site-kit.yml", "CLAUDE.md", "SITE.md",
  ]);
  assert.deepEqual(syncFiles(root, config, { check: true }), []);
  const workflow = readFileSync(join(root, ".github/workflows/site-kit.yml"), "utf8");
  assert.match(workflow, new RegExp(`^# Managed by site-kit ${KIT_VERSION.replace(/\./g, "\\.")}\\.`));
  assert.match(workflow, /branches: \[main\]/);
  assert.match(workflow, /\$\{\{ matrix\.os \}\}/);
  const skill = readFileSync(join(root, ".claude/skills/new-page/SKILL.md"), "utf8");
  assert.match(skill, /^---\nname: new-page\n[\s\S]*?---\n\n<!-- Managed by site-kit/);
  assert.match(readFileSync(join(root, ".claude/launch.json"), "utf8"), /"port": 8080/);
  assert.equal(readFileSync(join(root, "CLAUDE.md"), "utf8").split("\n").slice(0, 3).join("\n"), claudeImports(config).join("\n"));
});

test("--check reports drift without changing anything", async () => {
  const root = copyDemo("sync-drift");
  const { config } = await loadConfig(root);
  syncFiles(root, config);
  appendFileSync(join(root, ".gitattributes"), "*.txt text\n");
  const before = readFileSync(join(root, ".gitattributes"), "utf8");
  assert.deepEqual(syncFiles(root, config, { check: true }), [{ path: ".gitattributes", action: "update" }]);
  assert.equal(readFileSync(join(root, ".gitattributes"), "utf8"), before);
});

test("an existing CLAUDE.md keeps its content and gains missing imports; SITE.md is never overwritten", async () => {
  const root = copyDemo("sync-existing");
  const { config } = await loadConfig(root);
  writeFileSync(join(root, "CLAUDE.md"), "@SITE.md\n\n# Site guidance\n\nKeep this.\n");
  writeFileSync(join(root, "SITE.md"), "# My notes\n");
  syncFiles(root, config);
  const claude = readFileSync(join(root, "CLAUDE.md"), "utf8");
  assert.ok(claude.startsWith("@node_modules/site-kit/CLAUDE.base.md\n@node_modules/site-kit/CLAUDE.care.md\n@SITE.md\n"));
  assert.match(claude, /Keep this\./);
  assert.equal(readFileSync(join(root, "SITE.md"), "utf8"), "# My notes\n");
});

test("claudeImports only includes the care rules when enabled", () => {
  assert.deepEqual(claudeImports({ claude: { care: false } }), ["@node_modules/site-kit/CLAUDE.base.md", "@SITE.md"]);
});
