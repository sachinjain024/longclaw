---
format: longclaw.ticket/v1
id: df6f7246-ced2-405a-9269-37674f9303b8
key: LC-69
title: App shell — A permanent ● watching chip (App.tsx:1237-1250), plus a WriteIndicator that only surfaces in the panel header
status: todo
priority: p2
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:00.642Z
updated_at: 2026-08-05T15:16:00.642Z
---

**Prototype.** Disk-state indicator: `⟳ writing ticket.md…` while a write is in flight, `✓ ticket.md` when settled, `ink-disabled`

**App.** A permanent `● watching` chip (`App.tsx:1237-1250`), plus a `WriteIndicator` that only surfaces in the panel header

## Source

`docs/cc_screens_diff.md` — **D-07**, § App shell, severity P2.

## Checklist

- [ ] Make disk-state idle-silent or ✓ ticket.md; reserve visible text for writing… / reconciling. The steady-state watching chip is dev telemetry, not designed chrome. <!-- longclaw:item=ck_785fe26a -->

## Activity

<!-- longclaw:event
id: evt_8e0108fe
kind: create
occurred_at: 2026-08-05T15:16:00.642Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
