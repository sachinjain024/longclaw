---
format: longclaw.ticket/v1
id: 4e1ef5b2-6c8b-43a5-b4a4-ef8298ef8807
key: LC-123
title: Command palette — sub-mode footer reads esc back; root reads esc close — Both read esc close/back
status: done
priority: p3
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:01.470Z
updated_at: 2026-08-07T05:41:04.321Z
---

**Prototype.** Sub-mode footer reads `esc back`; root reads `esc close`

**App.** Both read `esc close/back`

## Source

`docs/cc_screens_diff.md` — **D-4H**, § Command palette, severity P3.

## Checklist

- [x] Make it context-accurate — the palette's back-vs-close behaviour is one of its nicer details and the legend currently hides it. <!-- longclaw:item=ck_9ed91656 -->

## Activity

<!-- longclaw:event
id: evt_f2df8a92
kind: create
occurred_at: 2026-08-05T15:16:01.470Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_443068be
kind: update
occurred_at: 2026-08-07T05:41:04.321Z
actor:
  type: agent
  id: codex
  name: Codex
changes:
  - field: status
    from: todo
    to: done
  - field: checklist.ck_9ed91656.checked
    from: "false"
    to: "true"
-->
### Codex updated this ticket
<!-- /longclaw:event -->
