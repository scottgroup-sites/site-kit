import { append } from "./_edit.mjs";
export function mutate(dir) {
  append(dir, "src/about/index.njk", "\n<span><div>A block element inside an inline one</div></span>\n");
}
