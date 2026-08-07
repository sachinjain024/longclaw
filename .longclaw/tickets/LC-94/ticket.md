---
format: longclaw.ticket/v1
id: 1f0fb715-ee2c-42eb-a895-834ffbf44404
key: LC-94
title: Issue list — degraded rows are hoisted into a synthetic Unreadable group at the bottom (src/grouping.ts:86-90)
status: in_progress
priority: p2
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:01.032Z
updated_at: 2026-08-07T03:36:40.450Z
---

**Prototype.** Degraded rows sit **in place**, with the row's own anatomy

**App.** Degraded rows are hoisted into a synthetic `Unreadable` group at the bottom (`src/grouping.ts:86-90`)

## Source

`docs/cc_screens_diff.md` — **D-36**, § Issue list, severity P2.

## Checklist

- [ ] See D-50 — decide once for both surfaces. <!-- longclaw:item=ck_0fc6225c -->

## Activity

<!-- longclaw:event
id: evt_c5754ecb
kind: create
occurred_at: 2026-08-05T15:16:01.032Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_06eff7f3
kind: update
occurred_at: 2026-08-07T03:36:40.450Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: in_progress
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->
