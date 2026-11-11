# site-kit design

**Status:** approved design, ready for an implementation plan
**Date:** 2026-11-10

## Purpose

site-kit is a shared toolkit for a portfolio of small marketing websites built with Eleventy. It gives
every site the same quality checks, the same content-review workflow and the same rules for working
with Claude Code, so that:

- launching a new site follows one proven process;
- changes by content editors can't quietly break accessibility, performance or honesty;
- a site nobody has touched for months can be picked up quickly and safely.

This repository is **public**. It must contain nothing that identifies a person, client, company
site, domain, credential or internal process (see "Public repository rules").

### In scope

- An Eleventy plugin: review flags, photo placeholders, the content review file and the launch guard.
- A command-line tool, `site-kit`, with `test`, `review`, `add-photo`, `sync`, `doctor` and `hook`.
- Checks that run on every built page of a site.
- Shared guidance for Claude Code (`CLAUDE.base.md`, `CLAUDE.care.md`), skills, a Stop hook and
  protected-file rules, copied into each site by `site-kit sync`.
- A GitHub Actions workflow running the checks on Ubuntu and Windows.
- A per-site notes file (`SITE.md`) template for picking work back up.
- The kit's own tests: unit tests, a fictional demo site, and deliberately broken fixtures.

### Out of scope (separate designs)

- **Fleet monitor:** scheduled checks against live URLs (uptime, certificates, live SEO safeguards,
  third-party embeds, outbound links, form delivery, Core Web Vitals), across all sites, built or not.
- **Migration toolkit:** URL, content and visual parity when moving an existing site to Eleventy.
- **Visual comparison** (screenshot diffs). First used in the migration toolkit.

## Roles

- **Content editor:** writes and edits copy, adds pages and posts, adjusts presentation within the
  design system. Works through Claude Code and shouldn't need to read code, test output or file paths.
- **Developer:** owns the site's code, configuration, tests, third-party services, hosting and the kit
  version. Reviews and merges every change.

All guidance in this repo is written in terms of these roles. A site's private repo records who fills them.

## Architecture

```
site-kit/                         (public GitHub repo, tagged releases vX.Y.Z)
  package.json                    name "site-kit", bin "site-kit", exports "." and "./eleventy"
  bin/site-kit.mjs                CLI entry
  src/
    config.js                     load + validate site-kit.config.js, apply defaults
    eleventy/plugin.js            shortcodes, flag modes, review file, launch guard
    review/                       flag/photo rendering, review collection, review file formatting
    checks/                       one module per check (see "Checks"), each exporting run(page, ctx)
    runner/                       build to a temp folder, serve, run checks, collect + format results
    commands/                     test, review, add-photo, sync, doctor, hook
  templates/                      files written by `site-kit sync` (see "Sync")
  fixtures/
    demo-site/                    fictional Eleventy site that must pass every check
    broken/<check>.mjs            one mutation per check, applied to a copy of the demo site, that must fail exactly that check
  test/                           unit and contract tests for the kit itself
  CHANGELOG.md
```

### Installation in a site

```json
"devDependencies": { "site-kit": "github:scottgroup-sites/site-kit#v1.0.0" }
```

- Installed from GitHub at a tag; no npm registry or token is needed (the repo is public).
- The kit is plain JavaScript (ESM) with no build step, so installing from Git needs no `prepare` script.
- Runtime dependencies of the checks (axe-core for Playwright, html-validate, linkedom, playwright-core,
  sharp) are dependencies of the kit, so sites don't list them. `@11ty/eleventy` is a peer dependency.
- Browser checks use the installed Google Chrome, falling back to Microsoft Edge on Windows;
  `PW_CHANNEL` overrides. No browser download.
- Lockfiles in sites must be written with npm 10 (npm 11 records platform-only optional packages in
  a way that fails `npm ci` on Linux). `site-kit doctor` warns when the lockfile looks npm-11-written.

### Site configuration: `site-kit.config.js`

