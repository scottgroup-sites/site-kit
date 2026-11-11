import { cpSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const KIT_ROOT = fileURLToPath(new URL("../", import.meta.url));
export const DEMO = join(KIT_ROOT, "fixtures", "demo-site");

// Copies live inside the kit so `site-kit/eleventy` and @11ty/eleventy resolve from the kit's own package.
export function copyDemo(name) {
  const dir = join(KIT_ROOT, ".tmp", name);
  rmSync(dir, { recursive: true, force: true });
  cpSync(DEMO, dir, {
    recursive: true,
    filter: (src) => !/[\\/](_site|node_modules)([\\/]|$)/.test(src) && !src.endsWith("CONTENT-REVIEW.md"),
  });
  return dir;
}
