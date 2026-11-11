export const id = "consistency";
export const browser = false;

const navLinks = (doc) => {
  const nav = doc.querySelector("header nav") ?? doc.querySelector("nav");
  return nav ? [...nav.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")) : [];
};

export async function run({ pages, loadPage, config }) {
  const problems = [];
  const home = pages.includes("/") ? navLinks(loadPage("/")) : null;
  for (const page of pages) {
    const doc = loadPage(page);
    const p = (message) => problems.push({ page, message });
    if (home) {
      const links = navLinks(doc);
      if (JSON.stringify(links) !== JSON.stringify(home)) p(`The main menu differs from the home page's: expected ${home.join(", ") || "(none)"}, found ${links.join(", ") || "(none)"}.`);
    }
    const footer = doc.querySelector("footer");
    if (!footer) {
      if (config.footer.text.length || config.footer.links.length) p("The page has no <footer>.");
      continue;
    }
    const text = footer.textContent.replace(/\s+/g, " ");
    for (const t of config.footer.text) if (!text.includes(t)) p(`The footer is missing "${t}".`);
    for (const l of config.footer.links) if (!footer.querySelector(`a[href="${l}"]`)) p(`The footer is missing a link to ${l}.`);
  }
  return problems;
}
