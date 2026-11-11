---
name: new-blog-post
description: Draft a new blog post for this site, following its post format, content flags and accessibility rules.
---

# New blog post

Follow CLAUDE.md throughout, in plain language.

1. If there's no unsent work on a `content/…` branch, start one from the latest production branch:
   `git fetch origin` then `git switch -c content/post-<short-slug> origin/{{productionBranch}}`.
2. Ask, one question at a time, skipping anything already answered: the topic and audience; key
   points, sources or search terms to include; length (short ~500 words, standard ~900, long ~1,400).
3. Read two or three existing posts to match their tone, structure and front matter.
4. Create the post with every front-matter field the existing posts use, today's date and a unique
   `description` of 50–160 characters.
5. Flag factual claims about the business (services, staff, prices, hours, outcomes). General advice
   needs no flag. Avoid medical or legal advice; suggest readers talk to a professional where relevant.
6. Use descriptive link text and natural wording for search terms.
7. Run `npx --no site-kit test` and fix any problem in the post, never in the checks.
8. Show the post in the preview and refine. When it's ready, suggest `/send-for-review`.
