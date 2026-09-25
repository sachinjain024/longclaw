---
format: longclaw.ticket/v1
id: c5710220-c278-4a24-9467-477cda87698b
key: LC-274e
title: "Refine the GitHub README: current status, install path, and a user-first order"
status: todo
priority: none
labels:
  - product
created_at: 2026-09-25T08:46:18.691Z
updated_at: 2026-09-25T09:03:08.140Z
---

The repository README is the first page a visitor to the GitHub repo reads, and it has drifted from what the project is now. It still describes the product as it stood at 0.1.0, it gives no way to install the app, and it is written more for contributors than for someone deciding whether to try LongClaw.

## What is stale today

- **Status line.** "Status: v0, release candidate" links only the 0.1.0 release notes. 0.2.0, 0.3.0 and 0.3.1 have shipped since (`docs/release-notes/`).
- **ADR count.** "Architecture decisions — twelve ADRs, 0001–0012". `docs/adr/` now holds 15 entries.
- **Release notes link.** The "Using it" list links only `v0.1.0.md`.
- **Features that shipped since 0.1.0 are missing**, for example auto-update (LC-256a / LC-265y) and the status bar (LC-257s). Check each release note for anything user-visible.

## What is missing

- **How to install.** There is no download or install section. A visitor has to find the GitHub release or longclaw.io alone.
- **A short "why LongClaw" before the detail.** The opening paragraph is good. After it, the page goes straight into feature paragraphs, then CLI flags, then a contributor gate.
- **Order for two readers.** Users (install, what it does, the CLI) should come before contributors (development, gate, website internals). The website section and the four skills belong in the contributor half or in `apps/website/README.md`.

## Constraints

- The copy must follow the same no-overselling rule as the website (`docs/design/website-content-brief.md` §6): no terminals, sync, teams, accounts, Windows, Linux, Intel, custom themes or hard deletion.
- No screenshots or raster product imagery unless that rule is changed on purpose. The site's rule is token-driven HTML/CSS; decide whether the README follows it.
- Keep the README and longclaw.io consistent in voice and claims. The README should point to the docs rather than repeat them.
- `CONTRIBUTING.md` stays the only place the quality-gate list lives.

## Decisions from the audit (2026-09-25)

- **The network claim.** "Nothing is sent anywhere" has been false since 0.2.0. The app makes two requests: the update check (`v0.2.0.md`) and a `GET` for the public star count (`v0.3.0.md#what-the-star-request-is`). Replace the claim with an exact statement. **Write this copy with the maintainer; do not settle it alone.**
- **Hero visual.** Use the board render from longclaw.io (`apps/website/src/components/product/HeroTour.astro` / `AppWindow.astro`), not a hand-taken screenshot. GitHub removes `<style>`, `class` and `style` attributes from README HTML, so the component cannot render there live. Generate it from the site instead: render the component with the site's tokens in a headless browser, export light and dark images at 2×, commit them, and switch between them in the README with `<picture>` and `prefers-color-scheme`. Regenerate with a script, not by hand. This is a deliberate README exception to the no-raster rule. Record it in `apps/website/README.md` / `website-content-brief.md`.
- **Header.** Put a proper header at the top: mark, name, one-line pitch, the platform line (macOS 13+, Apple Silicon only), and an Install CTA linking the current release.
- **How it compares.** Add a short, honest section: GitHub Issues / Linear, Backlog.md / git-bug, and a plain TODO.md.

## Checklist

- [ ] Update the status line and release-notes links to the current release (0.3.1) <!-- longclaw:item=ck_9479afb8 -->
- [ ] Drop the ADR count; link docs/adr/ without a number <!-- longclaw:item=ck_c07eb526 -->
- [ ] Add an Install section below the header: download, first launch, linking the CLI from Settings → Command line <!-- longclaw:item=ck_b3d2a5c3 -->
- [ ] Cover user-visible features shipped in 0.2.0–0.3.1 <!-- longclaw:item=ck_b9a360ef -->
- [ ] Put user content first and contributor content second; move the a11y audit, visual matrix, gate detail, website token rules and the four skills to CONTRIBUTING.md / apps/website/README.md <!-- longclaw:item=ck_2bfc37bb -->
- [ ] Check every claim against website-content-brief.md §6 <!-- longclaw:item=ck_adb7f5bb -->
- [ ] Check that every relative link resolves <!-- longclaw:item=ck_4984fd14 -->
- [ ] Replace "nothing is sent anywhere" with the exact network statement (update check + star count); draft the copy with the maintainer <!-- longclaw:item=ck_146acc0f -->
- [ ] Generate the README hero image from the site's HeroTour/AppWindow component (light + dark, 2×, scripted), shown with <picture> <!-- longclaw:item=ck_1ad785b0 -->
- [ ] Record the README hero image as a deliberate exception to the no-raster rule <!-- longclaw:item=ck_9ded55a1 -->
- [ ] Add a README header: mark, name, one-line pitch, platform line (macOS 13+, Apple Silicon only), and an Install CTA <!-- longclaw:item=ck_e4b0c4df -->
- [ ] Add a short "How it compares" section (GitHub Issues/Linear, Backlog.md/git-bug, plain TODO.md) <!-- longclaw:item=ck_5412a4be -->
- [ ] Lead with the human + agent loop: a short agent-written ticket.md excerpt and how the board reflects it <!-- longclaw:item=ck_75ed72cc -->
- [ ] Replace the tree diagram with a trimmed real ticket.md sample (frontmatter, checklist, one activity event) <!-- longclaw:item=ck_89ee93bd -->
- [ ] Cut the docs index to about 6 user-facing links; put planning and evidence docs behind one Project docs link <!-- longclaw:item=ck_9c377205 -->
- [ ] Remove internal ticket keys (e.g. LC-233) from README prose <!-- longclaw:item=ck_c55841a0 -->
- [ ] Tighten each feature to one bold headline plus one sentence <!-- longclaw:item=ck_efc22bdc -->
- [ ] Add license and latest-version badges to the header <!-- longclaw:item=ck_d5047e2e -->
- [ ] Add a one-line who-it-is-for statement, within the no-oversell rules <!-- longclaw:item=ck_cfa8fdd1 -->
- [ ] Add an Acknowledgements section crediting every skill source in skills-lock.json, Matt Pocock (mattpocock/skills) first, then JuliusBrussee/caveman; build the list from the lockfile so no source is missed <!-- longclaw:item=ck_132c5bd3 -->

