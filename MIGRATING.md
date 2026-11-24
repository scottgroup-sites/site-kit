# Moving a site onto site-kit

For developers. This is how an existing static HTML site becomes an Eleventy site that site-kit checks,
without losing a URL or a sentence on the way. Work on a branch; the old site keeps serving from the
production branch until the new one passes every check and the pull request is merged.

## 1. Record the old site, then scaffold

In the site's repo, on a new branch, with the old site's files at the root:

```bash
npx -y -p github:scottgroup-sites/site-kit#v1.1.0 site-kit init --care --port 8082 --name "Example Care Home"
```

`--care` adds the care-provider rules; leave it out for other sites. `--url https://www.example.com`
is needed only when the home page has no canonical link and there's no `sitemap.xml`. Give each site its
own `--port` so previews of two sites can run side by side.

`init` never overwrites a file. It:

- writes `migration/old-urls.txt`: every URL the old site served (pages, documents such as PDFs and
  `robots.txt`, sitemap entries and old redirect sources);
- writes `MIGRATION.md`: outside services, Google Fonts, forms (and any field the sensitive-fields check
  will reject), inline styles and scripts per page, images to prepare, and pages missing an h1 or a good
  description;
- creates `site-kit.config.js` (with the old outside services listed in a comment, none approved),
  `eleventy.config.js`, a starter layout, `404`, sitemap, stylesheet and `src/_data/site.js`;
- copies `_headers`, `_redirects` and `robots.txt` into `src/`, adding a strict Content-Security-Policy if
  the old headers had none;
- runs `site-kit sync` for the Claude guidance, protected files, Stop hook, CI workflow and `SITE.md`.

Then install with npm 10 (npm 11 lockfiles fail `npm ci` on Linux hosts), using the command `init`
prints:

```bash
npx -y -p npm@10.9.9 npm install --save-dev @11ty/eleventy github:scottgroup-sites/site-kit#v1.1.0
```

Run `npx --no site-kit migrate scan` again at any time to refresh `MIGRATION.md`. It keeps an existing
`migration/old-urls.txt`; delete that file to record the URLs again.

## 2. Decide the outside services

Go through the services table in `MIGRATION.md` with the client. For each one the new site keeps, add it
to `allowedHosts` with a reason, allow it in the CSP in `src/_headers`, record it in `SITE.md`, and mention
it on the accessibility page if it's a map, video, form or other embedded content. Analytics, tracking
pixels and chat widgets slow every page and collect visitors' data: keep them only if the client asks and
the privacy page says so. Forms that send through a script show up as an inline-script host; approve
their service as a `form` host once the form posts to it.

## 3. Convert the pages

Convert each old page into `src/<page>/index.njk` on the shared layout, one section at a time.

- **Keep every URL.** `index.html` pages keep their folder. A `name.html` page becomes `name/index.njk`
  (served at `/name/`; the host redirects `/name` there). Anything that moves or goes needs a rule in
  `src/_redirects`. The `urls` check fails until each old URL has a page, a file or a redirect.
- **Facts once.** Phone, address, hours, licence number and the menu go in `src/_data/site.js`. Facts the
  client still has to supply go in `placeholders`; the launch build refuses to run while any remain.
- **Flag what nobody has confirmed.** On care sites that's every claim about care, staffing, licensing,
  pricing, availability and hours. A flag is inline text: it goes inside a paragraph, list item or
  heading, never around a list or a `<div>`. To flag a list, flag each item; the build stops otherwise.
- **Styles into the stylesheet.** Move `style=""` attributes and `<style>` blocks into design tokens and
  classes. Comments in the stylesheet are fine: the plugin removes them from the built copy, so they
  don't count against the 40 KB CSS budget. That budget includes site-kit's own `review.css` (about 2 KB).
- **Sizes in rem, checked in px.** Body text, including small uppercase labels, must be at least 16px as
  rendered. With a root size above 100% (for example 112.5%, 18px), 0.85rem is only 15.3px; the
  readability check reports both units.
- **Photos** go through `npx --no site-kit add-photo`, after confirming the right to use them and, on care
  sites, consent from anyone recognisable.

## 4. Check nothing was lost

```bash
npx --no site-kit migrate compare
npx --no site-kit test
```

`migrate compare` builds the new site and writes `migration/content-comparison.md`: for each old page, the
text blocks (headings, paragraphs, list items, table cells) that aren't on the new page, leaving out the
shared header, menu and footer. Some gaps are deliberate rewrites; check each one with the content editor.

`site-kit test` builds into a temporary folder and removes it afterwards, so `_site` doesn't show what
was checked; read its report. Repeat until both pass.

## 5. Guard the decisions, then hand over

- Write site tests in `tests/` for copy decisions that are settled (wording rules, which page shows the
  price, who is named as the contact). When content a test checks is deliberately removed later, update
  the test in the same change.
- Fill in `SITE.md`: people and roles, approved services, accounts, hosting, dated decisions.
- Set the host's build command to `npm run build` with output folder `_site`.
- Delete the old HTML files and images from the repo root, keeping `migration/`.
- Open the pull request, require the site-kit checks in branch protection (see the README), and merge
  once CI passes.
- After launch, remove `migration` from `site-kit.config.js`, and set `flags.production` back to `"fail"`
  if it was `"hide"` for a client preview.

## Protected files during the move

The settings `sync` writes stop Claude from editing `tests/`, `eleventy.config.js`, `site-kit.config.js`,
`CLAUDE.md` and the other protected files. To change one with Claude's help, unlock it by editing
`.claude/settings.json` yourself, and put it back afterwards with `git checkout -- .claude/settings.json`.
Never commit the unlock: `doctor` reports it, and CI's `sync --check` rejects it.
