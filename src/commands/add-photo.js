import { existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { loadConfig } from "../config.js";

const MAX_SIDE = 1600;

export async function addPhoto({ root, input, name: rawName }) {
  if (!input || !rawName) return { ok: false, message: "Usage: site-kit add-photo <path-to-photo> <name>   (e.g. front-porch)" };
  const name = rawName.toLowerCase().replace(/\.[a-z0-9]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!name) return { ok: false, message: "Choose a name with letters or numbers, e.g. front-porch." };
  if (!existsSync(input)) return { ok: false, message: `Can't find the photo: ${input}` };
  let config;
  try {
    ({ config } = await loadConfig(root));
  } catch (err) {
    return { ok: false, message: err.message };
  }
  const budget = config.budgets.imageFile;
  const dir = join(root, "src", "assets", "img");
  const out = join(dir, `${name}.jpg`);
  if (existsSync(out)) return { ok: false, message: `src/assets/img/${name}.jpg already exists. Choose a different name.` };
  try {
    await sharp(input).metadata();
  } catch {
    return { ok: false, message: "That file isn't a photo format site-kit can read. Save or export it as a JPEG first (iPhone HEIC photos included)." };
  }
  mkdirSync(dir, { recursive: true });
  let quality = 78;
  let info;
  do {
    info = await sharp(input)
      .rotate()
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality, mozjpeg: true })
      .toFile(out);
    quality -= 8;
  } while (statSync(out).size > budget && quality >= 46);
  const kb = Math.round(statSync(out).size / 1024);
  if (statSync(out).size > budget) {
    rmSync(out, { force: true });
    return { ok: false, message: `Couldn't get src/assets/img/${name}.jpg under the ${config.budgetLabels.imageFile} limit (it was still ${kb} KB). Try a smaller or simpler photo.` };
  }
  const tag = `<img src="/assets/img/${name}.jpg" width="${info.width}" height="${info.height}" alt="DESCRIBE THE PHOTO" loading="lazy">`;
  return { ok: true, message: `Saved src/assets/img/${name}.jpg (${info.width}×${info.height}, ${kb} KB)`, tag };
}
