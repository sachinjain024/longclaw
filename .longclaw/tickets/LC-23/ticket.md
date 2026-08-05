---
format: longclaw.ticket/v1
id: a5aa7858-ef5b-473e-90eb-d1e54d8e3a8a
key: LC-23
title: Arrow and j/k navigation, predictable focus return, and the escape contract
status: todo
priority: p2
labels:
  - frontend
  - v0-backlog
created_at: 2026-08-05T14:23:03Z
updated_at: 2026-08-05T14:23:03Z
---

Arrow and `j`/`k` navigation, predictable focus return, and the escape contract

## Why it exists

Focus lost behind a panel or modal is the failure mode that makes keyboard support unusable in practice.

## Source

`docs/backlog/v0-backlog.md` — **V0-23**, Wave 2, step 12, owner Frontend.

## Checklist

- [ ] Automated focus tests for the critical flows: focus is never lost behind the panel, a modal, a menu, or the palette, and returns where the map says <!-- longclaw:item=ck_740e7c40 -->

## Activity

<!-- longclaw:event
id: evt_d3128257
kind: create
occurred_at: 2026-08-05T14:23:03Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
