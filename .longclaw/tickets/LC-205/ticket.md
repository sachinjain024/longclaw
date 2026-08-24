---
format: longclaw.ticket/v1
id: a82268bf-447d-45a8-81f8-0f26cf8a7d22
key: LC-205
title: Generate Website & Documentation
status: in_progress
priority: urgent
labels:
  - release
created_at: 2026-08-11T14:37:24.881Z
updated_at: 2026-08-22T07:36:15Z
---

Build the public LongClaw website — a single home for everything: product docs, blog, changelog, and public roadmap.

**Workflow:** an existing Design System in Claude Design is used to generate the website design, which is then passed to Claude Code to generate the website code.

## Design (in Claude Design)

- Evolve the existing Design System, if required
- Generate the website from the Design System, covering:
  - Blog pages
  - Product documentation
  - CLI documentation
  - Changelog
  - Public roadmap
  - Link to the GitHub repo
  - Link to download the app (Mac only, for now)

## Implementation (in Claude Code)

- Pass the Claude Design output to Claude Code and implement the website in the repo
- Deploy the website
- Create skills to generate product docs, website changes, changelog entries, and public-roadmap updates

## Open question

- Where should the public roadmap live — published from the LongClaw project itself, maintained on GitHub, or an external solution like ProductBoard?

## Activity

<!-- longclaw:event
id: evt_5f52e507
kind: create
occurred_at: 2026-08-11T14:37:24.881Z
actor:
  type: human
  id: local
-->
### You created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_9c41d3a2
kind: update
occurred_at: 2026-08-22T07:02:23Z
actor:
  type: agent
  id: claude-cowork
  name: Claude
changes:
  - field: description
-->
### Claude updated this ticket

Polished and restructured the description: kept all original content and intent, grouped the work into Design (manual) and Implementation sections, and moved the roadmap-hosting question into its own "Open question" section.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_2e7b8f14
kind: update
occurred_at: 2026-08-22T07:03:03Z
actor:
  type: agent
  id: claude-cowork
  name: Claude
changes:
  - field: description
-->
### Claude updated this ticket

Clarified the workflow per Sachin: an existing Design System in Claude Design generates the website design, which is then handed to Claude Code to generate the website code. Relabeled the sections accordingly.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_d1a44f8e
kind: update
occurred_at: 2026-08-22T07:08:54.018Z
actor:
  type: human
  id: local
changes:
  - field: status
    from: todo
    to: in_progress
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_7a19c4e6
kind: comment
occurred_at: 2026-08-22T07:36:15Z
actor:
  type: agent
  id: claude-cowork
  name: Claude
-->
### Claude commented

