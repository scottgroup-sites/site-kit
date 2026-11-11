export const id = "hosts";
export const browser = false;

const REFS = [
  ["script", "script[src]", "src"],
  ["stylesheet", 'link[rel="stylesheet"][href]', "href"],
  ["iframe", "iframe[src]", "src"],
  ["img", "img[src]", "src"],
  ["form", "form[action]", "action"],
];

export async function run({ pages, loadPage, config }) {
  const problems = [];
  for (const page of pages) {
    const doc = loadPage(page);
    for (const [type, selector, attr] of REFS) {
      for (const el of doc.querySelectorAll(selector)) {
        const ref = el.getAttribute(attr);
        if (!/^(https?:)?\/\//i.test(ref)) continue;
        const host = new URL(ref, "https://x").host;
        if (config.allowedHosts.some((h) => h.host === host && h.types.includes(type))) continue;
        problems.push({ page, message: `Loads a ${type} from ${host}, which isn't an approved service. A developer must approve it in site-kit.config.js.` });
      }
    }
  }
  return problems;
}
