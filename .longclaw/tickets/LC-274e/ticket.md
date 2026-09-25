---
format: longclaw.ticket/v1
id: c5710220-c278-4a24-9467-477cda87698b
key: LC-274e
title: "Refine the GitHub README: current status, install path, and a user-first order"
status: in_progress
priority: none
labels:
  - product
created_at: 2026-09-25T08:46:18.691Z
updated_at: 2026-09-25T12:28:38.651Z
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

- [x] (Structure) Put user content first and contributor content second; move the a11y audit, visual matrix, gate detail, website token rules and the four skills to CONTRIBUTING.md / apps/website/README.md <!-- longclaw:item=ck_2bfc37bb -->
- [x] (Header) Add a header: mark, name, one-line pitch, platform line (macOS 13+, Apple Silicon only), and an Install CTA <!-- longclaw:item=ck_e4b0c4df -->
- [x] (Header) Add a one-line who-it-is-for statement, within the no-oversell rules <!-- longclaw:item=ck_cfa8fdd1 -->
- [x] (Header) Add license and latest-version badges <!-- longclaw:item=ck_d5047e2e -->
- [x] (Header) Update the status line and release-notes links to the current release (0.3.1) <!-- longclaw:item=ck_9479afb8 -->
- [x] (Screenshot) Generate the hero image from the site's HeroTour/AppWindow component (light theme only, 2×, scripted as npm run readme:hero) <!-- longclaw:item=ck_1ad785b0 -->
- [x] (Screenshot) Record the hero image as a deliberate exception to the no-raster rule <!-- longclaw:item=ck_9ded55a1 -->
- [x] (Privacy) Replace "nothing is sent anywhere" with the exact network statement (update check + star count); draft the copy with the maintainer <!-- longclaw:item=ck_146acc0f -->
- [x] (Install) Add an Install section below the header: download, first launch, linking the CLI from Settings → Command line <!-- longclaw:item=ck_b3d2a5c3 -->
- [x] (Features) Lead with the human + agent loop: a short agent-written ticket.md excerpt and how the board reflects it <!-- longclaw:item=ck_75ed72cc -->
- [x] (Features) Cover user-visible features shipped in 0.2.0–0.3.1 <!-- longclaw:item=ck_b9a360ef -->
- [x] (Features) Tighten each feature to one bold headline plus one sentence <!-- longclaw:item=ck_efc22bdc -->
- [x] (File format) Replace the tree diagram with a trimmed real ticket.md sample (frontmatter, checklist, one activity event) <!-- longclaw:item=ck_89ee93bd -->
- [x] (Comparison) Add a short "How it compares" section (GitHub Issues/Linear, Backlog.md, plain TODO.md; no git-bug), followed by the local-first-alternative-to-Linear positioning <!-- longclaw:item=ck_5412a4be -->
- [ ] (Comparison) Decide whether to turn the How it compares section into a Markdown table <!-- longclaw:item=ck_77ee5d67 -->
- [x] (CLI) Review the existing CLI section: its opening (crate, write seams, ADR link), the example commands, and the rules paragraph, for a user reading it for the first time <!-- longclaw:item=ck_2f89c14b -->
- [x] (Docs index) Cut to about 6 user-facing links; put planning and evidence docs behind one Project docs link <!-- longclaw:item=ck_9c377205 -->
- [x] (Docs index) Drop the ADR count; link docs/adr/ without a number <!-- longclaw:item=ck_c07eb526 -->
- [x] (Acknowledgements) Credit every skill source in skills-lock.json, Matt Pocock (mattpocock/skills) first, then JuliusBrussee/caveman; build the list from the lockfile so no source is missed <!-- longclaw:item=ck_132c5bd3 -->
- [ ] (Repo settings) Set the About description to match the site's tagline and description (needs the owner account) <!-- longclaw:item=ck_e7f59695 -->
- [ ] (Repo settings) Set the About website to https://longclaw.io (needs the owner account) <!-- longclaw:item=ck_b477835c -->
- [ ] (Repo settings) Add topics: issue-tracker, project-management, local-first, ai-agents, coding-agents, claude-code, markdown, tauri, rust, macos, desktop-app, developer-tools (needs the owner account) <!-- longclaw:item=ck_9c1e3cd2 -->
- [ ] (Repo settings) Upload a 1280×640 social preview image generated from the site's og card, not hand-made (needs the owner account) <!-- longclaw:item=ck_58c22b80 -->
- [ ] (Repo settings) Turn off the unused Wiki and Projects tabs; keep Issues open for outside bug reports, with the bug-report form and blank issues off (needs the owner account) <!-- longclaw:item=ck_447a0031 -->
- [ ] (Repo settings) In the About sidebar, show Releases and hide Packages and Deployments (needs the owner account, web UI only) <!-- longclaw:item=ck_00975eea -->
- [x] (Repo settings) Raise the community profile from 42%: add CODE_OF_CONDUCT.md, SECURITY.md (how to report a vulnerability), and issue and PR templates <!-- longclaw:item=ck_a26b6a66 -->
- [x] (Final pass) Remove internal ticket keys (e.g. LC-233) from README prose <!-- longclaw:item=ck_c55841a0 -->
- [x] (Final pass) Check every claim against website-content-brief.md §6 <!-- longclaw:item=ck_adb7f5bb -->
- [x] (Final pass) Check that every relative link resolves <!-- longclaw:item=ck_4984fd14 -->

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

