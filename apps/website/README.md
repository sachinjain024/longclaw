# The LongClaw website

The public site at **longclaw.io**: marketing home, product docs, CLI
reference, blog and changelog. Static output, deployed to GitHub Pages by
[`.github/workflows/website.yml`](../../.github/workflows/website.yml) on every
push to `main` that touches `apps/website/`.

It is a separate package from the desktop app, with its own `node_modules` and
lockfile, the same way `apps/desktop` is — the repository root is not an npm
workspace.

```sh
npm --prefix apps/website ci

npm run site:dev        # localhost:4321
npm run site:build      # → apps/website/dist
npm run site:preview    # serve the built output
npm run site:verify     # astro check + build — what CI runs
```

## Why Astro

The site is content first: three Markdown collections and a handful of laid-out
pages. Astro renders them to static HTML with no client framework, ships script
only where a page actually needs it (the two tours, the theme toggle, the copy
buttons, the docs rail), and gives Markdown content collections a typed schema.
That last part matters more than it sounds — it is what lets a new docs page,
blog post or release note be *one file*, which is the shape both a human and an
agent can add without touching layout code.

## Where things are

```text
apps/website/
├── public/                 CNAME, favicon, web manifest — copied verbatim
└── src/
    ├── content/            everything writable
    │   ├── docs/           one .mdx per docs page ('index' is /docs)
    │   ├── blog/           one .mdx per post
    │   └── changelog/      one .md per release
    ├── content.config.ts   the frontmatter schema for all three
    ├── lib/
    │   ├── site.ts         copy, links, and both navigations
    │   ├── format.ts       date and anchor formatting
    │   └── og.ts           social cards, drawn at build time
    ├── components/
    │   ├── product/        the recreated app UI (window, board, tours)
    │   └── …               mark, buttons, header, footer, callouts, trees
    ├── layouts/            BaseLayout (head + SEO), DocsLayout
    ├── pages/              routes, feeds, robots.txt, generated images
    └── styles/
        ├── tokens/         verbatim from the Claude Design export
        ├── global.css      site chrome and prose
        └── product.css     the recreated product visuals
```

## The rules this site is built to

**Design tokens are copied, not invented.** `src/styles/tokens/` is a
transcription of the "LongClaw Website" design system exported to
`docs/ux/prototypes/website-and-docs/`. To change a colour, spacing step or
type size, change it in the design system and re-transcribe. Nothing outside
`tokens/` should introduce a raw colour.

**No raster product imagery.** The board, list, ticket panel, command palette,
file trees and terminal blocks are HTML and CSS built from those tokens — see
`components/product/`. That is what makes them theme-aware, crisp at any DPI,
and a few kilobytes instead of a few hundred. The owl mark is traced vector
geometry (`components/Mark.astro`), not the brand PNG. The only rasters the
site emits are the social card and the Apple touch icon, and both are generated
at build time from the same geometry.

**Fonts are self-hosted.** The design system's token file imports IBM Plex from
Google Fonts; this site does not. A page whose whole claim is that nothing
leaves your machine should not open a third-party connection to draw its own
headline.

**Honesty constraints.** Nothing on the site may promise what v0.1.0 does not
do: no terminals, no sync, teams, accounts or billing, no Windows, Linux or
Intel build, no custom themes, no hard deletion. The build is unsigned and the
docs say so. These come from
[`docs/design/website-content-brief.md`](../../docs/design/website-content-brief.md) §6.

**`/roadmap` is designed but unpublished.** It is absent from both navigations,
excluded from the sitemap, disallowed in `robots.txt`, and carries a `noindex`.
Linking to it from anywhere is the decision to publish it.

## Adding content

### A documentation page

1. Add `src/content/docs/<slug>.mdx` with `title`, `description`, `eyebrow`,
   and optionally `navLabel`.
2. Add an entry to `DOCS_NAV` in `src/lib/site.ts` at the right point in the
   reading order.

That is all — the route, the sidebar entry, the on-this-page rail, the
previous/next links, the breadcrumb and the structured data all derive from
those two things.

### A blog post

Add `src/content/blog/<slug>.mdx` with `title`, `description`, `date` and
`author`. The index, the RSS feed and the post's own social card follow. Set
`draft: true` to keep it out of all three.

### A release note

Add `src/content/changelog/<version>.md` with `version`, `title`, `date` and
optionally `limitations` and `requirements`. The body is a Markdown list.
Entries render newest first, and the version is the anchor (`#v0-1-0`).

Keep the wording in step with `docs/release-notes/<version>.md` — that file is
the source, this one is the published form of it.

## SEO

Per-page `title`, `description` and canonical; Open Graph and Twitter cards
with a generated image; JSON-LD (`SoftwareApplication` and `WebSite` on the
home page, `TechArticle` + `BreadcrumbList` in docs, `BlogPosting` on posts);
`sitemap-index.xml`; `robots.txt`; RSS for both the blog and the changelog.

## Deployment

GitHub Pages, built by Actions, served at the apex domain `longclaw.io`.

**The custom domain is a repository setting, not `public/CNAME`.** When Pages
builds from a workflow it ignores the `CNAME` file in the artifact — that file
is only read by the legacy branch-based build. The file is kept because it
still records the intent and would take effect if the source ever changed, but
the setting under **Settings → Pages → Custom domain** is what governs. Getting
this wrong is not subtle: with no domain set, Pages serves the site at
`/longclaw/` while the build assumes `base: '/'`, so every asset and link 404s.

The build uses `base: '/'` and every internal link is written root-relative. If
the site ever has to live at a project path, `base` in `astro.config.mjs` is the
one thing to change.

Setting it up from scratch:

1. Enable Pages with the **GitHub Actions** source.
2. Set the custom domain to `longclaw.io`.
3. At the DNS host, point the apex at GitHub Pages — an `ALIAS`/`ANAME` to
   `sachinjain024.github.io`, or four `A` records:

   ```text
   185.199.108.153
   185.199.109.153
   185.199.110.153
   185.199.111.153
   ```

   Optionally a `CNAME` for `www` to `sachinjain024.github.io`.
4. Once DNS resolves, GitHub issues the certificate; then tick **Enforce
   HTTPS**. Until DNS resolves the domain is set but unreachable, which is
   expected rather than broken.
