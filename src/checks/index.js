import * as a11y from "./a11y.js";
import * as html from "./html.js";
import * as links from "./links.js";
import * as structure from "./structure.js";
import * as consistency from "./consistency.js";
import * as performance from "./performance.js";
import * as hosts from "./hosts.js";
import * as csp from "./csp.js";
import * as readability from "./readability.js";
import * as sitemap from "./sitemap.js";
import * as sensitiveFields from "./sensitive-fields.js";

export const CHECKS = [a11y, html, links, structure, consistency, performance, hosts, csp, readability, sitemap, sensitiveFields];
