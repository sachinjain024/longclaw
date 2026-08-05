---
format: longclaw.ticket/v1
id: 5d4029e7-80d5-4bc2-9092-8c0169209c4f
key: LC-93
title: Issue list — just now wraps onto two lines inside the 46px slot, making those rows visibly taller than their neighbours
status: todo
priority: p2
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:01.017Z
updated_at: 2026-08-05T15:16:01.017Z
---

**Prototype.** Relative time is a fixed 46px right-aligned column: `40m`, `3h`, `2d`

**App.** `just now` **wraps onto two lines** inside the 46px slot, making those rows visibly taller than their neighbours

## Source

`docs/cc_screens_diff.md` — **D-35**, § Issue list, severity P2.

## Checklist

- [ ] Either widen the slot or shorten the string (now). src/freshness.ts / listRow.ts. <!-- longclaw:item=ck_68b4ca0d -->

## Activity

<!-- longclaw:event
id: evt_e2c93d71
kind: create
occurred_at: 2026-08-05T15:16:01.017Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
