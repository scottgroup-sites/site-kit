import { append } from "./_edit.mjs";
export function mutate(dir) {
  append(dir, "src/about/index.njk", '\n<p><img src="/assets/img/logo.svg" alt="Our logo, again"></p>\n');
}
