import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseUrlList } from "../migrate/old-site.js";
import { parseRedirects, redirectFor } from "../migrate/redirects.js";

export const id = "urls";
export const browser = false;

const isFile = (f) => existsSync(f) && statSync(f).isFile();

// Is the old URL still served? Cloudflare Pages serves /name from name.html or (with a redirect to
// /name/) from name/index.html.
function served(fileForUrl, url) {
  const path = url.split(/[?#]/)[0];
  if (isFile(fileForUrl(path))) return true;
  if (path.endsWith("/")) return false;
  return isFile(fileForUrl(`${path}/`)) || isFile(fileForUrl(`${path}.html`));
}

// Only runs on a site being migrated: `migration.oldUrls` names the list `site-kit migrate scan` wrote.
export async function run({ root, outDir, fileForUrl, config }) {
  const listFile = config.migration?.oldUrls;
  if (!listFile) return [];
  const file = join(root, listFile);
  if (!isFile(file)) return [{ page: "(site)", message: `migration.oldUrls names ${listFile}, which doesn't exist. Run \`npx --no site-kit migrate scan\` on the old site first.` }];
  const redirectsFile = join(outDir, "_redirects");
  const rules = isFile(redirectsFile) ? parseRedirects(readFileSync(redirectsFile, "utf8")) : [];
  const problems = [];
  for (const url of parseUrlList(readFileSync(file, "utf8"))) {
    if (served(fileForUrl, url) || redirectFor(rules, url)) continue;
    problems.push({ page: url, message: `The old site served ${url}, and the new one doesn't. Add the page, or a redirect in src/_redirects to where it moved.` });
  }
  return problems;
}
