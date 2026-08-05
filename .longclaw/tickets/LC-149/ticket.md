---
format: longclaw.ticket/v1
id: e4ea0aca-c3ee-42ad-8d12-0966d95441ca
key: LC-149
title: Toasts and undo — while a write was in flight the header control row reflowed onto two lines and the ordering control was clipped
status: todo
priority: p2
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:01.880Z
updated_at: 2026-08-05T15:16:01.880Z
---

**Prototype.** The content header is a fixed row and does not move

**App.** While a write was in flight the header control row **reflowed onto two lines** and the ordering control was clipped

## Source

`docs/cc_screens_diff.md` — **D-65**, § Toasts and undo, severity P2.

## Checklist

- [ ] The controls row has no minimum width protection; the transient write indicator pushes it over. Give the row flex-wrap: nowrap with min-width: 0 on the filter field, or reserve the indicator's width. <!-- longclaw:item=ck_d7e760f3 -->

## Activity

<!-- longclaw:event
id: evt_9ab57f80
kind: create
occurred_at: 2026-08-05T15:16:01.880Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
