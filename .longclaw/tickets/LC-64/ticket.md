---
format: longclaw.ticket/v1
id: 849756d7-4f2c-44d4-9441-73119284f104
key: LC-64
title: Fix Horizontal and Vertical Scroll in Board View
status: done
priority: none
created_at: 2026-08-05T14:47:24.368Z
updated_at: 2026-08-11T14:04:01.697Z
---

## Activity

<!-- longclaw:event
id: evt_69f0b7e7
kind: create
occurred_at: 2026-08-05T14:47:24.368Z
actor:
  type: human
  id: local
-->
### You created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_24280b2b
kind: update
occurred_at: 2026-08-05T15:14:39.791Z
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
id: evt_3e87af78
kind: update
occurred_at: 2026-08-11T14:04:01.697Z
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

Fixed. Both axes scroll, and each is now pinned by something other than a memory.

- **Horizontal.** `.board-grid` takes `overflow-x: auto` (`styles.css:1019-1025`), and the board carries a drag across a board wider than the window — `Board.tsx` `onGridDragOver` drives `driftAcross` from the pointer's distance to either edge, and stops the drift wherever the drag ends. LC-190 then made this observable: `probe:drag`'s sixth case scrolls the board sideways and drops into the far-right column, which is off the side of a 1440px window at six columns and reachable no other way.
- **Vertical.** `.board-column` is height-bounded by `--lc-size-board-stack` and `.board-stack` takes `overflow-y: auto` (`styles.css:1130-1134`). The bound sits on the whole column rather than on the stack inside it, so the column measures its own head and leaves the stack the remainder — that is LC-165, which also cut the token back from the 360px it was still reserving for the two-row header LC-67 collapsed. `useViewportHeight` measures the box rather than reading the token, so virtualization and layout cannot disagree, and `.board-sizer` is sized to the whole column so the scrollbar tells the truth about a column whose cards are not all rendered.

Filed 2026-08-05 as a bare title and fixed in passing by the shell and board work rather than against this key, which is why it was never closed. Closing it as observed in the tree.
<!-- /longclaw:event -->
