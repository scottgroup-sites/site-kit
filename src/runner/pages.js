import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseHTML } from "linkedom";

export function fileForUrl(outDir, url) {
  const raw = url.split("#")[0].split("?")[0];
  let clean;
  try {
    clean = decodeURIComponent(raw);
  } catch {
    clean = raw; // malformed escape such as "100%": treat it as a literal path, which will not exist
  }
  return clean.endsWith("/") ? join(outDir, clean, "index.html") : join(outDir, clean);
}

export function builtPages(outDir, prefix = "/") {
  const out = [];
  for (const name of readdirSync(join(outDir, prefix))) {
    const full = join(outDir, prefix, name);
    if (statSync(full).isDirectory()) out.push(...builtPages(outDir, `${prefix}${name}/`));
    else if (name === "index.html") out.push(prefix);
    else if (name.endsWith(".html")) out.push(`${prefix}${name}`);
  }
  return out.sort();
}

export function createPageLoader(outDir) {
  const cache = new Map();
  return (url) => {
    if (!cache.has(url)) {
      const file = fileForUrl(outDir, url);
      if (!existsSync(file) || !statSync(file).isFile()) throw new Error(`Page not built: ${url}`);
      cache.set(url, parseHTML(readFileSync(file, "utf8")).document);
    }
    return cache.get(url);
  };
}

export const isNoindex = (doc) => /noindex/i.test(doc.querySelector('meta[name="robots"]')?.getAttribute("content") ?? "");
