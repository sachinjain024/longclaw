---
format: longclaw.ticket/v1
id: 9fc5e4ce-7d89-40ca-a0f2-911f347c923f
key: LC-71
title: App shell — new ticket carries a C kbd chip; filter field carries a ⌘F chip — Neither chip is rendered (no <kbd> outside CommandPalette.tsx:462,488)
status: done
priority: p2
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:00.672Z
updated_at: 2026-08-06T05:50:51.419Z
---

**Prototype.** `New ticket` carries a `C` kbd chip; filter field carries a `⌘F` chip

**App.** Neither chip is rendered (no `<kbd>` outside `CommandPalette.tsx:462,488`)

## Source

`docs/cc_screens_diff.md` — **D-09**, § App shell, severity P2.

## Checklist

- [x] Add <kbd> chips to the New-ticket button and the filter field. The keybindings already work. <!-- longclaw:item=ck_dae411ed -->

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

<!-- longclaw:event
id: evt_bd9cfb84
kind: update
occurred_at: 2026-08-06T05:50:51.419Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: done
  - field: checklist.ck_dae411ed.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Done in fix/lc-71-73-app-shell. `New ticket` carries a `C` chip and the filter field a `⌘F` chip, drawn as `prototype.js:495-506` has them — the chip overlaid inside the field's right edge, `pointer-events: none` so the whole box still focuses the input.

Both chips are `aria-hidden` and paired with `aria-keyshortcuts` (`C`, `Meta+F`), so the accessible names stay `New ticket` and `Filter tickets` instead of becoming `New ticket C`. That is the treatment `CreatePanel` and `DescriptionEditor` already use for their footer chips.

The `.primary kbd` rule is scoped to `.toolbar-actions`: `.editor-footer` owns a quieter chip treatment of its own, and letting a global rule reach it would have restyled the create and description footers as a side effect.
<!-- /longclaw:event -->
