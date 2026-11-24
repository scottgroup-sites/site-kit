import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

// Removes /* comments */ (keeping /*! licence */ ones) and blank lines. Quoted strings are left
// alone, so "/*" inside them survives. Rules are never rewritten.
export function stripCssComments(css) {
  let out = "";
  let i = 0;
  while (i < css.length) {
    const c = css[i];
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < css.length && css[j] !== c) j += css[j] === "\\" ? 2 : 1;
      out += css.slice(i, j + 1);
      i = j + 1;
    } else if (c === "/" && css[i + 1] === "*") {
      const end = css.indexOf("*/", i + 2);
      const stop = end === -1 ? css.length : end + 2;
      if (css[i + 2] === "!") out += css.slice(i, stop);
      i = stop;
    } else {
      out += c;
      i++;
    }
  }
  return out.replace(/[ \t]+$/gm, "").replace(/\n{2,}/g, "\n").replace(/^\n/, "");
}

async function cssFiles(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await cssFiles(full)));
    else if (e.name.toLowerCase().endsWith(".css")) out.push(full);
  }
  return out;
}

// Strips comments from every built stylesheet, so source comments don't count against the CSS budget.
export async function stripBuiltCss(outDir) {
  for (const file of await cssFiles(outDir)) {
    const css = await readFile(file, "utf8");
    const stripped = stripCssComments(css);
    if (stripped !== css) await writeFile(file, stripped);
  }
}
