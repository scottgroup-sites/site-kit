import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const CHECK_IDS = ["a11y", "html", "links", "structure", "consistency", "performance", "hosts", "csp", "readability", "sitemap", "sensitive-fields"];
export const HOST_TYPES = ["script", "stylesheet", "iframe", "img", "form"];
export const DEFAULT_BUDGETS = { htmlPerPage: "60 KB", pageTotal: "1200 KB", imageFile: "300 KB", cssTotal: "40 KB", jsTotal: "30 KB" };
const KNOWN_KEYS = ["site", "productionBranch", "previewPort", "claude", "flags", "footer", "fonts", "allowedHosts", "budgets", "sitemap", "htmlValidate", "exceptions"];
const SECTION_KEYS = { site: ["url"], claude: ["care"], flags: ["production"], footer: ["text", "links"], sitemap: ["exclude"] };

export class ConfigError extends Error {}

export function parseSize(value) {
  const m = /^(\d+(?:\.\d+)?)\s*(KB|MB)$/i.exec(String(value).trim());
  if (!m) return null;
  return Math.round(Number(m[1]) * (m[2].toUpperCase() === "MB" ? 1024 * 1024 : 1024));
}

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const hasReason = (v) => typeof v?.reason === "string" && v.reason.trim().length > 0;

export function validateConfig(raw) {
  if (!isObject(raw)) throw new ConfigError("site-kit.config.js must export an object: export default { … }.");
  const problems = [];
  const warnings = [];

  for (const key of Object.keys(raw)) if (!KNOWN_KEYS.includes(key)) problems.push(`Unknown setting "${key}".`);

  for (const [name, keys] of Object.entries(SECTION_KEYS)) {
    const section = raw[name];
    if (section === undefined) continue;
    if (!isObject(section)) { problems.push(`${name} must be an object.`); continue; }
    for (const k of Object.keys(section)) if (!keys.includes(k)) problems.push(`Unknown setting "${name}.${k}".`);
  }

  const url = typeof raw.site?.url === "string" ? raw.site.url.replace(/\/$/, "") : "";
  if (!/^https:\/\/[^/\s]+$/.test(url)) problems.push('site.url must be the site\'s https origin, e.g. "https://www.example.com".');

  const productionBranch = raw.productionBranch ?? "main";
  if (typeof productionBranch !== "string" || !productionBranch) problems.push("productionBranch must be a branch name.");

  const previewPort = raw.previewPort ?? 8080;
  if (!Number.isInteger(previewPort) || previewPort < 1024 || previewPort > 65535) problems.push("previewPort must be a whole number between 1024 and 65535.");

  const care = raw.claude?.care ?? false;
  if (typeof care !== "boolean") problems.push("claude.care must be true or false.");

  const production = raw.flags?.production ?? "fail";
  if (!["fail", "hide"].includes(production)) problems.push('flags.production must be "fail" or "hide".');

  const footer = { text: raw.footer?.text ?? [], links: raw.footer?.links ?? [] };
  if (!Array.isArray(footer.text) || !footer.text.every((s) => typeof s === "string" && s)) problems.push("footer.text must be a list of text snippets.");
  if (!Array.isArray(footer.links) || footer.links.some((l) => typeof l !== "string" || !l.startsWith("/"))) problems.push('footer.links must be a list of paths like "/privacy/".');

  const fonts = raw.fonts ?? [];
  if (!Array.isArray(fonts) || !fonts.every((s) => typeof s === "string" && s)) problems.push("fonts must be a list of font family names.");

  const allowedHosts = raw.allowedHosts ?? [];
  if (!Array.isArray(allowedHosts)) problems.push("allowedHosts must be a list.");
  else allowedHosts.forEach((h, i) => {
    if (typeof h?.host !== "string" || !/^[a-z0-9.-]+$/i.test(h.host)) problems.push(`allowedHosts[${i}].host must be a host name like "cdn.example.org" (no https://).`);
    if (!Array.isArray(h?.types) || !h.types.length || !h.types.every((t) => HOST_TYPES.includes(t))) problems.push(`allowedHosts[${i}].types must list one or more of: ${HOST_TYPES.join(", ")}.`);
    if (!hasReason(h)) problems.push(`allowedHosts[${i}].reason must say why this service is approved.`);
  });

  const budgets = {};
  const budgetLabels = {};
  const rawBudgets = raw.budgets ?? {};
  for (const key of Object.keys(rawBudgets)) if (!(key in DEFAULT_BUDGETS)) problems.push(`budgets.${key} isn't a known budget (${Object.keys(DEFAULT_BUDGETS).join(", ")}).`);
  for (const [key, def] of Object.entries(DEFAULT_BUDGETS)) {
    const label = rawBudgets[key] ?? def;
    const bytes = parseSize(label);
    if (bytes === null) { problems.push(`budgets.${key} must be a size like "300 KB" or "1.2 MB".`); continue; }
    budgets[key] = bytes;
    budgetLabels[key] = label;
    if (bytes > parseSize(def)) warnings.push(`Budget ${key} is ${label}, above the default ${def}.`);
  }

  const exclude = raw.sitemap?.exclude ?? [];
  if (!Array.isArray(exclude) || exclude.some((p) => typeof p !== "string" || !p.startsWith("/"))) problems.push('sitemap.exclude must be a list of paths like "/thank-you/".');

  const htmlValidate = raw.htmlValidate ?? [];
  if (!Array.isArray(htmlValidate)) problems.push("htmlValidate must be a list of rule changes.");
  else htmlValidate.forEach((r, i) => {
    if (typeof r?.rule !== "string" || !r.rule) problems.push(`htmlValidate[${i}].rule must name an html-validate rule.`);
    if (!["off", "warn", "error"].includes(r?.level)) problems.push(`htmlValidate[${i}].level must be "off", "warn" or "error".`);
    if (!hasReason(r)) problems.push(`htmlValidate[${i}].reason must say why the rule is changed.`);
  });

  const exceptions = raw.exceptions ?? [];
  if (!Array.isArray(exceptions)) problems.push("exceptions must be a list.");
  else exceptions.forEach((e, i) => {
    if (!CHECK_IDS.includes(e?.check)) problems.push(`exceptions[${i}].check must be one of: ${CHECK_IDS.join(", ")}.`);
    if (typeof e?.page !== "string" || !(e.page === "*" || e.page.startsWith("/"))) problems.push(`exceptions[${i}].page must be a page path like "/about/" or "*" for every page.`);
    if (!hasReason(e)) problems.push(`exceptions[${i}].reason must say why the exception is needed.`);
  });

  if (problems.length) throw new ConfigError(`site-kit.config.js has ${problems.length} problem${problems.length === 1 ? "" : "s"}:\n${problems.map((p) => `  - ${p}`).join("\n")}`);

  return {
    config: {
      site: { url },
      productionBranch,
      previewPort,
      claude: { care },
      flags: { production },
      footer,
      fonts,
      allowedHosts: allowedHosts.map((h) => ({ ...h, host: h.host.toLowerCase() })),
      budgets,
      budgetLabels,
      sitemap: { exclude },
      htmlValidate,
      exceptions,
    },
    warnings,
  };
}

export async function loadConfig(root) {
  const file = join(root, "site-kit.config.js");
  if (!existsSync(file)) throw new ConfigError(`No site-kit.config.js in ${root}. Every site needs one; see the site-kit README.`);
  let mod;
  try {
    mod = await import(`${pathToFileURL(file).href}?t=${Date.now()}`);
  } catch (err) {
    throw new ConfigError(`site-kit.config.js couldn't be loaded: ${err.message}`);
  }
  return validateConfig(mod.default);
}