<!-- longclaw:event
id: evt_982aaa95
kind: update
occurred_at: 2026-09-25T10:10:07.011Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_2bfc37bb.text
    from: Put user content first and contributor content second; move the a11y audit, visual matrix, gate detail, website token rules and the four skills to CONTRIBUTING.md / apps/website/README.md
    to: (Structure) Put user content first and contributor content second; move the a11y audit, visual matrix, gate detail, website token rules and the four skills to CONTRIBUTING.md / apps/website/README.md
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_77d37a85
kind: update
occurred_at: 2026-09-25T10:10:07.035Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_2bfc37bb.moved
    from: "5"
    to: "1"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_abfa8c92
kind: update
occurred_at: 2026-09-25T10:10:07.061Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_e4b0c4df.text
    from: "Add a README header: mark, name, one-line pitch, platform line (macOS 13+, Apple Silicon only), and an Install CTA"
    to: "(Header) Add a header: mark, name, one-line pitch, platform line (macOS 13+, Apple Silicon only), and an Install CTA"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_9da102c7
kind: update
occurred_at: 2026-09-25T10:10:07.078Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_e4b0c4df.moved
    from: "11"
    to: "2"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_167fb56e
kind: update
occurred_at: 2026-09-25T10:10:07.097Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_cfa8fdd1.text
    from: Add a one-line who-it-is-for statement, within the no-oversell rules
    to: (Header) Add a one-line who-it-is-for statement, within the no-oversell rules
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_5e4ea618
kind: update
occurred_at: 2026-09-25T10:10:07.116Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_cfa8fdd1.moved
    from: "19"
    to: "3"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_f81b0a68
kind: update
occurred_at: 2026-09-25T10:10:07.134Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_d5047e2e.text
    from: Add license and latest-version badges to the header
    to: (Header) Add license and latest-version badges
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_24d80a45
kind: update
occurred_at: 2026-09-25T10:10:07.154Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_d5047e2e.moved
    from: "19"
    to: "4"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_b90fbe8d
kind: update
occurred_at: 2026-09-25T10:10:07.174Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_9479afb8.text
    from: Update the status line and release-notes links to the current release (0.3.1)
    to: (Header) Update the status line and release-notes links to the current release (0.3.1)
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_e40db882
kind: update
occurred_at: 2026-09-25T10:10:07.202Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_1ad785b0.text
    from: Generate the README hero image from the site's HeroTour/AppWindow component (light + dark, 2×, scripted), shown with <picture>
    to: (Screenshot) Generate the hero image from the site's HeroTour/AppWindow component (light + dark, 2×, scripted), shown with <picture>
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_475dafbe
kind: update
occurred_at: 2026-09-25T10:10:07.221Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_1ad785b0.moved
    from: "12"
    to: "6"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_982ba002
