import { edit } from "./_edit.mjs";
export function mutate(dir) {
  edit(dir, "site-kit.config.js", "allowedHosts: [],", 'allowedHosts: [{ host: "cdn.example.org", types: ["script"], reason: "Contract test" }],');
}
