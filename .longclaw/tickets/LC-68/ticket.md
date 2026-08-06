---
format: longclaw.ticket/v1
id: 949a555c-3a6c-4260-b8d9-9f3cfb7d0b4c
key: LC-68
title: App shell — path is a bare wrapping <code> that consumes two lines for a long path
status: done
priority: p2
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:00.623Z
updated_at: 2026-08-06T07:14:02.945Z
---

**Prototype.** Path is a **chip**: mono 12px, folder glyph, `wash` on hover, click copies, truncated to the header

**App.** Path is a bare wrapping `<code>` that consumes two lines for a long path

## Source

`docs/cc_screens_diff.md` — **D-06**, § App shell, severity P2.

## Checklist

- [x] Add a path-chip component: folder glyph + text-overflow: ellipsis, max-width, title = full path, click → clipboard + toast. Style per screen-specs.md:44-47. <!-- longclaw:item=ck_36d64d11 -->

## Activity

<!-- longclaw:event
id: evt_bcd742dd
kind: create
occurred_at: 2026-08-05T15:16:00.623Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_faead2fc
kind: comment
occurred_at: 2026-08-06T05:18:35.548Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Part of this landed early under LC-67 (526c90e), because the one-row header could not hold without it: `.content-header .project-path` now has `max-width: 180px`, `overflow: hidden`, `white-space: nowrap`, `text-overflow: ellipsis` and `title={project.rootPath}`. An uncapped, wrapping path was what pushed the control row onto a second line.

What D-06 still owes, and what this ticket is: the folder glyph, `wash` on hover, click-to-copy with the toast, tilde abbreviation, and the chip's own box (radius, padding, background) per `screen-specs.md:44-47`. The 180px cap was chosen to make the row fit, not from the chip's design — revisit it here.

Recorded so the prerequisite is visible from this side too.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_60a2fec5
kind: update
occurred_at: 2026-08-06T07:14:02.945Z
actor:
  type: agent
  id: codex
  name: Codex
changes:
  - field: status
    from: todo
    to: done
  - field: checklist.ck_36d64d11.checked
    from: "false"
    to: "true"
-->
### Codex updated this ticket

Implemented the project path chip and addressed review feedback: the visible path abbreviates only the actual native home-directory prefix, paths under other users remain absolute, the title preserves the exact full path, and copy uses the full absolute path with success/failure toast feedback. Added the native home_dir command, frontend coverage, and the strict WebKit harness stub. Validation passed: npm run verify; 533 frontend tests; 127 Rust unit tests plus integration suites; accessibility audit A1-A5.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_f1c6606a
kind: comment
occurred_at: 2026-08-06T07:45:54.784Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

The rename left the visual-regression gate red. `theme-matrix.mjs` probed `.content-header .project-path` in two places (its contrast list for both the board and list states), and the chip is `.path-chip`, so every axis reported `probe .content-header .project-path matched nothing` and `npm run matrix` exited 1 on `main`.

Found while merging LC-71/72/73, and repaired there rather than dropped: the probe exists to prove the header's quiet text against the background — `.eyebrow`, then `.project-path`, now the chip — so it follows the element. Worth noting the pair it measures got easier, `ink-2` instead of `ink-3`; the comment in the probe list now says so.

No defect in the chip itself. With the selector corrected the matrix is clean across 8 axes × 9 states.
<!-- /longclaw:event -->
