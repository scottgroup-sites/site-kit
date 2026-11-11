import siteKit from "site-kit/eleventy";
import kitConfig from "./site-kit.config.js";

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(siteKit, { config: kitConfig, titleSuffix: " — Example Care Home", placeholders: [] });
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets", "src/_headers": "_headers" });
  return {
    dir: { input: "src", output: "_site", includes: "_includes" },
    templateFormats: ["njk", "md"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
  };
}
