import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateConfig } from "../config.js";
import { flagMode } from "../review/mode.js";
import { renderFlag, renderPhoto } from "../review/render.js";
import { createReview, formatReview, assertLaunchReady, assertNoPlaceholders } from "../review/collect.js";

const CSS_SOURCE = fileURLToPath(new URL("./review.css", import.meta.url));
export const REVIEW_CSS_URL = "/assets/site-kit/review.css";

export default function siteKit(eleventyConfig, options = {}) {
  const { config } = validateConfig(options.config);
  const mode = flagMode(process.env, config);
  const placeholders = options.placeholders ?? [];
  const titleSuffix = options.titleSuffix ?? "";
  const review = createReview();

  eleventyConfig.addGlobalData("siteKit", { flagMode: mode });

  eleventyConfig.on("eleventy.before", ({ incremental }) => {
    if (!incremental) review.reset();
  });

  const pageInfo = (ctx) => {
    const url = ctx.page.url;
    const raw = String(ctx.ctx?.title ?? "");
    const title = url === "/" ? "Home" : titleSuffix && raw.endsWith(titleSuffix) ? raw.slice(0, -titleSuffix.length) : raw;
    return { url, title };
  };

  eleventyConfig.addPairedShortcode("flag", function (content, type, note) {
    const html = renderFlag(content, type, note, { mode });
    review.add({ ...pageInfo(this), type, note, text: content });
    return html;
  });

  eleventyConfig.addShortcode("photo", function (description, aspect) {
    const html = renderPhoto(description, aspect, { mode });
    review.add({ ...pageInfo(this), type: "PHOTO", note: description, text: "" });
    return html;
  });

  eleventyConfig.addTransform("site-kit-review-css", function (content) {
    const out = this.page?.outputPath;
    if (typeof out !== "string" || !out.endsWith(".html") || content.includes(REVIEW_CSS_URL) || !content.includes('class="site-kit-')) return content;
    return content.replace("</head>", `<link rel="stylesheet" href="${REVIEW_CSS_URL}">\n</head>`);
  });

  eleventyConfig.on("eleventy.after", async ({ directories, runMode }) => {
    const target = join(directories.output, "assets", "site-kit", "review.css");
    await mkdir(dirname(target), { recursive: true });
    await copyFile(CSS_SOURCE, target);
    if (runMode !== "build" || mode === "hide") return;
    await writeFile(join(process.cwd(), "CONTENT-REVIEW.md"), formatReview(review.items));
    if (mode !== "fail") return;
    const problems = [];
    for (const check of [() => assertLaunchReady(review.items), () => assertNoPlaceholders(placeholders)]) {
      try {
        check();
      } catch (error) {
        problems.push(error.message);
      }
    }
    if (problems.length) throw new Error(problems.join("\n\n"));
  });
}
