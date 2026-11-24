import siteKit from "site-kit/eleventy";
import kitConfig from "./site-kit.config.js";
import site from "./src/_data/site.js";

export default function (eleventyConfig) {
  // Content flags, photo placeholders, CONTENT-REVIEW.md, the launch guard and comment-free built
  // stylesheets come from site-kit.
  eleventyConfig.addPlugin(siteKit, { config: kitConfig, placeholders: site.placeholders, titleSuffix: ` — ${site.name}` });

  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  for (const file of ["_headers", "_redirects", "robots.txt"]) eleventyConfig.addPassthroughCopy({ [`src/${file}`]: file });
  eleventyConfig.addWatchTarget("src/assets/");

  return {
    dir: { input: "src", output: "_site", includes: "_includes", data: "_data" },
    templateFormats: ["njk", "md"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
}
