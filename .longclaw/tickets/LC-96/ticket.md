---
format: longclaw.ticket/v1
id: e20d12c4-4a10-433d-95b0-dd52b9e5b547
key: LC-96
title: Ticket panel — the list/board paints on top of the panel
status: done
priority: urgent
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:01.063Z
updated_at: 2026-08-06T14:32:39.750Z
---

**Prototype.** The panel is the topmost surface; board/list are behind it

**App.** **The list/board paints on top of the panel.** With the list view behind, sticky group headers and rows punch opaque white bands across the panel: LC-119's Labels row is clipped, the `Checklist` heading is sliced in half, a checklist item is fully hidden, and the word `Show` from the Archived group renders *inside* the panel

## Plan

`.ticket-panel` is `position: fixed` with **no `z-index`** (`styles.css:1251-1265`), while `.list-group-header` is `position: sticky; z-index: 1` (`styles.css:1094-1097`). A positioned element with `z-index: 1` wins over one with `z-index: auto`. Fix: give `.ticket-panel` an explicit `z-index` above the workspace (and below the modal scrim at `:2371` / toast at `:2461`), then add a token-level stacking scale so this cannot recur. Same fix covers the raw-file view (D-52).

## Source

`docs/cc_screens_diff.md` — **D-01**, § Ticket panel, severity P0.

## Checklist

- [x] .ticket-panel is position: fixed with no z-index (styles.css:1251-1265), while .list-group-header is position: sticky; z-index: 1 (styles.css:1094-1097). A positioned element with z-index: 1 wins over one with z-index: auto. Fix: give .ticket-panel an explicit z-index above the workspace (and… <!-- longclaw:item=ck_98380666 -->

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

<!-- longclaw:event
id: evt_fc90bed9
kind: update
occurred_at: 2026-08-06T14:32:39.750Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: done
  - field: checklist.ck_98380666.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Fixed on fix/lc-96-panel-stacking-order (d932bca). .ticket-panel now takes --lc-z-panel, and every z-index in styles.css takes a layer from the new --lc-z-* scale (sticky · panel · modal · toast · popover) in design-tokens.json — D-74's scale, minus a workspace layer, which must stay auto: a stacking context on an ancestor of the board and list would trap the inline-rendered menu popover under the panel. The scrim needed its own layer, because source order stopped settling it once the panel had one. Two guards hold it: token-guard.mjs fails on a z-index that is not a token, and the new stacking-guard.mjs fails if a named surface declares no layer or if the order between two inverts — both confirmed red first. Verified in WebKit over the perf harness: of 801 points sampled inside the open panel over the list view, 27 belonged to the sticky group header before the fix and none after. LC-134's layering half is covered by the same change (.raw-file is an unpositioned child of the panel); its modal-vs-panel decision is not.
<!-- /longclaw:event -->
