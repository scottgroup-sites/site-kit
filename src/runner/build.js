import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

// Eleventy's CLI from the site's own node_modules, falling back to the kit's.
export function eleventyBin(root) {
  for (const base of [join(root, "package.json"), import.meta.url]) {
    try {
      // package.json isn't in Eleventy's exports map, so resolve the main entry (src/…) and step up to the package folder.
      return join(dirname(createRequire(base).resolve("@11ty/eleventy")), "..", "cmd.cjs");
    } catch {
      // try the next location
    }
  }
  throw new Error("Can't find @11ty/eleventy. Run npm install.");
}

export function buildSite(root, { mode = "show", outDir = mkdtempSync(join(tmpdir(), "site-kit-")) } = {}) {
  const r = spawnSync(process.execPath, [eleventyBin(root), "--quiet", `--output=${outDir}`], {
    cwd: root,
    env: { ...process.env, SITE_KIT_FLAGS: mode },
    encoding: "utf8",
  });
  return { ok: r.status === 0, outDir, output: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}
