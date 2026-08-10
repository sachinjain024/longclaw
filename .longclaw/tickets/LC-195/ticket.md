---
format: longclaw.ticket/v1
id: 9ac1e5d3-8285-4317-8f8c-d5981ecf1cd0
key: LC-195
title: "Finish the LC-192 reconciliation: the token conflicts left open"
status: todo
priority: p1
labels:
  - design
created_at: 2026-08-10T07:26:38.475Z
updated_at: 2026-08-10T07:26:38.475Z
---

The token conflicts LC-192 identified but did not resolve. Its accent layer
(C1–C4, A1, B1) is settled and landed on both sides; these are what is left.

The full item-by-item comparison is `.longclaw/tickets/LC-192/conflicts.md`
groups E, F and G — read it first, it has both sides' values in a table.

**Why E matters more than tidiness.** The design system renders its own
components against *unadjusted* neutrals and status hues, because the repo's
AA corrections (decisions.md D10) were never pushed back. So anything designed
in Claude Design looks subtly unlike the app it is a design for — which
undermines designing there first. E is mostly mechanical: the repo's values are
checker-verified, the design system's are not, so the resolution is almost
certainly "push the repo's".

**F is not mechanical and cannot be delegated.** Ticket titles render in
Familjen Grotesk in the design system and Geist in the app. `micro` names a
10.5px mono token there and an 11.5px UI token here. These are design calls.

**G is small.** The agent pulse and two shadow tokens.

Every value change must clear `npm --prefix apps/desktop run check` — the AA and
CVD checker is what caught the design system asserting a clay/green pair its own
prose called safe (LC-192, D17).

## Checklist

- [ ] E1-E12: push the repo's AA-adjusted neutrals, status and priority hues to the design system <!-- longclaw:item=ck_8addf878 -->
- [ ] E13: label ramp — the repo's 8 fixed hues vs the design system's 3 named labels <!-- longclaw:item=ck_6b577d78 -->
- [ ] E14: human avatar hue trio (--avatar-1/2/3) exists in the design system, has no repo equivalent <!-- longclaw:item=ck_6e45dddf -->
- [ ] E15-E16: check-border (design system only); warn-ink, warn-border-strong, danger-surface (repo only) <!-- longclaw:item=ck_d820f2f8 -->
- [ ] F1: decide the title face — Familjen Grotesk (design system) or Geist (app) <!-- longclaw:item=ck_15da5619 -->
- [ ] F2-F5: hero 46 and h2 27 absent from the repo; display and label tracking differ <!-- longclaw:item=ck_9a51fd77 -->
- [ ] F6: 'micro' means 10.5px mono in the design system, 11.5px UI in the repo — one has to move <!-- longclaw:item=ck_6504a42c -->
- [ ] G8: agent pulse — lcPulse 1.8s infinite vs the repo's 900ms x 2 beats <!-- longclaw:item=ck_06f9aa58 -->
- [ ] G10-G11: shadow-raised and shadow-icon (design system only) vs modal elevation (repo only) <!-- longclaw:item=ck_2798cc45 -->

## Activity

<!-- longclaw:event
id: evt_4310bcdf
kind: create
occurred_at: 2026-08-10T07:26:38.475Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
