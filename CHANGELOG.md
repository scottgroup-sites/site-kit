# Changelog

## 1.1.0 (unreleased)

- New: moving an existing static site onto site-kit. `site-kit init` records the old site and scaffolds
  Eleventy and site-kit; `migrate scan` writes `MIGRATION.md` (outside services, fonts, forms, inline
  styles, images, page structure) and `migration/old-urls.txt`; `migrate compare` lists old text missing
  from the new pages. See `MIGRATING.md`.
- New `urls` check, on when `migration.oldUrls` is set: every old URL needs a page, a file or a
  `_redirects` rule.
- A flag that wraps a block element (a list, `<div>`, paragraph…) stops the build with an explanation,
  instead of failing the html check later with `element-permitted-content`.
- Built stylesheets lose their comments (licence comments stay; `stripCssComments: false` keeps them).
  If a site strips comments in its own `eleventy.after` hook, that hook can go.
- Readability messages give rem as well as px when the root size isn't 16px.
- `doctor` reports uncommitted `.claude/settings.json` changes as a temporary unlock that must not be
  committed; `/send-for-review` leaves that file out of commits.
- Guidance: flags are inline, the 16px minimum includes small labels, `site-kit test` builds into a
  temporary folder, and site tests guard settled decisions.
- After upgrading, run `npx --no site-kit sync` to update the managed files.

## 1.0.1

- Flag notes are tooltips: flagged text flows normally, and the note appears on hover, keyboard focus or tap (local previews only; hidden builds are unchanged).
- The review stylesheet is linked only on pages with flags or photo placeholders.
- `/send-for-review` shares the real preview link from the pull request, never a hosting-dashboard link.
- Guidance: confirm photo rights before adding photos; packages are installed with npm 10.
- `doctor` reads "today" / "1 day ago"; the Stop hook asks for a developer when checks can't run; all Eleventy config filenames are protected; config validation no longer modifies the object passed in.
- Flags are keyboard tab stops in local previews, so the notes can be read without a mouse.
- If your site styled `.site-kit-flag__note` as an inline chip, check those overrides: the note is now positioned absolutely, and fixed to the bottom of the screen on phones and touch screens.
- `doctor` warns about decisions dated in the future.
- After upgrading, run `npx --no site-kit sync` to update the managed files.

## 1.0.0

First release: Eleventy plugin (content flags, photo placeholders, review file, launch guard), the
`site-kit` CLI (`test`, `review`, `add-photo`, `sync`, `doctor`, `hook`), eleven checks, Claude Code
guidance and skills, and a CI workflow for Ubuntu and Windows.
