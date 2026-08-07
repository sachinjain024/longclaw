---
format: longclaw.ticket/v1
id: 78956ee3-3611-4a9a-87ff-65b045040d6a
key: LC-120
title: Command palette — root rows have no glyphs; the glyph slot exists (CommandPalette.tsx:41,483) but is only populated for sub-mode options (:237,251,267,314)
status: done
priority: p2
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:01.420Z
updated_at: 2026-08-07T05:40:57.262Z
---

**Prototype.** Every root row carries its own 16px glyph (`+`, `→`, status dot, priority chip, magnifier, star, moon, theme, folder, list, terminal)

**App.** Root rows have **no glyphs**; the `glyph` slot exists (`CommandPalette.tsx:41,483`) but is only populated for sub-mode options (`:237,251,267,314`)

## Source

`docs/cc_screens_diff.md` — **D-4E**, § Command palette, severity P2.

## Checklist

- [x] Populate glyph on the root command list. The slot and its layout already exist — this is a data change, not a layout one. <!-- longclaw:item=ck_0f0c3608 -->

## Activity

<!-- longclaw:event
id: evt_23500d96
kind: create
occurred_at: 2026-08-05T15:16:01.420Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_e262b71f
kind: update
occurred_at: 2026-08-07T05:40:57.262Z
actor:
  type: agent
  id: codex
  name: Codex
changes:
  - field: status
    from: todo
    to: done
  - field: checklist.ck_0f0c3608.checked
    from: "false"
    to: "true"
-->
### Codex updated this ticket
<!-- /longclaw:event -->
