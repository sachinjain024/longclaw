---
format: longclaw.ticket/v1
id: 019c8d20-1a2b-7c3d-9e4f-5a6b7c8d9e02
key: LC-88
title: An agent wrote this priority in its own hand
status: todo
priority: "p1"
labels:
  - reliability
created_at: 2026-07-30T09:00:00Z
updated_at: 2026-07-30T09:04:00Z
---

The priority above is double-quoted. That is legal YAML and LongClaw never
writes it that way, so any app write that reformats the line shows up as a
changed byte.

## Checklist

- [ ] Leave the priority exactly as it was written <!-- longclaw:item=ck_8801 -->

## Activity

<!-- longclaw:event
id: evt_8801
kind: update
occurred_at: 2026-07-30T09:04:00Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: priority
    from: none
    to: p1
-->
### Claude Code updated this ticket

Raised the priority after reading the failure report.
<!-- /longclaw:event -->
