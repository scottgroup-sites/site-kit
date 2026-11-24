import { append } from "./_edit.mjs";
export function mutate(dir) {
  // The demo's root is 112.5% (18px), so 0.85rem is 15.3px: a near miss for a small label.
  append(dir, "src/assets/css/styles.css", "\n.tiny-print { font-size: 11px; }\n.page-label { font-size: 0.85rem; text-transform: uppercase; }\n");
  append(dir, "src/about/index.njk", '\n<p class="tiny-print">Tiny print.</p>\n<p class="page-label">Our home</p>\n');
}
