---
name: new-page
description: Plan and add a new page to this site using its layout, design system and content flags.
---

# New page

Follow CLAUDE.md throughout, in plain language.

1. Ask what the page is for and who it's for. If it overlaps an existing page, suggest a new section
   there instead: fewer, stronger pages serve visitors and search better.
2. Ask whether it belongs in the main menu. Suggest a footer link or a link from a related page unless
   it's a major section; a longer menu is harder to use on phones.
3. If there's no unsent work on a `content/…` branch, start one from the latest production branch:
   `git fetch origin` then `git switch -c content/page-<short-slug> origin/{{productionBranch}}`.
4. Agree a short outline (headings and what goes under each) before writing.
5. Create `src/<slug>/index.njk` by copying the structure of a similar page. Front matter: the
   layout, a `title` in the site's title format, and a unique `description` of 50–160 characters.
6. One `h1`; headings in order; existing classes and design tokens only; `{% photo %}` where a real
   photo is needed; flags on anything unconfirmed.
7. Link to the page from somewhere relevant. The sitemap updates itself.
8. If the page needs a form, video, map or third-party content, stop: that's developer-only.
9. Run `npx --no site-kit test` and fix any problem in the page, never in the checks.
10. Show the page in the preview and refine. When it's ready, suggest `/send-for-review`.
