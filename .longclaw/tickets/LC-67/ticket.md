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

<!-- longclaw:event
id: evt_da58fc16
kind: comment
occurred_at: 2026-08-06T05:18:51.017Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Review follow-up (42b20bb).

**Header geometry (P2) — fixed.** The row had `padding: 4px 0` leaning on `.main-panel`'s 28px, so the spec's 16/12 rhythm and 24px side inset appeared nowhere in the CSS. Now `padding: 16px 0 12px` with `.main-panel` at `28px 24px`. Measured: 58px tall, 24px inset, first board column at y≈94 against the y≈100 this ticket names. It is 58 rather than 56 because `screen-specs.md`'s diagram assumes a 28px control and this app's buttons are 30px (`components.md:42-57`) — the padding is the specified number; the height is what that padding plus a real control row comes to.

**One row at the default window (P1) — stands, and is now measured rather than argued.** At 1180px the header has 892px. With the path element removed *entirely* the row still needs 912px and still renders as two rows: h1 162 + Star 52 + Settings 77 + controls 585 + gaps 36. A 20px deficit with nothing left to give, so no arrangement of what LC-67 owns closes it. The controls at 585px are the surface: the `watching` pill (LC-69) and the Star button plus text Settings (LC-70) are ~200px of it.

**Path truncation (P3) — recorded on LC-68.** The cap, ellipsis and `title` are D-06's, taken early because the row could not hold without them; LC-68 now carries a note saying so and what it still owes.

**Process.** `npm run verify` was not run before the first commit — `npm run check` and the targeted gates were. Run in full now: `verify` (check + the native watcher round trip), `a11y:audit`, `matrix`, all exit 0.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_07faafcb
kind: comment
occurred_at: 2026-08-06T05:23:39.368Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

**Changed**

- Collapsed `project-toolbar` + `board-heading` into one `.content-header`: identity left, controls right.
- Dropped the `LOCAL PROJECT` eyebrow and the `Board`/`List` heading; `GENERATION n` moved into the dev trace strip.
- Star and Settings moved inline, right of the project name.
- Controls now render only when `project.reachable` — the old `board-heading` got that from sitting inside the workspace.
- Header padding is the spec's 16/12 (`screen-specs.md:44`); `.main-panel` carries the 24px side inset.
- Path capped at 180px, ellipsed, full path on `title` — an uncapped path was what broke the row. Prerequisite taken from LC-68.
- Header wraps as a whole, never inside the control cluster, so a break cannot strand a control (LC-149).

**Result**

- First board column: y≈275 → **y≈94**. Row height 58px, side inset 24px.
- One row at ≥1440px.
- Two rows at the 1180px default window: 912px needed against 892px available *with the path removed entirely*. Not closable here — LC-69 (`watching` pill) and LC-70 (Star, gear Settings) are ~200px of the 585px control cluster.

**Harness**

- Repointed `.board-heading`/`.project-toolbar` selectors in `a11y-audit.mjs` and `theme-matrix.mjs`.
- Matrix `.eyebrow` contrast probe → `.content-header .project-path` (same ink-3-on-bg pairing, on an element that still exists).
- Tests wait on the pressed `Board` view-segment button instead of the removed heading.

**Gates:** `verify`, `a11y:audit`, `matrix`, `perf:board`, `perf:list` — all exit 0.
<!-- /longclaw:event -->
