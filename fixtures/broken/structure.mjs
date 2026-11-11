import { edit } from "./_edit.mjs";
export function mutate(dir) {
  edit(dir, "src/about/index.njk", "description: Learn about Example Care Home, a small residential care home with a homely setting and a dedicated team.", "description: Too short.");
}
