---
format: longclaw.ticket/v1
id: 8f5ced92-b221-45c3-8074-39b991b4d078
key: LC-67
title: App shell — three stacked blocks totalling ~230px before the first card; board/list start at y≈275 instead of y≈100
status: done
priority: p1
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:00.603Z
updated_at: 2026-08-06T04:50:35.954Z
---

**Prototype.** One 56px header row; project name and controls on the same line

**App.** Three stacked blocks totalling ~230px before the first card; board/list start at y≈275 instead of y≈100

## Source

`docs/cc_screens_diff.md` — **D-05**, § App shell, severity P1.

## Checklist

- [x] Collapse project-toolbar and board-heading into a single flex row in App.tsx:1106-1256. Drop the LOCAL PROJECT eyebrow and the <h2>Board/List</h2> heading — the view segment already says which view is active. Move Star and Settings inline, right of the project name. <!-- longclaw:item=ck_d0fc5e5a -->

## Activity

<!-- longclaw:event
id: evt_9b05c778
kind: create
occurred_at: 2026-08-05T15:16:00.603Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_245735e4
kind: update
occurred_at: 2026-08-06T04:50:35.954Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: done
  - field: checklist.ck_d0fc5e5a.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Collapsed into one `.content-header` (526c90e). The `LOCAL PROJECT` eyebrow and the `Board`/`List` heading are gone; `GENERATION n` moved into the dev trace strip; Star and Settings sit inline right of the project name; the control cluster hangs off `project.reachable`, which the old `board-heading` got for free by sitting inside the workspace.

Two things the row needed that were not on the checklist: the path is capped at 180px and ellipsed with the full path on `title` (an uncapped path was what pushed the controls onto a second line — the chip treatment itself is still LC-68), and the header wraps as a whole rather than inside the control cluster, so a break moves the cluster down intact instead of stranding one control (LC-149).

Measured in WebKit at 1440px and 1500px: the first board column header moved from y≈275 to y≈82, and the row holds with a long path and a long project name. At the 1180px default window it is still two rows — the identity block plus the 585px control cluster exceed the width even with the path hidden, so this is not reachable from here. The ~200px that closes it is the `watching` pill (LC-69) and the Star button plus text Settings (LC-70).

Gate: `npm run check`, `a11y:audit` (A5 200% zoom green), `matrix` (8 axes × 9 states), `perf:board`, `perf:list` all pass. The `.board-heading`/`.project-toolbar` selectors in `a11y-audit.mjs` and `theme-matrix.mjs` were repointed, and the matrix's `.eyebrow` contrast probe on the board and list surfaces became `.content-header .project-path` — the same ink-3-on-bg pairing, on the element that still exists.
<!-- /longclaw:event -->
