---
format: longclaw.ticket/v1
id: 14eec160-4879-4270-9c6c-96d8191cea74
key: LC-119
title: Full create — the checklist fraction reads 0/0 in create mode before any item exists
status: done
priority: p3
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:01.405Z
updated_at: 2026-08-07T17:03:30.231Z
---

**Prototype.** No checklist counter in create mode

**App.** `0/0`

## Source

`docs/cc_screens_diff.md` — **D-4D**, § Full create, severity P3.

## Checklist

- [x] Draw no fraction in create mode at any length, per the prototype cell. <!-- longclaw:item=ck_4060a40f -->

## Activity

<!-- longclaw:event
id: evt_e5278c81
kind: create
occurred_at: 2026-08-05T15:16:01.405Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_7968dc2d
kind: update
occurred_at: 2026-08-07T17:03:30.231Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: done
  - field: checklist.ck_4060a40f.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_5cb72666
kind: comment
occurred_at: 2026-08-08T04:15:40.501Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Shipped the prototype cell rather than this ticket's checklist wording: the counter is gone from create mode at every length, not just at zero. `createPanelHTML` (`prototype.js:889`) draws none at all, and D-49 already settled that the prototype cell wins where the two disagree. It is also the stronger design — every draft item is open by construction, so the numerator can never move.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_5482650b
kind: comment
occurred_at: 2026-08-08T08:39:27.431Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Amended this item's wording to the behaviour that shipped. It read "Hide the fraction until there is a first item" and stayed ticked against code that draws no counter at any length, so the record contradicted CreatePanel.tsx and the D-4D row that settled it. The decision is unchanged and the marker is the same; only the sentence describing it was wrong.
<!-- /longclaw:event -->
