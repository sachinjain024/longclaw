---
name: website-change
description: Change the LongClaw website at longclaw.io — layout, components, styles, copy, SEO or navigation. Use when the user wants to edit the marketing site, add or restyle a page or section, adjust the design tokens, or fix something they saw on the live site. For a documentation page use product-docs, for a release entry use changelog-entry, for the roadmap use roadmap-update.
---

The site is `apps/website` — a static Astro build deployed to GitHub Pages at
**longclaw.io**. It has its own `node_modules` and lockfile; the repository root
is deliberately not an npm workspace.

**Read [`apps/website/README.md`](../../../apps/website/README.md) first.** It
holds the directory map, the content model and the rules below in full. This
skill is the procedure, not a second copy of them.

## Before you touch anything

```sh
npm --prefix apps/website ci   # only if node_modules is missing
npm run site:dev               # localhost:4321
```

## The four rules that are easy to break by accident

1. **Design tokens are transcribed, not authored.** `src/styles/tokens/` mirrors
   the Claude Design export in `docs/ux/prototypes/website-and-docs/`. Never
   introduce a raw colour anywhere else — if you need a value that does not
   exist, that is a design-system change, not a CSS change.
   Two tokens deliberately deviate and say why inline (`--text-faint`,
   `--surface-alt`). Add to that comment rather than silently adding a third.
2. **No screenshots and no raster product imagery.** The board, panel, file
   trees, terminal blocks and the owl mark are token-driven HTML, CSS and SVG in
   `src/components/product/`. This is what makes them theme-aware and crisp at
   any size. The only rasters the build emits are the social card and the touch
   icon, both generated from the same geometry.
3. **The copy may not oversell v0.1.0.** No terminals, sync, teams, accounts,
   Windows, Linux, Intel, custom themes or hard deletion.
   `docs/design/website-content-brief.md` §6 is the list.
4. **`/roadmap` is unpublished.** Out of both navigations, the sitemap and the
   index. Linking it is a decision, not a fix — see `roadmap-update`.

## Where a change goes

| Changing | File |
|---|---|
| Copy shared across pages, nav, links | `src/lib/site.ts` |
| Page chrome, prose, docs shell | `src/styles/global.css` |
| The recreated app UI | `src/styles/product.css`, `src/components/product/` |
| Head, SEO, structured data | `src/layouts/BaseLayout.astro` |
| A route | `src/pages/` |

`src/lib/site.ts` is the single place for the repo URL, the requirements line,
both navigations and the docs reading order. Prefer editing it over hard-coding
the same string in a second page.

## Verify

```sh
npm run site:verify    # astro check + build — what CI runs
```

Then **look at the page**, in both appearances and at a narrow width. Three
classes of defect have shipped past a green build here:

- **Template whitespace.** Astro trims newlines between elements, so a space you
  can see in the source can vanish from the output. It has eaten a word gap
  beside an inline chip and shattered a `white-space: pre` file tree into one
  line per span. Anything inside a `<pre>` should be assembled as a string.
- **Grid floors.** `minmax(320px, 1fr)` cannot shrink below 320 and pushes the
  page wider than a phone. Use `minmax(min(320px, 100%), 1fr)`.
- **Scoped prose styles leaking.** `.doc-body pre` will style a component's own
  `<pre>` unless that component's class is excluded.

## Check the deployed site, not only the build

Some defects exist only once GitHub Pages is serving it. The canonical URLs were
wrong for a day because Pages 301s `/docs` to `/docs/`, and that redirect does
not exist locally. After a deploy lands, spot-check the live URL — routes, a
canonical tag, an asset — before calling it done.

Deployment is automatic on push to `main` for anything under `apps/website/`.
The custom domain is a **repository setting**, not `public/CNAME`, which is inert
for workflow builds.

## Record it

Website work is tracked in LongClaw like everything else. File or update the
ticket through the CLI with `--agent-id`, per `AGENTS.md`.
