import { edit } from "./_edit.mjs";
export function mutate(dir) {
  edit(dir, "site-kit.config.js", 'text: ["(555) 010-0100", "100 Example Street"]', 'text: ["(555) 010-0100", "100 Example Street", "Open every day"]');
}
