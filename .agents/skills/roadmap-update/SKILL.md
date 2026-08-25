---
name: roadmap-update
description: Update the LongClaw public roadmap page, or decide whether to publish it. Use when the user wants to change what is listed as shipped, next, later or someday, or asks about making the roadmap public. The page exists but is deliberately unlinked and unindexed.
---

The roadmap is a single page — `apps/website/src/pages/roadmap.astro` — not a
content collection. The four columns are an array at the top of the file.

## It is designed, and deliberately unpublished

This is the thing to know before editing it. LC-205 decided the live site shows
**no upcoming features and no pricing** at launch. The page was built for
completeness, and it is kept out of sight in four places at once:

| Where | How |
|---|---|
| Both navigations | Absent from `NAV` and the footer |
| The sitemap | `filter` in `astro.config.mjs` excludes it |
| `robots.txt` | `Disallow: /roadmap` |
| The page itself | `noindex` via the `noindex` prop on `BaseLayout` |

**Editing the page is routine. Publishing it is a decision.** If the user asks
for a link to it from anywhere — nav, footer, home page — that is the decision
to go public with the roadmap, and the four suppressions above have to come off
together or the site contradicts itself. Say so and confirm before doing it;
do not quietly add a link.

There is also an open question on LC-205 that publishing would settle: whether
the roadmap should live on the site at all, or on GitHub, or somewhere external.

## Editing the columns

```js
const columns = [
  { title: 'Shipped', modifier: 'shipped', items: ['…'] },
  { title: 'Next',    items: ['…'] },
  { title: 'Later',   items: ['…'] },
  { title: 'Someday', items: ['…'] },
];
```

The content comes from `docs/vision.md`'s phasing. Keep the four columns as
sequence, not schedule:

- **No dates.** Not quarters, not "H1", not "soon".
- **No progress bars or percentages.** The design has none and should not gain
  any.
- **No commitments.** These are statements of order. Something in Later may
  never happen, and the page must not imply otherwise.
- **Shipped means shipped** — it should describe the app the home page
  describes, and nothing more.

Keep each item to one line. If a column needs a paragraph, it belongs in a blog
post instead.

## Verify

```sh
npm run site:verify
```

Then confirm the suppressions still hold — this is the check that matters more
than how the page looks:

```sh
grep -c roadmap apps/website/dist/sitemap-0.xml    # expect 0
grep roadmap apps/website/dist/robots.txt          # expect Disallow
grep -o 'name="robots"[^>]*' apps/website/dist/roadmap/index.html
```
