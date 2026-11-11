export const id = "readability";
export const browser = true;

const MIN_ANY_TEXT_PX = 14;
const MIN_BODY_TEXT_PX = 16;
const SMALL_LABELS = ".eyebrow, .post-meta, .field-hint, .site-kit-photo__label";

export async function run({ pages, browser: chrome, serverUrl }) {
  const problems = [];
  for (const page of pages) {
    const context = await chrome.newContext({ viewport: { width: 375, height: 812 } });
    const tab = await context.newPage();
    await tab.goto(serverUrl + page, { waitUntil: "load" });
    const found = await tab.evaluate(({ minAny, minBody, labels }) => {
      const out = [];
      const describe = (el) => `"${el.textContent.trim().replace(/\s+/g, " ").slice(0, 40)}"`;
      for (const el of document.body.querySelectorAll("*")) {
        if (el.closest('[aria-hidden="true"], .visually-hidden, .sr-only, script, style, noscript')) continue;
        const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        if (!ownText || !el.getClientRects().length) continue;
        const style = getComputedStyle(el);
        if (style.visibility === "hidden" || style.display === "none") continue;
        const size = parseFloat(style.fontSize);
        if (size < minAny) out.push(`Text ${describe(el)} is ${size}px; the minimum is ${minAny}px.`);
        else if (el.matches("main p, main li") && !el.matches(labels) && size < minBody) out.push(`Body text ${describe(el)} is ${size}px; body text must be at least ${minBody}px.`);
      }
      return out;
    }, { minAny: MIN_ANY_TEXT_PX, minBody: MIN_BODY_TEXT_PX, labels: SMALL_LABELS });
    await context.close();
    for (const message of found) problems.push({ page, message });
  }
  return problems;
}
