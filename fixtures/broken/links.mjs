import { append } from "./_edit.mjs";
export function mutate(dir) {
  append(dir, "src/about/index.njk", '\n<p><a href="/missing-page/">A page that does not exist</a></p>\n');
}