## Activity

<!-- longclaw:event
id: evt_39afbd02
kind: create
occurred_at: 2026-09-25T08:46:18.691Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_796a26c7
kind: update
occurred_at: 2026-09-25T08:56:52.612Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: description
  - field: checklist.ck_b3d2a5c3.text
    from: "Add an Install section: download, first launch, linking the CLI from Settings → Command line"
    to: "Add an Install section below the header: download, first launch, linking the CLI from Settings → Command line"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_70ee2cac
kind: update
occurred_at: 2026-09-25T08:56:52.630Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_146acc0f.added
    to: Replace "nothing is sent anywhere" with the exact network statement (update check + star count); draft the copy with the maintainer
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_ef91fd1a
kind: update
occurred_at: 2026-09-25T08:56:52.650Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_1ad785b0.added
    to: Generate the README hero image from the site's HeroTour/AppWindow component (light + dark, 2×, scripted), shown with <picture>
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_494a1faf
kind: update
occurred_at: 2026-09-25T08:56:52.668Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_9ded55a1.added
    to: Record the README hero image as a deliberate exception to the no-raster rule
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_fc77c9f6
kind: update
occurred_at: 2026-09-25T08:56:52.685Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_e4b0c4df.added
    to: "Add a README header: mark, name, one-line pitch, platform line (macOS 13+, Apple Silicon only), and an Install CTA"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_032a3500
kind: update
occurred_at: 2026-09-25T08:56:52.700Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_5412a4be.added
    to: Add a short "How it compares" section (GitHub Issues/Linear, Backlog.md/git-bug, plain TODO.md)
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_3722f6d3
kind: update
occurred_at: 2026-09-25T09:00:20.324Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_c07eb526.text
    from: Correct the ADR count, or stop stating one
    to: Drop the ADR count; link docs/adr/ without a number
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_056dcb7e
kind: update
occurred_at: 2026-09-25T09:00:20.345Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_2bfc37bb.text
    from: Put user content first and contributor content second; trim website internals
    to: Put user content first and contributor content second; move the a11y audit, visual matrix, gate detail, website token rules and the four skills to CONTRIBUTING.md / apps/website/README.md
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_792b7637
kind: update
occurred_at: 2026-09-25T09:00:20.364Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_75ed72cc.added
    to: "Lead with the human + agent loop: a short agent-written ticket.md excerpt and how the board reflects it"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_8c3394b8
kind: update
occurred_at: 2026-09-25T09:00:20.385Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_89ee93bd.added
    to: Replace the tree diagram with a trimmed real ticket.md sample (frontmatter, checklist, one activity event)
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_6f2d501f
kind: update
occurred_at: 2026-09-25T09:00:20.405Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_9c377205.added
    to: Cut the docs index to about 6 user-facing links; put planning and evidence docs behind one Project docs link
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_c2a2f48a
kind: update
occurred_at: 2026-09-25T09:00:20.422Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_c55841a0.added
    to: Remove internal ticket keys (e.g. LC-233) from README prose
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_838210e7
kind: update
occurred_at: 2026-09-25T09:00:20.440Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_efc22bdc.added
    to: Tighten each feature to one bold headline plus one sentence
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_615311ab
kind: update
occurred_at: 2026-09-25T09:00:20.459Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_d5047e2e.added
    to: Add license and latest-version badges to the header
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_5c64c605
kind: update
occurred_at: 2026-09-25T09:00:20.483Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_cfa8fdd1.added
    to: Add a one-line who-it-is-for statement, within the no-oversell rules
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_193f5639
kind: update
occurred_at: 2026-09-25T09:00:20.502Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_132c5bd3.added
    to: Add an Acknowledgements section thanking Matt Pocock for mattpocock/skills (https://github.com/mattpocock/skills)
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_f3681409
kind: update
occurred_at: 2026-09-25T09:03:08.140Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_132c5bd3.text
    from: Add an Acknowledgements section thanking Matt Pocock for mattpocock/skills (https://github.com/mattpocock/skills)
    to: Add an Acknowledgements section crediting every skill source in skills-lock.json, Matt Pocock (mattpocock/skills) first, then JuliusBrussee/caveman; build the list from the lockfile so no source is missed
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->