Content brief and Claude Design prompts are committed: docs/design/website-content-brief.md (sitemap, per-page copy, assets, decisions) and docs/design/website-prompts.md (Prompt 0 evolves the design system with an ochre #B45F06 marketing palette; Prompts 1-6 cover homepage, docs, CLI, blog, changelog, and an unpublished roadmap page). Also corrected repo docs: five theme presets (release notes) and agents-create-tickets-via-CLI (release notes + user guide). Next: run Prompt 0 in Claude Design.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_cca9af7d
kind: comment
occurred_at: 2026-08-23T04:45:33.842Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Website and docs implemented in apps/website as a static Astro 7 site (LC-205 implementation half).

Framework and location: apps/website, parallel to apps/desktop, with its own node_modules and lockfile — the root is not an npm workspace. Astro because the site is content-first: docs, blog and changelog are Markdown collections with typed frontmatter, so adding a page is one file, and it ships zero client JS except where a page needs it.

Built from the Claude Design export in docs/ux/prototypes/website-and-docs/: tokens transcribed verbatim into src/styles/tokens/, every inline style from the export rewritten as classes. Pages: home, /docs (8 pages incl. CLI), /blog + post, /changelog, /roadmap (noindex, unlinked, out of the sitemap and robots.txt), 404.

No raster product imagery, per the brief: the app window, board, list, ticket panel, command palette, file trees and terminal blocks are token-driven HTML/CSS; the owl mark is SVG traced from the brand PNG's alpha (0.96% delta, edge antialiasing only). The only rasters emitted are the OG card and the Apple touch icon, both generated at build time via satori + resvg from the same geometry. Fonts are self-hosted latin-only woff2 rather than Google Fonts — a site claiming nothing leaves your machine should not open a third-party connection. Verified: zero external hosts contacted on any page.

Both interactive tours from the design are implemented to spec: the hero's five-stage product tour (4.2s auto-advance, pause on hover, stop on scroll-out) and the four-state agent tour (6s advance, hover pauses, a click stops it for good, keyboard-operable tabs, state 1 renders without JavaScript, prefers-reduced-motion disables both).

SEO: per-page title/description/canonical, OG + Twitter cards, JSON-LD (SoftwareApplication, WebSite, TechArticle, BreadcrumbList, BlogPosting), sitemap, robots.txt, RSS for blog and changelog.

Two deliberate deviations from the exported design system, both commented in colors.css: --text-faint failed WCAG AA in both appearances (3.6:1 light, 4.1:1 dark) and was darkened/lightened to pass; --surface-alt resolves a runtime color-mix into a plain token. Also corrected .agent-tag--solid (white on --agent was 3.84:1) and the sidebar star (raw ochre, 4.26:1). Fold these back when the design system is next revised.

Verified in WebKit: no page or console errors, no broken internal links, one h1 per page with no heading-level jumps, every link and button has an accessible name, no horizontal overflow at 320px or 1440px, and every text/background pair meets WCAG AA in light and dark. npm run verify (the app gate) is green.

Deploy: .github/workflows/website.yml builds on PRs and publishes to GitHub Pages from main, custom domain longclaw.io via public/CNAME. DNS and enabling Pages with the GitHub Actions source are still to do.

Still open on this ticket: the maintenance skills (docs, changelog, website changes, roadmap updates), and the Download CTA points at GitHub Releases, which needs a real release to exist.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_d20db378
kind: comment
occurred_at: 2026-08-24T11:55:37.017Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Footer fix: the site was rendering two footers stacked. The Claude Design export carries two treatments — a link row (mark, nav, repo, MPL 2.0) on the docs, blog and changelog pages, and a colophon on the home page — and SiteFooter had unified them by rendering both rows. Per Sachin, the colophon is the one that ships, on every page.

Consequence worth knowing: the footer no longer carries nav links or the MPL 2.0 link. The nav is in the header on every page and the repo is the GitHub icon there, so nothing is unreachable, but the licence link is now only in the docs and the repo itself.

Re-verified after the change: one footer per page, no broken links, WCAG AA in both appearances, no external hosts, astro check clean.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_c2261bee
kind: comment
occurred_at: 2026-08-24T11:57:33.065Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Hero tour, projects stage: the agent acknowledgement ring on LC-42 now stands down while the projects stage is showing, so only the ochre ring around the project sidebar is drawn. Two rings were competing for the eye when the caption is about projects. The green ring returns on the board stage, which is the story it belongs to, and it fades rather than snapping.

Re-verified after both this and the footer change: one footer per page, no broken links, WCAG AA in light and dark, no external hosts, no horizontal overflow at 320px or 1440px, all tour/theme/copy/reduced-motion behaviour checks pass, astro check clean.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_bafdc24c
kind: comment
occurred_at: 2026-08-24T12:01:31.689Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Hero tour: the green agent border is now off in all three stages that show it. The board card's acknowledgement ring is gone (the AGENT chip row carries the attribution on its own), and the ticket panel's agent activity entry keeps its wash and green name but loses the left rail. The recreated window now spends at most one accent edge per stage, on whatever that stage's caption is about.

Note this is the marketing recreation only — the app still draws the decaying ring, and docs/user-guide.md still describes it. The 'Built for agents' section further down the home page keeps its green rail on the agent's reply in the collaboration state, where it is the thing distinguishing agent from human in a thread and has nothing competing with it.

Re-verified: no broken links, WCAG AA in both appearances, no external hosts, astro check clean.
<!-- /longclaw:event -->
