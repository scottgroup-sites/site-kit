import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

export function edit(dir, rel, from, to) {
  const file = join(dir, rel);
  const text = readFileSync(file, "utf8");
  if (!text.includes(from)) throw new Error(`${rel} doesn't contain ${JSON.stringify(from)}`);
  writeFileSync(file, text.replace(from, to));
}

export function append(dir, rel, text) {
  const file = join(dir, rel);
  writeFileSync(file, readFileSync(file, "utf8") + text);
}

export function create(dir, rel, text) {
  const file = join(dir, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}
