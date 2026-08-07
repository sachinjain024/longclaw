---
format: longclaw.ticket/v1
id: d114377d-6cbf-4dfb-8124-5b5c0207ad47
key: LC-154
title: Cross-cutting — no stacking-order scale exists
status: in_review
priority: p3
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:01.967Z
updated_at: 2026-08-07T12:15:20.373Z
---

**Finding.** No stacking-order scale exists

## Source

`docs/cc_screens_diff.md` — **D-74**, § Cross-cutting, severity P3.

## Checklist

- [x] D-01 and D-51 are both the same missing concept. Add --lc-z-* tokens (workspace / sticky / panel / modal / toast) and use them everywhere position is set. <!-- longclaw:item=ck_54c1f45d -->

## Activity

<!-- longclaw:event
id: evt_5eb0d3cd
kind: create
occurred_at: 2026-08-05T15:16:01.967Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_705bfd2f
kind: comment
occurred_at: 2026-08-06T14:32:57.982Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Partly landed with LC-96 (d932bca): the --lc-z-* scale now exists in design-tokens.json and every z-index in styles.css takes a layer from it (sticky · panel · modal · toast · popover), with scripts/stacking-guard.mjs holding the relations between the five surfaces. Two deviations from D-74's list, both deliberate and both noted beside the tokens: no workspace layer — a stacking context on an ancestor of the board and list would trap the inline-rendered menu popover under the panel — and a popover layer, which the app has and D-74 did not name. What is left of this ticket is the wider half of its checklist, 'use them everywhere position is set': the positioned surfaces that declare no z-index at all were left alone, since most of them are correct at auto.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_318c6aab
kind: update
occurred_at: 2026-08-07T12:15:20.373Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: in_review
  - field: checklist.ck_54c1f45d.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Finished the half this ticket was left with — 'use them everywhere position is set' — by sweeping every positioned rule in `styles.css` rather than the five named surfaces.

Two ways of holding a layer came out of it, and the guard now holds both. `fixed` and `sticky` take one by blanket rule: each is a claim against surfaces it never names, so it is either declared or left to source order. `absolute` cannot be ruled on in the blanket — it is usually a placement inside one box, and the virtualized rows settle that it must stay so, since a layer each is 5,000 stacking contexts for a relation the rows do not have.

Two `absolute` rules were claims, and both were losing: the board's and the list's drop indicators are rendered *before* the rows they are dropped between, so every row painted over them. The list's straddles a row boundary with `margin-top: -1px`, so a hovered, selected or degraded row painted a background over half of a 2px line — at exactly the row the pointer is on. Both take a new `--lc-z-drag`, below `sticky` so a group header still sits over what scrolls under it, and both are named in `stacking-guard.mjs` with that relation. The create panel's sticky footer took `--lc-z-sticky` for the blanket rule rather than for a fault.

`perf:board` and `perf:list` re-run in WebKit after the change: board ArrowDown p95 15ms, scroll 18ms, filter 28ms; list 16 / 18 / 22ms — every p95 well inside the 50ms budget, so the two new stacking contexts cost the scrollers nothing.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_877dddf4
kind: comment
occurred_at: 2026-08-07T13:20:43.606Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Review follow-up, on the one word of this checklist the sweep did not deliver: **workspace**. D-74 asked for `--lc-z-*` tokens named 'workspace / sticky / panel / modal / toast', and there is still no workspace layer. That is deliberate and inherited rather than overlooked — LC-96 recorded it in the comment above when it built the scale, and the reason is load-bearing: the workspace is an ancestor of the board and the list, `Menu.tsx` renders its popover inline rather than through a portal, and a layer on that ancestor makes it a stacking context that traps a menu opened from a card underneath the ticket panel. The token would create the defect the scale exists to prevent.

So the item is ticked against four of the five names plus `popover` and `drag`, which the app has and D-74 did not name, and the omission is stated beside the scale in `design-tokens.json` rather than left to be rediscovered. If the popover ever moves to a portal, a workspace layer becomes possible and worth revisiting.
<!-- /longclaw:event -->
