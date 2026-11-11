import { existsSync } from "node:fs";

export const id = "links";
export const browser = false;

export async function run({ pages, loadPage, fileForUrl }) {
  const problems = [];
  for (const page of pages) {
    const doc = loadPage(page);
    const refs = [
      ...[...doc.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")),
      ...[...doc.querySelectorAll("img[src], script[src], iframe[src]")].map((e) => e.getAttribute("src")),
      ...[...doc.querySelectorAll('link[rel="stylesheet"][href], link[rel="icon"][href]')].map((e) => e.getAttribute("href")),
    ];
    for (const ref of refs) {
      if (/^[a-z][a-z0-9+.-]*:/i.test(ref) || ref.startsWith("//")) continue;
      if (ref === "#" || ref.toLowerCase() === "#top") continue;
      const [path, hash] = ref.split("#");
      const target = path === "" ? page : new URL(path, `http://x${page}`).pathname;
      if (!existsSync(fileForUrl(target))) {
        problems.push({ page, message: `Links to ${ref}, which doesn't exist.` });
        continue;
      }
      if (hash && (target.endsWith("/") || target.endsWith(".html")) && !loadPage(target).getElementById(hash)) {
        problems.push({ page, message: `Links to ${ref}, but ${target} has no element with id "${hash}".` });
      }
    }
  }
  return problems;
}
