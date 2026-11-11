---
name: send-for-review
description: Send website changes for developer review - run the checks, commit, push the content branch, open a pull request and share the preview link.
---

# Send for review

1. Check the branch with `git branch --show-current`. On `{{productionBranch}}`, create a branch
   first: `git switch -c content/<short-description>`. Never commit to or push `{{productionBranch}}`.
2. Run `npx --no site-kit test`. If anything fails, fix the content (never the checks) and explain the fix
   in a sentence. Don't continue until everything passes.
3. List the changes in plain English and confirm they're everything to send.
4. Commit everything with a plain-English message summarising the changes.
5. Push: `git push -u origin HEAD`.
6. If there's no pull request for this branch (`gh pr view` fails), open one with
   `gh pr create --base {{productionBranch}}`, listing the changes and any new flags that need
   confirming. Otherwise the push updates the existing one.
7. Wait for the checks with `gh pr checks --watch`. Then find the preview link: the hosting
   provider comments it on the pull request (`gh pr view --comments`; on Cloudflare Pages it's the
   "Branch Preview URL"). If there's no comment yet, build it from the preview-link pattern in
   `SITE.md`. Never share a `dash.cloudflare.com` link: it needs a login. Share the preview link and
   the pull request link, noting that a developer reviews it before it goes live.
8. If a check fails, explain it plainly and fix it, or say it needs a developer.
