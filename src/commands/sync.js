import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const TEMPLATES = fileURLToPath(new URL("../../templates/", import.meta.url));
export const KIT_VERSION = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")).version;

const MANAGED = [
  { from: "workflow.yml", to: ".github/workflows/site-kit.yml", header: "#" },
  { from: "settings.json", to: ".claude/settings.json" },
  { from: "launch.json", to: ".claude/launch.json" },
  { from: "gitattributes", to: ".gitattributes", header: "#" },
  { from: "skills/new-page/SKILL.md", to: ".claude/skills/new-page/SKILL.md", header: "md" },
  { from: "skills/new-blog-post/SKILL.md", to: ".claude/skills/new-blog-post/SKILL.md", header: "md" },
  { from: "skills/send-for-review/SKILL.md", to: ".claude/skills/send-for-review/SKILL.md", header: "md" },
];

const NOTE = `Managed by site-kit ${KIT_VERSION}. Don't edit this copy: change site-kit and run \`site-kit sync\`.`;

function render(text, vars) {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (!(key in vars)) throw new Error(`Unknown template variable ${match}`);
    return String(vars[key]);
  });
}

function withHeader(text, kind) {
  if (kind === "#") return `# ${NOTE}\n${text}`;
  if (kind === "md") {
    const front = /^---\n[\s\S]*?\n---\n/.exec(text);
    return front ? `${front[0]}\n<!-- ${NOTE} -->\n${text.slice(front[0].length)}` : `<!-- ${NOTE} -->\n${text}`;
  }
  return text;
}

export function claudeImports(config) {
  return ["@node_modules/site-kit/CLAUDE.base.md", ...(config.claude.care ? ["@node_modules/site-kit/CLAUDE.care.md"] : []), "@SITE.md"];
}

function desiredFiles(config) {
  const vars = { previewPort: config.previewPort, productionBranch: config.productionBranch, version: KIT_VERSION };
  return MANAGED.map(({ from, to, header }) => [to, withHeader(render(readFileSync(join(TEMPLATES, from), "utf8"), vars), header)]);
}

export function syncFiles(root, config, { check = false } = {}) {
  const changes = [];
  const write = (rel, content, action) => {
    changes.push({ path: rel, action });
    if (check) return;
    const file = join(root, rel);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  };
  for (const [rel, content] of desiredFiles(config)) {
    const file = join(root, rel);
    const current = existsSync(file) ? readFileSync(file, "utf8").replace(/\r\n/g, "\n") : null;
    if (current !== content) write(rel, content, current === null ? "create" : "update");
  }
  const imports = claudeImports(config);
  const claudeFile = join(root, "CLAUDE.md");
  if (!existsSync(claudeFile)) {
    write("CLAUDE.md", `${imports.join("\n")}\n\n# Site guidance\n\nSite-specific guidance for Claude goes here. Shared rules come from the imports above.\n`, "create");
  } else {
    const current = readFileSync(claudeFile, "utf8").replace(/\r\n/g, "\n");
    const lines = current.split("\n");
    if (!imports.every((i) => lines.includes(i))) {
      const rest = lines.filter((l) => !imports.includes(l)).join("\n").replace(/^\n+/, "");
      write("CLAUDE.md", `${imports.join("\n")}\n\n${rest}`, "update");
    }
  }
  if (!existsSync(join(root, "SITE.md"))) write("SITE.md", readFileSync(join(TEMPLATES, "SITE.md"), "utf8"), "create");
  return changes;
}
