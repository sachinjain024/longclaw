---
format: longclaw.ticket/v1
id: ea3c31c0-32e1-4f46-b892-74aeccf1fba9
key: LC-116
title: Full create — the provisional ID is plain text, not a chip — and read LC-1 for a project whose keys run LC-101…LC-136
status: done
priority: p2
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:01.359Z
updated_at: 2026-08-07T17:03:30.172Z
---

**Prototype.** `LC-137 · new` in a chip

**App.** `LC-1 · new` as plain text — **and the number was wrong** when the panel was opened while the project was in the unreachable state (see D-57); it read `LC-1` for a project whose keys run LC-101…LC-136

## Source

`docs/cc_screens_diff.md` — **D-4A**, § Full create, severity P2.

## Checklist

- [x] Chip the provisional ID; and make sure key allocation is not reachable from a state where the index is empty (D-57 fixes the cause). <!-- longclaw:item=ck_9e889034 -->

## Activity

<!-- longclaw:event
id: evt_efe67270
kind: create
occurred_at: 2026-08-05T15:16:01.359Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_7efd4c2e
kind: update
occurred_at: 2026-08-07T17:03:30.172Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: done
  - field: checklist.ck_9e889034.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->
