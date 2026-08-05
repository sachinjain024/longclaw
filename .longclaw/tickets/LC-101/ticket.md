---
format: longclaw.ticket/v1
id: 02efc3fd-9c0b-45c4-9689-e2df24c91b3f
key: LC-101
title: Ticket panel — path is rendered by WriteIndicator, so it is the disk-state line, and it shows the full .longclaw/tickets/… prefix with no glyph
status: todo
priority: p2
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:01.136Z
updated_at: 2026-08-05T15:16:01.136Z
---

**Prototype.** Path shows as `tickets/LC-128/ticket.md` with a folder glyph, **beside** a separate disk-state line

**App.** Path is rendered *by* `WriteIndicator`, so it is the disk-state line, and it shows the full `.longclaw/tickets/…` prefix with no glyph

## Source

`docs/cc_screens_diff.md` — **D-39**, § Ticket panel, severity P2.

## Checklist

- [ ] Split the two: a static path chip plus the transient disk-state. Merging them means the path flickers on every write. <!-- longclaw:item=ck_b620f47f -->

## Activity

<!-- longclaw:event
id: evt_ae862dac
kind: create
occurred_at: 2026-08-05T15:16:01.136Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