kind: update
occurred_at: 2026-09-25T10:10:07.241Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_9ded55a1.text
    from: Record the README hero image as a deliberate exception to the no-raster rule
    to: (Screenshot) Record the hero image as a deliberate exception to the no-raster rule
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_3835fad3
kind: update
occurred_at: 2026-09-25T10:10:07.261Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_9ded55a1.moved
    from: "13"
    to: "7"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_5990034a
kind: update
occurred_at: 2026-09-25T10:10:07.280Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_146acc0f.text
    from: Replace "nothing is sent anywhere" with the exact network statement (update check + star count); draft the copy with the maintainer
    to: (Privacy) Replace "nothing is sent anywhere" with the exact network statement (update check + star count); draft the copy with the maintainer
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_ceb96438
kind: update
occurred_at: 2026-09-25T10:10:07.299Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_146acc0f.moved
    from: "13"
    to: "8"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_0f4bafbb
kind: update
occurred_at: 2026-09-25T10:10:07.320Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_b3d2a5c3.text
    from: "Add an Install section below the header: download, first launch, linking the CLI from Settings → Command line"
    to: "(Install) Add an Install section below the header: download, first launch, linking the CLI from Settings → Command line"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_2a41b291
kind: update
occurred_at: 2026-09-25T10:10:07.340Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_b3d2a5c3.moved
    from: "10"
    to: "9"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_93f2b422
kind: update
occurred_at: 2026-09-25T10:10:07.358Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_75ed72cc.text
    from: "Lead with the human + agent loop: a short agent-written ticket.md excerpt and how the board reflects it"
    to: "(Features) Lead with the human + agent loop: a short agent-written ticket.md excerpt and how the board reflects it"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_9e3de2e3
kind: update
occurred_at: 2026-09-25T10:10:07.378Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_75ed72cc.moved
    from: "15"
    to: "10"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_fe576534
kind: update
occurred_at: 2026-09-25T10:10:07.404Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_b9a360ef.text
    from: Cover user-visible features shipped in 0.2.0–0.3.1
    to: (Features) Cover user-visible features shipped in 0.2.0–0.3.1
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_47759464
kind: update
occurred_at: 2026-09-25T10:10:07.425Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_b9a360ef.moved
    from: "12"
    to: "11"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_802395d4
kind: update
occurred_at: 2026-09-25T10:10:07.445Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_efc22bdc.text
    from: Tighten each feature to one bold headline plus one sentence
    to: (Features) Tighten each feature to one bold headline plus one sentence
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_175e9ff8
kind: update
occurred_at: 2026-09-25T10:10:07.464Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_efc22bdc.moved
    from: "19"
    to: "12"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_862520f9
kind: update
occurred_at: 2026-09-25T10:10:07.483Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_89ee93bd.text
    from: Replace the tree diagram with a trimmed real ticket.md sample (frontmatter, checklist, one activity event)
    to: (File format) Replace the tree diagram with a trimmed real ticket.md sample (frontmatter, checklist, one activity event)
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_f7b48282
kind: update
occurred_at: 2026-09-25T10:10:07.503Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_89ee93bd.moved
    from: "17"
    to: "13"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_196115ce
kind: update
occurred_at: 2026-09-25T10:10:07.523Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_5412a4be.text
    from: Add a short "How it compares" section (GitHub Issues/Linear, Backlog.md/git-bug, plain TODO.md)
    to: (Comparison) Add a short "How it compares" section (GitHub Issues/Linear, Backlog.md/git-bug, plain TODO.md)
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_d2ebcb60
kind: update
occurred_at: 2026-09-25T10:10:07.542Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_5412a4be.moved
    from: "17"
    to: "14"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_8a91d116