```js
export default {
  site: { url: "https://www.example.com" },        // canonical origin
  productionBranch: "main",
  previewPort: 8080,                                // local preview server (.claude/launch.json)
  claude: { care: true },                           // also import CLAUDE.care.md
  flags: { production: "fail" },                   // "fail" before launch, "hide" once live
  footer: {                                         // must appear on every page
    text: ["(555) 010-0100", "100 Example Street"],
    links: ["/accessibility/", "/privacy/"],
  },
  fonts: ["Example Serif", "Example Sans"],         // the only web font families allowed
  allowedHosts: [                                   // anything else loaded from another origin fails
    { host: "fonts.googleapis.com", types: ["stylesheet"], reason: "Design fonts" },
    { host: "www.google.com", types: ["iframe"], reason: "Map on the contact page" },
  ],
  budgets: { htmlPerPage: "60 KB", pageTotal: "1200 KB", imageFile: "300 KB", cssTotal: "40 KB", jsTotal: "30 KB" },
  sitemap: { exclude: ["/thank-you/", "/404.html"] },
  htmlValidate: [                                   // changes to html-validate's recommended rules
    { rule: "no-inline-style", level: "off", reason: "Embedded third-party widget markup" },
  ],
  exceptions: [                                     // developer-only, always printed in results
    { check: "readability", page: "/legal/", reason: "Statutory notice reproduced verbatim" },
  ],
};
```

- `config.js` validates every field and fails with a plain message naming the field.
- Budgets above the defaults are allowed but print a warning on every run. Every `allowedHosts`
  entry, `htmlValidate` rule change and exception must have a non-empty `reason`.
- `site-kit.config.js` is a protected file (see "Claude Code layer").

### Flag modes

The Eleventy plugin renders flags in one of three modes:

| Mode | Rendering | Used |
|---|---|---|
| `show` | Highlighted text with a visible note | Local development |
| `hide` | Plain text, photo spots as neutral boxes | Preview deployments; production when `flags.production` is `hide` |
| `fail` | Build fails while any flag or placeholder remains | Production when `flags.production` is `fail` |

The mode is chosen automatically:

1. `SITE_KIT_FLAGS` (`show`, `hide` or `fail`) if set, which overrides everything else.
2. On Cloudflare Pages (`CF_PAGES=1`): `flags.production` if `CF_PAGES_BRANCH` equals
   `productionBranch`, otherwise `hide`.
3. Otherwise `show`.

This means a site's Cloudflare project needs no flag-related environment variables.

Flag markup is the same everywhere: `<span data-flag="CONFIRM" data-flag-note="…">text</span>`,
with the note rendered as a visible, `aria-hidden` element in `show` mode only. Types: `CONFIRM`,
`NEW`, `MADE UP`, `STOCK`. Shortcodes: `{% flag "TYPE", "note" %}…{% endflag %}` and
`{% photo "description", "4/3" %}`. Photo aspect ratios come from a fixed set (`1/1`, `4/3`, `3/2`,
`16/9`, `21/9`, `3/4`, `2/3`, `4/5`) rendered as CSS classes, so placeholders need no inline styles.
The plugin adds a small stylesheet (`/assets/site-kit/review.css`) to every page for flags and
photo placeholders. Every build in `show` or `fail` mode writes `CONTENT-REVIEW.md`:
numbered items, sitewide items first, then by page title. `site-kit review` writes it on demand.
Sites may also list unconfirmed facts in a `placeholders` array in their site data, which counts as an
open item for the launch guard.

## Checks

`site-kit test` builds the site into a temporary folder (never the folder the preview server uses),
serves it locally and runs every check on every built HTML page. Site-specific tests in the site's
`tests/` folder run in the same command, using helpers the kit exports from `site-kit`
(`builtPages`, `loadPage`, `fileForUrl`, `serveSite`, `launchBrowser`, `buildSite`). They read the
build folder from `SITE_KIT_OUT_DIR`, which `site-kit test` sets.

Each check has a stable ID, used in `exceptions`:

| ID | Enforces |
|---|---|
| `a11y` | axe-core, WCAG 2.2 AA plus best practice, at 1440px and 375px; no horizontal overflow at 375px. Third-party iframes excluded. |
| `html` | html-validate recommended rules, with the site's documented rule changes |
| `links` | Every internal link and fragment resolves to a built page and an existing id |
| `structure` | `lang`, exactly one `h1`, `main` landmark, skip link as first focusable element targeting `main`, title, meta description (50–160 characters), canonical on the configured origin; titles and descriptions unique across pages |
| `consistency` | The main navigation links match the home page's on every page; configured footer text and links appear on every page |
| `performance` | Budgets; images in web formats with `width`, `height` and `alt`; iframes `loading="lazy"`; no autoplaying media; only the configured font families |
| `hosts` | Every script, stylesheet, iframe, image and form action on another origin is in `allowedHosts` for that type |
| `csp` | If `src/_headers` exists, its Content-Security-Policy permits every allowed host for the matching directive, and forbids inline scripts (JSON-LD excepted) |
| `readability` | No rendered visible text under 14px; paragraph and list text in `main` at least 16px (short labels exempt by class: `.eyebrow`, `.post-meta`, `.field-hint`) |
| `sitemap` | Every indexable page is in `sitemap.xml`, no `noindex` or excluded page is, no duplicates |
| `sensitive-fields` | No form field (by name, id, label or placeholder) asks for diagnoses, conditions, medications, insurance or government ID numbers |

