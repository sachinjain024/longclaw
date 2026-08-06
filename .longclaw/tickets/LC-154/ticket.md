---
format: longclaw.ticket/v1
id: d114377d-6cbf-4dfb-8124-5b5c0207ad47
key: LC-154
title: Cross-cutting — no stacking-order scale exists
status: todo
priority: p3
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:01.967Z
updated_at: 2026-08-05T15:16:01.967Z
---

**Finding.** No stacking-order scale exists

## Source

`docs/cc_screens_diff.md` — **D-74**, § Cross-cutting, severity P3.

## Checklist

- [ ] D-01 and D-51 are both the same missing concept. Add --lc-z-* tokens (workspace / sticky / panel / modal / toast) and use them everywhere position is set. <!-- longclaw:item=ck_54c1f45d -->

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