kind: update
occurred_at: 2026-09-25T10:10:07.563Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_9c377205.text
    from: Cut the docs index to about 6 user-facing links; put planning and evidence docs behind one Project docs link
    to: (Docs index) Cut to about 6 user-facing links; put planning and evidence docs behind one Project docs link
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_64acf4c1
kind: update
occurred_at: 2026-09-25T10:10:07.586Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_9c377205.moved
    from: "18"
    to: "15"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_e34ba2aa
kind: update
occurred_at: 2026-09-25T10:10:07.610Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_c07eb526.text
    from: Drop the ADR count; link docs/adr/ without a number
    to: (Docs index) Drop the ADR count; link docs/adr/ without a number
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_305000df
kind: update
occurred_at: 2026-09-25T10:10:07.646Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_132c5bd3.text
    from: Add an Acknowledgements section crediting every skill source in skills-lock.json, Matt Pocock (mattpocock/skills) first, then JuliusBrussee/caveman; build the list from the lockfile so no source is missed
    to: (Acknowledgements) Credit every skill source in skills-lock.json, Matt Pocock (mattpocock/skills) first, then JuliusBrussee/caveman; build the list from the lockfile so no source is missed
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_caec137e
kind: update
occurred_at: 2026-09-25T10:10:07.666Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_132c5bd3.moved
    from: "20"
    to: "17"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_d4fa046b
kind: update
occurred_at: 2026-09-25T10:10:07.684Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_c55841a0.text
    from: Remove internal ticket keys (e.g. LC-233) from README prose
    to: (Final pass) Remove internal ticket keys (e.g. LC-233) from README prose
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_35ad0ba5
kind: update
occurred_at: 2026-09-25T10:10:07.703Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_c55841a0.moved
    from: "20"
    to: "18"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_ae1a63c6
kind: update
occurred_at: 2026-09-25T10:10:07.724Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_adb7f5bb.text
    from: Check every claim against website-content-brief.md §6
    to: (Final pass) Check every claim against website-content-brief.md §6
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_c98e9aeb
kind: update
occurred_at: 2026-09-25T10:10:07.755Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_4984fd14.text
    from: Check that every relative link resolves
    to: (Final pass) Check that every relative link resolves
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_d00d6168
kind: update
occurred_at: 2026-09-25T10:19:20.071Z
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
id: evt_3d0a1a98
kind: update
occurred_at: 2026-09-25T10:22:08.652Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_2bfc37bb.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_c35ac393
kind: update
occurred_at: 2026-09-25T10:30:01.427Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_e4b0c4df.checked
    from: "false"
    to: "true"
  - field: checklist.ck_cfa8fdd1.checked
    from: "false"
    to: "true"
  - field: checklist.ck_d5047e2e.checked
    from: "false"
    to: "true"
  - field: checklist.ck_9479afb8.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_0e2b42dd
kind: update
occurred_at: 2026-09-25T10:39:54.302Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_1ad785b0.checked
    from: "false"
    to: "true"
  - field: checklist.ck_9ded55a1.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_198b1088
kind: update
occurred_at: 2026-09-25T10:53:14.008Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_146acc0f.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Privacy copy settled with the maintainer on 2026-09-25. Draft B was chosen from four: a headline and a paragraph, in a new README section, What leaves your machine, below the intro. The intro sentence is now "Nothing requires an account." Rejected: A (one sentence, which kept the two requests out of the README), C (audit bullets, too spec-like), and B plus C's details. The copy says what LongClaw sends, not "your tickets never leave your machine", because the tickets are pushed with git. Facts from v0.3.1.md §The local-only boundary and ADR 0014.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_560eb4f8
kind: update
occurred_at: 2026-09-25T10:53:51.208Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_e7f59695.added
    to: (Repo settings) Set the About description to match the site's tagline and description (needs the owner account)
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_9194d8ba
kind: update
occurred_at: 2026-09-25T10:53:51.273Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_e7f59695.moved
    from: "21"
    to: "18"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_403f57f3
