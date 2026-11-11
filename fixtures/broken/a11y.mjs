import { append } from "./_edit.mjs";
export function mutate(dir) {
  append(dir, "src/assets/css/styles.css", "\n.low-contrast { color: #c8c8c8; }\n");
  append(dir, "src/about/index.njk", '\n<p class="low-contrast">Faint text that is hard to read.</p>\n');
}
