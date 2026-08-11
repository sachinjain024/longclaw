---
format: longclaw.ticket/v1
id: 97ba8f38-6f09-4d4f-b238-51e986cad104
key: LC-65
title: Cmd+K Pallette is overlapping with List View Backlog Header
status: done
priority: none
created_at: 2026-08-05T14:48:38.000Z
updated_at: 2026-08-11T14:04:01.717Z
---

## Activity

<!-- longclaw:event
id: evt_43851d8a
kind: create
occurred_at: 2026-08-05T14:48:38.000Z
actor:
  type: human
  id: local
-->
### You created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_2254b330
kind: update
occurred_at: 2026-08-05T15:14:39.809Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: backlog
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_e586a1e9
kind: update
occurred_at: 2026-08-11T14:04:01.717Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: backlog
    to: done
-->
### Claude Code updated this ticket

Fixed by the stacking-order scale, and the pairing that broke it is now guarded.

The palette opens on `.modal-scrim` (`CommandPalette.tsx:530`), which takes `--lc-z-modal` — layer 4. The list's group headers, the "Backlog" header this ticket saw the palette come out under, are `.list-group-header` at `--lc-z-sticky` — layer 2 (`styles.css:1781-1783`). Four is over two, so the palette is over the header.

The underlying defect was that no scale existed: a sticky header's claim to be over what scrolls under it only holds while nothing positioned is added above it, and a positioned element with any layer outranks one with `auto`. That is LC-96 and LC-154. The six layers are now declared in order — drag 1, sticky 2, panel 3, modal 4, toast 5, popover 6 — `token-guard.mjs` refuses a `z-index` that is not an `--lc-z-*` token, and `stacking-guard.mjs` goes further and reads the **pairs**, because neither declaration in a bad pair is wrong on its own. The panel-over-sticky-header relation it checks is the same relation that closes this ticket.

Filed 2026-08-05 as a bare title, fixed in passing, never closed. Closing it as observed.
<!-- /longclaw:event -->
