import { AxeBuilder } from "@axe-core/playwright";

export const id = "a11y";
export const browser = true;

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "phone", width: 375, height: 812 },
];

export async function run({ pages, browser: chrome, serverUrl }) {
  const problems = [];
  for (const page of pages) {
    for (const vp of VIEWPORTS) {
      const context = await chrome.newContext({ viewport: { width: vp.width, height: vp.height } });
      const tab = await context.newPage();
      await tab.goto(serverUrl + page, { waitUntil: "load" });
      const results = await new AxeBuilder({ page: tab })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
        .exclude("iframe")
        .analyze();
      for (const v of results.violations) {
        problems.push({ page, message: `${v.help} (${vp.name}; ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")})` });
      }
      if (vp.name === "phone") {
        const overflow = await tab.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        if (overflow > 0) problems.push({ page, message: `The page scrolls sideways on a phone (${overflow}px too wide).` });
      }
      await context.close();
    }
  }
  return problems;
}
