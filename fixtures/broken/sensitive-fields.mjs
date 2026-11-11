import { edit } from "./_edit.mjs";
export function mutate(dir) {
  edit(dir, "src/contact/index.njk", '  <p><button type="submit">Send message</button></p>', '  <p>\n    <label for="diagnosis">Diagnosis</label>\n    <input id="diagnosis" name="diagnosis" type="text">\n  </p>\n  <p><button type="submit">Send message</button></p>');
}
