---
format: longclaw.ticket/v1
id: 949a555c-3a6c-4260-b8d9-9f3cfb7d0b4c
key: LC-68
title: App shell — path is a bare wrapping <code> that consumes two lines for a long path
status: todo
priority: p2
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:00.623Z
updated_at: 2026-08-05T15:16:00.623Z
---

**Prototype.** Path is a **chip**: mono 12px, folder glyph, `wash` on hover, click copies, truncated to the header

**App.** Path is a bare wrapping `<code>` that consumes two lines for a long path

## Source

`docs/cc_screens_diff.md` — **D-06**, § App shell, severity P2.

## Checklist

- [ ] Add a path-chip component: folder glyph + text-overflow: ellipsis, max-width, title = full path, click → clipboard + toast. Style per screen-specs.md:44-47. <!-- longclaw:item=ck_36d64d11 -->

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