kind: update
occurred_at: 2026-09-25T10:53:51.335Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_b477835c.added
    to: (Repo settings) Set the About website to https://longclaw.io (needs the owner account)
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_490f1614
kind: update
occurred_at: 2026-09-25T10:53:51.391Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_b477835c.moved
    from: "22"
    to: "19"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_0b92b14d
kind: update
occurred_at: 2026-09-25T10:53:51.443Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_9c1e3cd2.added
    to: "(Repo settings) Add topics: issue-tracker, project-management, local-first, ai-agents, coding-agents, claude-code, markdown, tauri, rust, macos, desktop-app, developer-tools (needs the owner account)"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_8f3d2138
kind: update
occurred_at: 2026-09-25T10:53:51.503Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_9c1e3cd2.moved
    from: "23"
    to: "20"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_becfee60
kind: update
occurred_at: 2026-09-25T10:53:51.543Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_58c22b80.added
    to: (Repo settings) Upload a 1280×640 social preview image generated from the site's og card, not hand-made (needs the owner account)
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_dcb74ada
kind: update
occurred_at: 2026-09-25T10:53:51.593Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_58c22b80.moved
    from: "24"
    to: "21"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_2eae2b69
kind: update
occurred_at: 2026-09-25T10:53:51.623Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_447a0031.added
    to: (Repo settings) Turn off the unused Wiki and Projects tabs; decide whether Issues stays open for outside bug reports, since work is tracked in LongClaw (needs the owner account)
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_41faddc9
kind: update
occurred_at: 2026-09-25T10:53:51.658Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_447a0031.moved
    from: "25"
    to: "22"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_2fd52c84
kind: update
occurred_at: 2026-09-25T10:53:51.680Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_00975eea.added
    to: (Repo settings) In the About sidebar, show Releases and hide Packages; decide on Deployments (needs the owner account)
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_19425c44
kind: update
occurred_at: 2026-09-25T10:53:51.716Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_00975eea.moved
    from: "26"
    to: "23"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_7c112bea
kind: update
occurred_at: 2026-09-25T10:53:51.739Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_a26b6a66.added
    to: "(Repo settings) Raise the community profile from 42%: add CODE_OF_CONDUCT.md, SECURITY.md (how to report a vulnerability), and issue and PR templates"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_94433040
kind: update
occurred_at: 2026-09-25T10:53:51.772Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_a26b6a66.moved
    from: "27"
    to: "24"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_2b119edb
kind: update
occurred_at: 2026-09-25T10:53:56.820Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_1ad785b0.text
    from: (Screenshot) Generate the hero image from the site's HeroTour/AppWindow component (light + dark, 2×, scripted), shown with <picture>
    to: (Screenshot) Generate the hero image from the site's HeroTour/AppWindow component (light theme only, 2×, scripted as npm run readme:hero)
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_93251bdc
kind: update
occurred_at: 2026-09-25T11:27:04.661Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_b3d2a5c3.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_fe582340
kind: update
occurred_at: 2026-09-25T11:29:05.772Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_75ed72cc.checked
    from: "false"
    to: "true"
  - field: checklist.ck_b9a360ef.checked
    from: "false"
    to: "true"
  - field: checklist.ck_efc22bdc.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_abfc23a6
kind: update
occurred_at: 2026-09-25T11:33:29.626Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_89ee93bd.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_e2670cc0
kind: update
occurred_at: 2026-09-25T11:44:13.881Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_5412a4be.checked
    from: "false"
    to: "true"
  - field: checklist.ck_5412a4be.text
    from: (Comparison) Add a short "How it compares" section (GitHub Issues/Linear, Backlog.md/git-bug, plain TODO.md)
    to: (Comparison) Add a short "How it compares" section (GitHub Issues/Linear, Backlog.md, plain TODO.md; no git-bug), followed by the local-first-alternative-to-Linear positioning
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_dd7a2cc3
kind: update
occurred_at: 2026-09-25T11:47:54.855Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_77ee5d67.added
    to: (Comparison) Decide whether to turn the How it compares section into a Markdown table
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_0ec1f1d8
kind: update
occurred_at: 2026-09-25T11:47:54.891Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_77ee5d67.moved
    from: "28"
    to: "15"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_d1d140dc
