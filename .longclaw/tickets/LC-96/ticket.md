---
format: longclaw.ticket/v1
id: e20d12c4-4a10-433d-95b0-dd52b9e5b547
key: LC-96
title: Ticket panel — the list/board paints on top of the panel
status: todo
priority: urgent
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:01.063Z
updated_at: 2026-08-05T15:16:01.063Z
---

**Prototype.** The panel is the topmost surface; board/list are behind it

**App.** **The list/board paints on top of the panel.** With the list view behind, sticky group headers and rows punch opaque white bands across the panel: LC-119's Labels row is clipped, the `Checklist` heading is sliced in half, a checklist item is fully hidden, and the word `Show` from the Archived group renders *inside* the panel

## Plan

`.ticket-panel` is `position: fixed` with **no `z-index`** (`styles.css:1251-1265`), while `.list-group-header` is `position: sticky; z-index: 1` (`styles.css:1094-1097`). A positioned element with `z-index: 1` wins over one with `z-index: auto`. Fix: give `.ticket-panel` an explicit `z-index` above the workspace (and below the modal scrim at `:2371` / toast at `:2461`), then add a token-level stacking scale so this cannot recur. Same fix covers the raw-file view (D-52).

## Source

`docs/cc_screens_diff.md` — **D-01**, § Ticket panel, severity P0.

## Checklist

- [ ] .ticket-panel is position: fixed with no z-index (styles.css:1251-1265), while .list-group-header is position: sticky; z-index: 1 (styles.css:1094-1097). A positioned element with z-index: 1 wins over one with z-index: auto. Fix: give .ticket-panel an explicit z-index above the workspace (and… <!-- longclaw:item=ck_98380666 -->

## Activity

<!-- longclaw:event
id: evt_f2359147
kind: create
occurred_at: 2026-08-05T15:16:01.063Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
