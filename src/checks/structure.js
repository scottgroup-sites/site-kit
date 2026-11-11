import { isNoindex } from "../runner/pages.js";

export const id = "structure";
export const browser = false;

export async function run({ pages, loadPage, config }) {
  const problems = [];
  const seen = { title: new Map(), description: new Map() };
  for (const page of pages) {
    const doc = loadPage(page);
    const p = (message) => problems.push({ page, message });
    if (!doc.documentElement.getAttribute("lang")) p('The <html> element needs a lang attribute, e.g. lang="en".');
    const h1s = doc.querySelectorAll("h1").length;
    if (h1s !== 1) p(`Pages need exactly one main heading (h1); this page has ${h1s}.`);
    const main = doc.querySelector("main");
    if (!main) p("The page needs a <main> element around its main content.");
    const first = doc.querySelector("body a[href], body button, body input, body select, body textarea");
    const mainId = main?.getAttribute("id");
    if (!mainId || first?.getAttribute("href") !== `#${mainId}`) p("The first link on the page must be a skip link to the main content (href=\"#\" + the <main> element's id).");
    const title = doc.title.trim();
    if (!title) p("The page needs a <title>.");
    if (isNoindex(doc)) continue;
    const description = doc.querySelector('meta[name="description"]')?.getAttribute("content")?.trim() ?? "";
    if (description.length < 50 || description.length > 160) p(`The meta description should be 50–160 characters; it's ${description.length}.`);
    const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute("href");
    const expected = `${config.site.url}${page}`;
    if (canonical !== expected) p(`The canonical link should be ${expected}${canonical ? `, not ${canonical}` : ""}.`);
    for (const [kind, value] of [["title", title], ["description", description]]) {
      if (!value) continue;
      const other = seen[kind].get(value);
      if (other) p(`Same ${kind} as ${other}; each page needs its own.`);
      else seen[kind].set(value, page);
    }
  }
  return problems;
}
