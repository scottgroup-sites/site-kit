import { create } from "./_edit.mjs";
export function mutate(dir) {
  create(dir, "src/extra/index.njk", `---
layout: base.njk
sitemap: false
title: Extra page — Example Care Home
description: An extra page that was accidentally left out of the sitemap, so search engines may never find it.
---
<h1>Extra page</h1>
<p>This page is missing from the sitemap.</p>
`);
}
