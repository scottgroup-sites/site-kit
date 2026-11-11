# Changelog

## 1.0.1

- Flag notes are tooltips: flagged text flows normally, and the note appears on hover, keyboard focus or tap (local previews only; hidden builds are unchanged).
- The review stylesheet is linked only on pages with flags or photo placeholders.
- `/send-for-review` shares the real preview link from the pull request, never a hosting-dashboard link.
- Guidance: confirm photo rights before adding photos; packages are installed with npm 10.
- `doctor` reads "today" / "1 day ago"; the Stop hook asks for a developer when checks can't run; all Eleventy config filenames are protected; config validation no longer modifies the object passed in.
- After upgrading, run `npx --no site-kit sync` to update the managed files.

## 1.0.0

First release: Eleventy plugin (content flags, photo placeholders, review file, launch guard), the
`site-kit` CLI (`test`, `review`, `add-photo`, `sync`, `doctor`, `hook`), eleven checks, Claude Code
guidance and skills, and a CI workflow for Ubuntu and Windows.
