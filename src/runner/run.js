import { CHECKS } from "../checks/index.js";
import { builtPages, createPageLoader, fileForUrl } from "./pages.js";
import { serveSite } from "./serve.js";
import { launchBrowser } from "./browser.js";

export async function runChecks({ root, config, outDir }) {
  const ctx = { root, config, outDir, pages: builtPages(outDir), loadPage: createPageLoader(outDir), fileForUrl: (u) => fileForUrl(outDir, u) };
  const problems = [];
  let server;
  try {
    for (const check of CHECKS) {
      if (check.browser && !ctx.browser) {
        server = await serveSite(outDir);
        ctx.serverUrl = server.url;
        ctx.browser = await launchBrowser();
      }
      for (const p of await check.run(ctx)) problems.push({ check: check.id, ...p });
    }
  } finally {
    await ctx.browser?.close();
    await server?.close();
  }
  return { problems, pageCount: ctx.pages.length };
}
