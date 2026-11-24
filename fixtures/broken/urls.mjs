import { create, edit } from "./_edit.mjs";
export function mutate(dir) {
  // A migrated site whose old /services.html page has no new page and no redirect.
  edit(dir, "site-kit.config.js", "sitemap:", 'migration: { oldUrls: "migration/old-urls.txt" },\n  sitemap:');
  create(dir, "migration/old-urls.txt", "# old URLs\n/\n/about\n/contact/\n/services\n");
}
