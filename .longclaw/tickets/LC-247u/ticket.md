---
format: longclaw.ticket/v1
id: 0f2d66b6-ae3d-4464-942f-a4650b66adbb
key: LC-247u
title: The labels editor's row overflows the settings section at the app's minimum window width
status: todo
priority: p3
labels:
  - frontend
created_at: 2026-09-08T12:53:34.650Z
updated_at: 2026-09-08T12:53:50.658Z
---

Measured in WebKit while building LC-227's Properties pane, with the Labels pane
as the control in the same run.

`.label-row` is `grid-template-columns: 86px minmax(90px, 1fr) max-content 18px`
with three 12px gaps, so its smallest is about **282px**. At the smallest window
`tauri.conf.json` allows — `minWidth: 760` — the settings panel is `48vw` = 365px,
of which the nav takes 124 and the section's padding 32, leaving **208px** of
content. The rows overflow it by 51px and the section scrolls sideways.

Nothing is stranded: `.settings-section` has `overflow-y: auto`, which makes its
`overflow-x` a scroller too, so the colour trigger and the remove button are
reachable by scrolling. But a settings pane that scrolls sideways is the defect
`a11y:audit` A5 exists to catch one surface over, and this width is reachable by
dragging a window edge rather than only by zoom.

Measured at 1440 · 1180 · 1024 · 980 · 760: clean at every width above 760.

## What it is not

Not LC-227's. The Properties pane draws the same row and overflowed by 74px —
51 of them this, and 23 the `.property-config` indent, which that ticket dropped
under 980px so the two panes overflow identically. Fixing this fixes both.

## The likely shape of a fix

The colour trigger and the remove button are fixed; the slug column is 86px for
names that are usually shorter. Either the slug column gives ground below 980px,
or the row stacks the way `.settings-identity` already does at that breakpoint —
the same media query, and the same reasoning: a field that has run out of room is
unusable in a way a taller row is not.

## Activity

<!-- longclaw:event
id: evt_ba67fd86
kind: create
occurred_at: 2026-09-08T12:53:34.650Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_6d4a7531
kind: update
occurred_at: 2026-09-08T12:53:50.658Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: description
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->
