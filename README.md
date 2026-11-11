# site-kit

Checks, content-review flags and Claude Code rules for Eleventy marketing sites. One kit keeps every
site to the same standard for accessibility, performance and honest content, and makes a site that
hasn't been touched for months quick to pick up again.

## Install

In an Eleventy 3 site, with npm 10:

```bash
npx -y -p npm@10.9.9 npm install --save-dev github:scottgroup-sites/site-kit#v1.0.0
```

Add `"test": "site-kit test"` to the site's `package.json` scripts.

## Configure

Create `site-kit.config.js` (every setting is validated; anything loosened needs a `reason`):

```js
export default {
  site: { url: "https://www.example.com" },
  productionBranch: "main",
  previewPort: 8080,
  claude: { care: false },
  flags: { production: "fail" }, // "fail" before launch, "hide" once live
  footer: { text: ["(555) 010-0100"], links: ["/accessibility/", "/privacy/"] },
  fonts: [],
  allowedHosts: [{ host: "www.google.com", types: ["iframe"], reason: "Map on the contact page" }],
  sitemap: { exclude: ["/thank-you/"] },
};
```

Other settings (`budgets`, `htmlValidate`, `exceptions`) are documented in the design spec. Loosening a budget prints a warning; `htmlValidate` changes and `exceptions` each need a written `reason`.

Add the plugin to `eleventy.config.js`:

```js
import siteKit from "site-kit/eleventy";
import kitConfig from "./site-kit.config.js";

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(siteKit, { config: kitConfig, titleSuffix: " — Example", placeholders: [] });
}
```

Then run `npx --no site-kit sync` and commit the files it creates.

## Commands

| Command | What it does |
|---|---|
| `npx --no site-kit test [--json]` | Build the site and check every page |
| `npx --no site-kit review` | Write `CONTENT-REVIEW.md` from the content flags |
| `npx --no site-kit add-photo "<file>" <name>` | Resize, compress and strip metadata from a photo; print its `<img>` tag |
| `npx --no site-kit sync [--check]` | Update the files site-kit manages in the repo |
| `npx --no site-kit doctor` | Report the site's status; run it first when returning to a site |

## Checks

`a11y`, `html`, `links`, `structure`, `consistency`, `performance`, `hosts`, `csp`, `readability`,
`sitemap`, `sensitive-fields`. See the design spec in `docs/superpowers/specs/` for what each enforces.
Site-specific tests in the site's `tests/` folder run too, with helpers from `site-kit`:
`builtPages`, `loadPage`, `fileForUrl`, `serveSite`, `launchBrowser`, `buildSite`.

## Content flags

`{% flag "CONFIRM", "What needs checking" %}text{% endflag %}` and `{% photo "description", "4/3" %}`.
Flags show locally. On Cloudflare Pages they are hidden on preview deployments and, on the production branch, either hidden or fail the build (`flags.production`). Everywhere else (including CI) they show unless `SITE_KIT_FLAGS` is set to `show`, `hide` or `fail`.

## Branch protection

In each site repo, once `npx --no site-kit sync` has created `.github/workflows/site-kit.yml` and a pull request has run it, require its checks (this kit's own CI checks are named `test (…)`):

```bash
gh api -X PUT repos/OWNER/REPO/branches/main/protection --input - <<'JSON'
{ "required_status_checks": { "strict": false, "contexts": ["site-kit (ubuntu-latest)", "site-kit (windows-latest)", "Cloudflare Pages"] },
  "enforce_admins": false,
  "required_pull_request_reviews": { "required_approving_review_count": 1 },
  "restrictions": null }
JSON
```

Branch protection is the real safeguard for the production branch: the deny rules in Claude's settings only guide Claude, while GitHub enforces this for everyone.

## Upgrading a site

On a branch: change the tag in `package.json`, `npm install` with npm 10, `npx --no site-kit sync`, fix
what the checks find, and merge once CI passes. Read the CHANGELOG first.

## Contributing

This repository is public. Never add names of people, clients or businesses, real domains, phone
numbers, keys or IDs. Examples use `example.com` and `(555) 01xx` numbers. Guidance describes roles,
not individuals.
