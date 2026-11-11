import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { KIT_ROOT } from "./helpers.js";

const files = ["CLAUDE.base.md", "CLAUDE.care.md", "README.md", "CHANGELOG.md", ...(function walk(dir) {
  return readdirSync(join(KIT_ROOT, dir)).flatMap((n) => statSync(join(KIT_ROOT, dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]);
})("templates")].filter((f) => { try { statSync(join(KIT_ROOT, f)); return true; } catch { return false; } });

test("public files describe roles, never people or skills", () => {
  for (const f of files) {
    const text = readFileSync(join(KIT_ROOT, f), "utf8");
    assert.doesNotMatch(text, /not (very )?tech(nical|-savvy)|non-technical/i, f);
  }
});

test("settings template protects the right files and runs the hook", () => {
  const s = JSON.parse(readFileSync(join(KIT_ROOT, "templates", "settings.json"), "utf8").replaceAll("{{productionBranch}}", "main"));
  for (const rule of ["Edit(/tests/**)", "Edit(/site-kit.config.js)", "Edit(/CLAUDE.md)", "Edit(/.claude/**)", "Edit(/.github/**)", "Edit(/.gitattributes)", "Edit(/src/_headers)", "Edit(/eleventy.config.js)", "Edit(/eleventy.config.mjs)", "Edit(/eleventy.config.cjs)", "Edit(/.eleventy.js)", "Edit(/package.json)", "Edit(/package-lock.json)", "Bash(git push origin main*)", "Bash(git push -f*)", "Bash(git push --force*)", "Bash(git reset --hard*)"]) {
    assert.ok(s.permissions.deny.includes(rule), rule);
  }
  assert.equal(s.hooks.Stop[0].hooks[0].command, 'node "$CLAUDE_PROJECT_DIR/node_modules/site-kit/bin/site-kit.mjs" hook');
});

test("workflow template runs on Ubuntu and Windows with named checks", () => {
  const yml = readFileSync(join(KIT_ROOT, "templates", "workflow.yml"), "utf8");
  assert.match(yml, /os: \[ubuntu-latest, windows-latest\]/);
  assert.match(yml, /name: site-kit \(\$\{\{ matrix\.os \}\}\)/);
  assert.match(yml, /sync --check/);
  assert.match(yml, /permissions:\n  contents: read/);
  assert.match(yml, /Stop hook blocks a broken change/);
  assert.match(yml, /test "\$code" -eq 2/);
});

test("guidance covers photo rights, npm 10 and real preview links", () => {
  const base = readFileSync(join(KIT_ROOT, "CLAUDE.base.md"), "utf8");
  assert.match(base, /right to use/);
  assert.match(base, /npm@10/);
  const skill = readFileSync(join(KIT_ROOT, "templates", "skills", "send-for-review", "SKILL.md"), "utf8");
  assert.match(skill, /gh pr view --comments/);
  assert.match(skill, /dash\.cloudflare\.com/);
  assert.match(skill, /gh pr checks --watch/);
});
