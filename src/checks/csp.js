import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const id = "csp";
export const browser = false;

const DIRECTIVES = { script: "script-src", stylesheet: "style-src", iframe: "frame-src", img: "img-src", form: "form-action" };

// _headers: a line with no leading whitespace is a path pattern; indented Content-Security-Policy lines belong to the latest path.
export function parseCsp(text) {
  const out = [];
  let path = null;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    if (!/^\s/.test(line)) { path = line.trim(); continue; }
    const value = /^\s*Content-Security-Policy:\s*(.+)$/i.exec(line)?.[1];
    if (value && path !== null) out.push({ path, policy: parseDirectives(value) });
  }
  return out;
}

function parseDirectives(value) {
  return Object.fromEntries(value.split(";").map((d) => d.trim().split(/\s+/)).filter((d) => d[0]).map(([name, ...sources]) => [name.toLowerCase(), sources]));
}

// Reduces a source such as "https://*.example.com:443/path", "example.com" or "cdn.example.org:*" to its host pattern.
function sourceMatches(source, host) {
  if (source === "*" || source === "https:") return true;
  const pattern = source.replace(/^https?:\/\//i, "").split("/")[0].replace(/:(\d+|\*)$/, "").toLowerCase();
  if (pattern.startsWith("*.")) return host.endsWith(pattern.slice(1));
  return pattern === host;
}

export function permits(policy, directive, host) {
  let sources = policy[directive];
  if (!sources && directive === "frame-src") sources = policy["child-src"];
  if (!sources && directive !== "form-action") sources = policy["default-src"];
  if (!sources) return true;
  return sources.some((s) => sourceMatches(s, host));
}

export async function run({ pages, loadPage, outDir, config, root }) {
  const problems = [];
  for (const page of pages) {
    const doc = loadPage(page);
    for (const s of doc.querySelectorAll("script:not([src])")) {
      if (s.getAttribute("type") !== "application/ld+json") problems.push({ page, message: "Has an inline <script>. Move the code into a .js file so the Content Security Policy can block injected scripts." });
    }
    for (const el of doc.querySelectorAll("*")) {
      for (const { name } of el.attributes) {
        if (/^on[a-z]+$/.test(name)) problems.push({ page, message: `<${el.localName} ${name}> runs inline code. Attach the handler from a .js file instead.` });
      }
    }
  }
  const file = join(outDir, "_headers");
  if (!existsSync(file)) {
    if (root && existsSync(join(root, "src", "_headers"))) {
      problems.push({ page: "(site)", message: "src/_headers isn't copied into the build, so the live site has no security headers. Add it as a passthrough copy in eleventy.config.js." });
    }
    return problems;
  }
  const entries = parseCsp(readFileSync(file, "utf8"));
  if (!entries.length) {
    problems.push({ page: "(site)", message: "_headers has no Content-Security-Policy." });
    return problems;
  }
  const siteWide = entries.filter((e) => e.path === "/*");
  if (!siteWide.length) {
    problems.push({ page: "(site)", message: "_headers has no site-wide (/*) Content-Security-Policy." });
    return problems;
  }
  const reported = new Set();
  for (const { policy } of siteWide) {
    for (const { host, types } of config.allowedHosts) {
      for (const type of types) {
        const directive = DIRECTIVES[type];
        const key = `${host} ${directive}`;
        if (reported.has(key) || permits(policy, directive, host)) continue;
        reported.add(key);
        problems.push({ page: "(site)", message: `The Content-Security-Policy in _headers doesn't allow ${host} for ${directive}, so the approved ${type} would be blocked on the live site.` });
      }
    }
  }
  return problems;
}
