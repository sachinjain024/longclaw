---
format: longclaw.ticket/v1
id: 0fbb5217-5d5d-40e2-bc9b-04d04a57962b
key: LC-235n
title: Decide where the public roadmap lives
status: todo
priority: p3
labels:
  - product
  - design
created_at: 2026-08-25T08:23:07.233Z
updated_at: 2026-08-25T08:23:07.233Z
---

**Where should the public roadmap live** — published from the LongClaw project
itself, maintained on GitHub, or on an external service like ProductBoard?

Carried out of LC-205, which shipped the website without answering it. This is a
decision ticket: nothing is blocked on it, and no code should change until it is
settled.

## Where it stands today

A roadmap page exists at `apps/website/src/pages/roadmap.astro` — four columns
(Shipped, Next, Later, Someday) built from `docs/vision.md`'s phasing, with no
dates and no progress bars. It is deliberately invisible, suppressed in four
places at once:

| Where | How |
|---|---|
| Both navigations | Absent from `NAV` and the footer |
| The sitemap | `filter` in `astro.config.mjs` excludes it |
| `robots.txt` | `Disallow: /roadmap` |
| The page itself | `noindex` |

That followed the launch decision to show **no upcoming features and no pricing**
on the live site. Publishing means taking all four off together, or the site
contradicts itself. The `roadmap-update` skill documents this.

## The options

**Publish the existing page.** It is already built, already styled, already in
the site's voice, and costs nothing to turn on. It is also a static file that
goes stale silently — nothing fails when the roadmap and reality diverge, which
is the same failure mode the docs have.

**Maintain it on GitHub.** A pinned issue, a project board, or a milestone list.
Free, public, and it updates as a by-product of the work rather than as a second
chore. Weaker as marketing: it does not look like the product, and it puts the
roadmap on a page LongClaw does not control the design of.

**External service.** ProductBoard and friends add voting and feedback capture.
Real value only if the intent is to *collect* input rather than *publish*
intent — and a sign-up-shaped surface sits badly against a product whose claim
is that nothing leaves your machine.

**Keep it unpublished.** The current state. Honest while v0 is the only release
and the phases past it are genuinely uncommitted.

## What would settle it

The question underneath is what the roadmap is *for*. If it is to set
expectations for people evaluating the app, the site page wins. If it is to
collect signal on what to build, GitHub or a service wins. If neither is a real
need yet, leaving it unpublished is the right answer and this ticket closes as
canceled.

Worth deciding alongside whether the site ever carries a sync waitlist — the
other launch decision that traded away an upcoming-features surface.

## Checklist

- [ ] Decide what the roadmap is for: setting expectations, or collecting signal <!-- longclaw:item=ck_9697fc37 -->
- [ ] Pick a home: the site page, GitHub, an external service, or stay unpublished <!-- longclaw:item=ck_f107dfff -->
- [ ] If publishing: lift all four suppressions together — nav, sitemap, robots, noindex <!-- longclaw:item=ck_79284cc4 -->
- [ ] If staying unpublished: close this as canceled and say so on the page's comment <!-- longclaw:item=ck_5dc3cc55 -->

## Activity

<!-- longclaw:event
id: evt_3aa45bca
kind: create
occurred_at: 2026-08-25T08:23:07.233Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
