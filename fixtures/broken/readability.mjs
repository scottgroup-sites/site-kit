import { append } from "./_edit.mjs";
export function mutate(dir) {
  append(dir, "src/assets/css/styles.css", "\n.tiny-print { font-size: 11px; }\n");
  append(dir, "src/about/index.njk", '\n<p class="tiny-print">Tiny print.</p>\n');
}
