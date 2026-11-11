# Working on this site (site-kit)

These rules apply to every site that uses site-kit. The site's own `CLAUDE.md` and `SITE.md` add its
details and may narrow these rules, never loosen them.

## Roles

- **Content editors** write and edit copy, add pages and posts, and adjust presentation within the
  design system. They focus on content and shouldn't need to read code, test output or file paths.
- **Developers** own the code, configuration, tests, third-party services, hosting and the site-kit
  version, and review and merge every change.

## Working with content editors

- Use plain language. Describe changes by where they appear ("the second paragraph on the About
  page"), not by file. Share code or command output only when asked.
- Show every change: the local preview (the preview server in `.claude/launch.json`), or the preview
  deployment link once pushed.
- Make one change at a time and confirm it looks right before moving on.
- If checks fail, explain the problem in one or two sentences and fix the content.
- If a request is developer-only (see below), say so and offer what you can do now.

## Push back, then offer an alternative

Decline requests that would harm accessibility, performance, privacy or honesty, kindly and clearly,
and always propose a version that achieves the goal. Never make an exception "just this once".

| Request | Why not | Offer instead |
|---|---|---|
| Pale or low-contrast text, text over a busy photo | Fails WCAG contrast; hard to read | A palette colour that passes, or text on a solid panel |
| Smaller text to fit more in | Body text stays at least 16px | Shorter copy, or more sections |
| Keyword-filled alt text, hidden text, keyword-stuffed headings | Hurts screen-reader users; search engines penalise it | Accurate alt text, a clear heading order, keywords used naturally in the copy |
| Autoplaying media, carousels, pop-ups, animated banners | Distracting, inaccessible, slow | A static image with a link; media the visitor starts |
| A chat widget, tracking pixel, analytics or other embed | Slows every page, privacy risk, blocked by the security headers | Developer-only; a phone or contact link meanwhile |
| A large photo straight from a camera or stock site | Slow on phones | `npx --no site-kit add-photo "<file>" <name>` first |
| "Click here" or "Read more" links | Meaningless out of context | Link text that says where it goes |
| New colours or fonts | Breaks the design and may fail contrast | The existing design tokens and fonts |

## Flags

Unconfirmed or placeholder content is wrapped in a flag until someone with authority confirms it:
`{% flag "CONFIRM", "What needs checking" %}the text{% endflag %}`. Types: `CONFIRM` (needs checking),
`NEW` (new copy to approve), `MADE UP` (a stand-in detail), `STOCK` (generic image or text). A missing
photo is `{% photo "What the photo should show", "4/3" %}` (ratios: 1/1, 4/3, 3/2, 16/9, 21/9, 3/4,
2/3, 4/5). Flags are highlighted in local previews (hover, tab to or tap a flag to read its note),
hidden on preview deployments, and listed in `CONTENT-REVIEW.md` (`npx --no site-kit review`). Never remove a
flag without knowing who confirmed it.

## How sites are built

- Pages are `src/<page>/index.njk` with a layout, a `title` and a unique `description` (50–160
  characters) in the front matter. Copy the structure of an existing page.
- Shared facts (phone, address, menu) live in the site's data files; never hard-code them in a page.
- One `h1` per page; headings in order without skipping levels.
- Use the design tokens and existing classes; no one-off colours or inline styles.
- Photos: first confirm the content editor has the right to use the photo (taken by or for the client, or
  licensed), and, on care sites, consent from anyone recognisable. Then run
  `npx --no site-kit add-photo "<file>" <name>`, use the `<img>` tag it prints and write accurate alt
  text. Images below the first screen keep `loading="lazy"`.
- If a change adds video, audio, a form, a map or third-party content, update the site's
  accessibility page in the same change.

## Checks

`npx --no site-kit test` builds the site and checks every page: accessibility, valid HTML, links,
structure, consistency, performance, approved services, security headers, readability, the sitemap
and sensitive form fields. New pages are covered automatically.

- Run it before calling any change done. Everything must pass.
- Never weaken, skip or edit tests, budgets, exceptions or protected files to make a check pass. If a
  check seems wrong, explain why and leave it for a developer.
- When returning to a site after time away, run `npx --no site-kit doctor` first.

## Publishing

Never commit to or push the production branch. Work on a branch named `content/<short-description>`,
commit with a plain-English message, and use `/send-for-review` to open a pull request for a
developer to review. Share the preview deployment link it gives you.

## Developer-only

Third-party services, analytics, forms and email, hosting and domains, packages, the site-kit
version, tests, `site-kit.config.js`, and the protected files listed in `.claude/settings.json`.

Packages are installed or upgraded with npm 10 (`npx -y -p npm@10.9.9 npm install …`); npm 11 writes
lockfiles that fail to install on Linux hosts.

## Cross-platform

Sites are edited on Windows and macOS. Use Node scripts and `npx --no site-kit …` commands; no shell-only
or platform-only tools.
