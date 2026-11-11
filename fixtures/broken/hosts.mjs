import { append } from "./_edit.mjs";
export function mutate(dir) {
  append(dir, "src/about/index.njk", '\n<p><img src="https://img.example.org/photo.jpg" alt="A photo from an outside service" width="40" height="30"></p>\n');
}
