import { builtPages as listPages, createPageLoader, fileForUrl as fileFor } from "./runner/pages.js";
import { serveSite as serve } from "./runner/serve.js";
import { buildSite as build } from "./runner/build.js";
export { launchBrowser } from "./runner/browser.js";

function outDir() {
  const dir = process.env.SITE_KIT_OUT_DIR;
  if (!dir) throw new Error("Run site tests with `site-kit test`, which builds the site first.");
  return dir;
}

let loader;
export const builtPages = () => listPages(outDir());
export const loadPage = (url) => (loader ??= createPageLoader(outDir()))(url);
export const fileForUrl = (url) => fileFor(outDir(), url);
export const serveSite = () => serve(outDir());
// Build the current site into a new temp folder in the given flag mode ("show", "hide" or "fail").
export const buildSite = (mode = "show") => build(process.cwd(), { mode });
