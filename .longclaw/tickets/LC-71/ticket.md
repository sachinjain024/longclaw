---
format: longclaw.ticket/v1
id: 9fc5e4ce-7d89-40ca-a0f2-911f347c923f
key: LC-71
title: App shell — new ticket carries a C kbd chip; filter field carries a ⌘F chip — Neither chip is rendered (no <kbd> outside CommandPalette.tsx:462,488)
status: todo
priority: p2
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:00.672Z
updated_at: 2026-08-05T15:16:00.672Z
---

**Prototype.** `New ticket` carries a `C` kbd chip; filter field carries a `⌘F` chip

**App.** Neither chip is rendered (no `<kbd>` outside `CommandPalette.tsx:462,488`)

## Source

`docs/cc_screens_diff.md` — **D-09**, § App shell, severity P2.

## Checklist

- [ ] Add <kbd> chips to the New-ticket button and the filter field. The keybindings already work. <!-- longclaw:item=ck_dae411ed -->

## Activity

<!-- longclaw:event
id: evt_685d2218
kind: create
occurred_at: 2026-08-05T15:16:00.672Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
