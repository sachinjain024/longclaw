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
updated_at: 2026-09-25T10:10:07.755Z
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

- [ ] (Structure) Put user content first and contributor content second; move the a11y audit, visual matrix, gate detail, website token rules and the four skills to CONTRIBUTING.md / apps/website/README.md <!-- longclaw:item=ck_2bfc37bb -->
- [ ] (Header) Add a header: mark, name, one-line pitch, platform line (macOS 13+, Apple Silicon only), and an Install CTA <!-- longclaw:item=ck_e4b0c4df -->
- [ ] (Header) Add a one-line who-it-is-for statement, within the no-oversell rules <!-- longclaw:item=ck_cfa8fdd1 -->
- [ ] (Header) Add license and latest-version badges <!-- longclaw:item=ck_d5047e2e -->
- [ ] (Header) Update the status line and release-notes links to the current release (0.3.1) <!-- longclaw:item=ck_9479afb8 -->
- [ ] (Screenshot) Generate the hero image from the site's HeroTour/AppWindow component (light + dark, 2×, scripted), shown with <picture> <!-- longclaw:item=ck_1ad785b0 -->
- [ ] (Screenshot) Record the hero image as a deliberate exception to the no-raster rule <!-- longclaw:item=ck_9ded55a1 -->
- [ ] (Privacy) Replace "nothing is sent anywhere" with the exact network statement (update check + star count); draft the copy with the maintainer <!-- longclaw:item=ck_146acc0f -->
- [ ] (Install) Add an Install section below the header: download, first launch, linking the CLI from Settings → Command line <!-- longclaw:item=ck_b3d2a5c3 -->
- [ ] (Features) Lead with the human + agent loop: a short agent-written ticket.md excerpt and how the board reflects it <!-- longclaw:item=ck_75ed72cc -->
- [ ] (Features) Cover user-visible features shipped in 0.2.0–0.3.1 <!-- longclaw:item=ck_b9a360ef -->
- [ ] (Features) Tighten each feature to one bold headline plus one sentence <!-- longclaw:item=ck_efc22bdc -->
- [ ] (File format) Replace the tree diagram with a trimmed real ticket.md sample (frontmatter, checklist, one activity event) <!-- longclaw:item=ck_89ee93bd -->
- [ ] (Comparison) Add a short "How it compares" section (GitHub Issues/Linear, Backlog.md/git-bug, plain TODO.md) <!-- longclaw:item=ck_5412a4be -->
- [ ] (Docs index) Cut to about 6 user-facing links; put planning and evidence docs behind one Project docs link <!-- longclaw:item=ck_9c377205 -->
- [ ] (Docs index) Drop the ADR count; link docs/adr/ without a number <!-- longclaw:item=ck_c07eb526 -->
- [ ] (Acknowledgements) Credit every skill source in skills-lock.json, Matt Pocock (mattpocock/skills) first, then JuliusBrussee/caveman; build the list from the lockfile so no source is missed <!-- longclaw:item=ck_132c5bd3 -->
- [ ] (Final pass) Remove internal ticket keys (e.g. LC-233) from README prose <!-- longclaw:item=ck_c55841a0 -->
- [ ] (Final pass) Check every claim against website-content-brief.md §6 <!-- longclaw:item=ck_adb7f5bb -->
- [ ] (Final pass) Check that every relative link resolves <!-- longclaw:item=ck_4984fd14 -->

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