### Results

- First line: a summary such as `3 problems on 2 pages (a11y, performance)`, then details grouped by
  page, each with what is wrong and how to fix it in plain words.
- Then any warnings (loosened budgets) and every active exception with its reason.
- Exit code 0 when everything passes, 1 on any failure.
- `--json` writes machine-readable results (used by the hook, and later by the fleet monitor).

## Commands

| Command | Behaviour |
|---|---|
| `site-kit test [--json]` | As above |
| `site-kit review` | Build in `show` mode and write `CONTENT-REVIEW.md` |
| `site-kit add-photo <file> <name>` | Rotate per EXIF, fit within 1600px (never enlarge), JPEG under the image budget (stepping quality down), strip metadata including GPS, save to `src/assets/img/<name>.jpg`, print an `<img>` tag with width and height. Refuses to overwrite. HEIC unsupported, with a clear message. |
| `site-kit sync [--check]` | Write or update managed files (see "Sync"). `--check` changes nothing and exits 1 if anything is out of date. |
| `site-kit doctor` | Status report (see "Picking a site back up") |
| `site-kit hook` | Stop-hook entry point (see "Claude Code layer") |

All commands are Node scripts and work identically on macOS, Windows and Linux: no shell built-ins,
paths via `fileURLToPath` and `path.join`, child processes started with `process.execPath` rather
than `npx`.

## Sync

`site-kit sync` manages these files in a site repo. Each managed text file starts with a header
naming the kit version and saying that changes belong in site-kit, not in the copy.

| File | Behaviour |
|---|---|
| `.github/workflows/site-kit.yml` | Overwritten |
| `.claude/settings.json` | Overwritten (protected-file rules and the Stop hook) |
| `.claude/skills/new-page/`, `new-blog-post/`, `send-for-review/` | Overwritten |
| `.claude/launch.json` | Overwritten; preview server `node node_modules/@11ty/eleventy/cmd.cjs --serve`, port from config (default 8080) |
| `.gitattributes` | Overwritten (`* text=auto eol=lf`, binary image types) |
| `CLAUDE.md` | Never overwritten. Sync ensures it starts with `@node_modules/site-kit/CLAUDE.base.md` (and `CLAUDE.care.md` if `claude.care: true` in config) and `@SITE.md`, adding missing lines at the top. |
| `SITE.md` | Created from the template if missing; never overwritten |

The CI workflow (`site-kit (ubuntu-latest)` and `site-kit (windows-latest)` checks): checkout, Node 22,
`npm ci`, `site-kit sync --check`, `site-kit test`, then a Stop-hook smoke test on each OS. Uses
current major versions of `actions/checkout` and `actions/setup-node`. The README documents the
branch-protection command that requires both checks plus the Cloudflare Pages check.

## Claude Code layer

### `CLAUDE.base.md` (imported by every site)

- **Working with content editors:** plain language; describe changes by where they appear on the
  page; show every change in the local preview or the preview deployment; one change at a time;
  explain failures in a sentence or two and fix the content; developer-only requests are named as such.
- **Push back, then offer an alternative:** the table of requests that harm accessibility, performance,
  privacy or honesty, each with a better option (contrast, text size, alt text and keywords, autoplay
  and pop-ups, third-party scripts, oversized images, vague link text, off-palette colours and fonts).
- **Flags:** when to use each type; never remove a flag without knowing who confirmed it.
- **How sites are built:** pages, posts, site data, design tokens, the photo command, heading order.
- **Tests:** run `site-kit test` before calling anything done; never weaken, skip or edit tests,
  budgets, exceptions or protected files; a new page needs no new test unless it adds behaviour.
- **Publishing:** branch `content/<description>`, commit, `/send-for-review`, preview link; never `main`.
- **Developer-only:** third-party services, analytics, forms and email, hosting and domains, packages,
  the kit version, tests, configuration, protected files.