kind: update
occurred_at: 2026-09-25T11:48:10.840Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_9c377205.checked
    from: "false"
    to: "true"
  - field: checklist.ck_c07eb526.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_9541fe88
kind: update
occurred_at: 2026-09-25T11:49:40.095Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_132c5bd3.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_a7a63d6d
kind: update
occurred_at: 2026-09-25T12:13:00.665Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_2f89c14b.added
    to: "(CLI) Review the existing CLI section: its opening (crate, write seams, ADR link), the example commands, and the rules paragraph, for a user reading it for the first time"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_6d4eeaee
kind: update
occurred_at: 2026-09-25T12:13:00.706Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_2f89c14b.moved
    from: "29"
    to: "16"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_32fa9e7e
kind: update
occurred_at: 2026-09-25T12:13:46.357Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_c55841a0.checked
    from: "false"
    to: "true"
  - field: checklist.ck_adb7f5bb.checked
    from: "false"
    to: "true"
  - field: checklist.ck_4984fd14.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Final pass, 2026-09-25. No internal ticket keys remain in README prose; the only key is LC-274e inside the ticket.md sample, where it is data. All 15 relative links, the #install anchor and every external link resolve. Claims hold against website-content-brief.md §6. The one absolute claim left is the heading "Completely Secure Local-first app", which the maintainer chose on purpose; it was raised once here, as promised, and stands. For the (CLI) review item: check the CLI section's sentence "Every LC-* item ... was filed through this CLI" against how LC-1…LC-58 were imported on 2026-08-05.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_3b1da474
kind: update
occurred_at: 2026-09-25T12:15:55.309Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_2f89c14b.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_dc5f7c5c
kind: update
occurred_at: 2026-09-25T12:28:38.598Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_447a0031.text
    from: (Repo settings) Turn off the unused Wiki and Projects tabs; decide whether Issues stays open for outside bug reports, since work is tracked in LongClaw (needs the owner account)
    to: (Repo settings) Turn off the unused Wiki and Projects tabs; keep Issues open for outside bug reports, with the bug-report form and blank issues off (needs the owner account)
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_fe106ce5
kind: update
occurred_at: 2026-09-25T12:28:38.626Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_00975eea.text
    from: (Repo settings) In the About sidebar, show Releases and hide Packages; decide on Deployments (needs the owner account)
    to: (Repo settings) In the About sidebar, show Releases and hide Packages and Deployments (needs the owner account, web UI only)
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_1bd5d3af
kind: update
occurred_at: 2026-09-25T12:28:38.651Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_a26b6a66.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_d5781f94
kind: comment
occurred_at: 2026-09-25T12:28:38.673Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Repo settings, decided 2026-09-25: keep Issues open for bug reports; security reports through GitHub private vulnerability reporting; conduct reports to sachinjain.hq@gmail.com; About description is the tagline plus proof; hide Deployments. theinfin8y has push but not admin, so the owner account applies these:

gh repo edit sachinjain024/longclaw \
  --description "Local-first issue tracker for AI coding agents. Tickets are Markdown files in your repo: humans plan, agents execute and write back. macOS, no account." \
  --homepage https://longclaw.io \
  --add-topic issue-tracker,project-management,local-first,ai-agents,coding-agents,claude-code,markdown,tauri,rust,macos,desktop-app,developer-tools \
  --enable-wiki=false --enable-projects=false
gh api -X PUT repos/sachinjain024/longclaw/private-vulnerability-reporting

In the web UI only: Settings > Social preview (upload apps/website/dist/og.png, 1200x630, from npm run site:build), and the About gear (untick Packages and Deployments).
<!-- /longclaw:event -->