- **Cross-platform:** Node scripts only; no Mac- or Windows-only tools.

### `CLAUDE.care.md` (optional, for care and health providers)

Unconfirmed claims about care, staffing, licensing, medical services, pricing, availability or
outcomes are flagged until confirmed; no resident or patient names, photos, stories or health details
without written consent; testimonials must be real and permitted and are never written by Claude;
forms never ask for medical information; no promised outcomes.

### Skills

`/new-page`, `/new-blog-post`, `/send-for-review`, as in the current reference site, rewritten in
role terms and using `site-kit` commands.

### Protected files and hook

`.claude/settings.json` denies Claude edits to `tests/`, `site-kit.config.js`, `CLAUDE.md`, `.claude/`,
`.github/`, `.gitattributes`, `src/_headers`, `package.json` and `package-lock.json`; denies
pushing to the production branch, force-pushing and `git reset --hard`. These rules guard Claude's
file tools, not every shell command; CI and review remain the final safeguard. Developers edit these
files directly, or remove the deny block for a session and restore it before committing.

The Stop hook runs `node "$CLAUDE_PROJECT_DIR/node_modules/site-kit/bin/site-kit.mjs" hook`. It
exits 0 if `stop_hook_active` is true or no site files have uncommitted changes; otherwise it runs
the checks and, on failure, exits 2 with the summary and the first failures on stderr.

## Picking a site back up

### `SITE.md` (per site, private repo)

Template sections: overview; people and roles; approved third-party services and why; where accounts
and credentials are kept (never the credentials themselves); hosting and domains; decisions log
(dated); launch history; open items. `CLAUDE.md` imports it, so Claude reads it at the start of a session.

### `site-kit doctor`

Prints a short report, each line marked OK, WARN or FAIL:

- installed kit version vs the latest release tag (network optional; skipped offline);
- managed files in sync (`sync --check`);
- Node and npm versions, and whether the lockfile looks npm-11-written;
- current branch, uncommitted changes, and whether the branch is behind the production branch;
- open flags and placeholders by type, from a fresh `show` build;
- loosened budgets and every exception with its reason;
- `SITE.md` present, and the age of its newest decisions-log entry;
- result of `site-kit test`.

Run first when returning to a site; the README and `CLAUDE.base.md` say so.

## Versioning and upgrades

- Semantic versioning. A change that can make a passing site fail (a new check, a stricter budget) is
  a minor version with a CHANGELOG entry saying what to expect; removing or renaming config is major.
- Upgrade one site at a time on a branch: change the tag, `npm install` (npm 10), `site-kit sync`,
  fix what the checks find, merge when CI passes.

## Testing the kit

- **Unit tests:** flag and photo rendering, mode selection, review formatting, config validation,
  budget parsing, each check's pure logic.
- **Contract tests:** `fixtures/demo-site` passes every check with no warnings; for each check, a
  copy of the demo site with `fixtures/broken/<check>.mjs` applied fails exactly that check (copies
  live in the kit's git-ignored `.tmp/` folder so they resolve the kit's own dependencies); `sync` on a fresh
  copy of the demo site produces the expected files and `sync --check` then passes.
- **Hook tests:** clean tree exits 0; `stop_hook_active` exits 0; a broken change exits 2 with the summary.
- **CI:** Ubuntu and Windows, Node 22.

## Public repository rules

- No names of people, clients, businesses or sites; no real domains, phone numbers, addresses,
  form keys, analytics IDs or other identifiers. Fixtures and examples use reserved values
  (`example.com`, `(555) 01xx` numbers).
- Guidance describes roles and good practice, never individuals or their skills.
- No internal pricing, contracts or processes beyond "changes are reviewed by the developer".
- Site-specific facts live only in each site's private repo (`SITE.md`, `CLAUDE.md`, config).

## Adopting the kit

Each site adopts the kit as part of its Eleventy build or refactor; a site does not go live on the kit
until every check passes. The current reference site moves first:

1. Add the kit, write `site-kit.config.js` from its current values, run `site-kit sync`.
2. Switch its flag shortcode and review file to the plugin; preview builds hide flags automatically,
   production uses `fail` until launch.
3. Delete its copies of the generic tests and helpers; keep its site-specific tests (home page,
   blog, forms, menu).
4. Rewrite its `CLAUDE.md` in role terms on top of the imports; move site facts into `SITE.md`.
5. Update branch protection to the new check names.
