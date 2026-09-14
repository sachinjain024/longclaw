---
format: longclaw.ticket/v1
id: 45379055-10d7-4de3-a564-50740d80a02d
key: LC-253u
title: The 16ms p50 interaction budget cannot be met as written
status: todo
priority: p3
labels:
  - platform
type: chore
created_at: 2026-09-14T07:28:57.075Z
updated_at: 2026-09-14T07:29:17.997Z
---

[The release-candidate gate](../../../docs/acceptance/release-candidate.md#performance-report)
sets board and list interaction at **p95 ≤ 50 ms and p50 ≤ 16 ms**. The second
half cannot be met by any interaction the harness measures, and a run that
appeared to meet it would be measuring something other than what it claims.

Every measurement in `board-trace.mjs` ends in a timer scheduled inside a
`requestAnimationFrame` callback, so it quantizes to the animation-frame
interval. One frame at 60 Hz is **16.7 ms** — already above the 16 ms line
before the app does any work at all. The harness's own docblock says so where it
defines the floor (`apps/desktop/perf/board-trace.mjs:500`): no input → paint
measurement can come in under that line, which is why its check is the
600-ticket floor comparison rather than the absolute median.

The 2026-09-14 release run is what surfaced it. Scroll measured p50 18 ms on the
board and 17 ms on the list, against floors of 17 and 17 — *identical*, so 5,000
tickets cost nothing and the overage is the frame, not the product. The harness
passed the run; the gate's stated budget did not.

Three ways this is wrong, in descending order of how much they matter:

- **It reads as a silent failure.** Anyone checking the run against the written
  budget finds two rows over and no explanation, and the natural repair is to
  chase a product regression that is not there.
- **It invites greening.** The obvious fix is to quote only p95, which the gate
  explicitly forbids — "a candidate that quotes only p95 has not reported
  against the budget".
- **A p50 that did come in under 16 ms would be evidence of a broken harness,**
  not a fast app. Nothing that waits for a paint can beat a frame.

What the budget is actually trying to say is that an interaction should cost no
more than one frame. Written as an absolute median that is unmeasurable; written
as "p50 within one frame of the floor" it is exactly what the harness already
checks. Restating it that way makes the gate and the harness agree, which is the
point — they disagree today and the harness is the one that is right.

Do not change the harness's check. It is correct. The document is what is wrong.


## Checklist

- [ ] Restate the p50 row in release-candidate.md as within one frame of the 600-ticket floor <!-- longclaw:item=ck_3c37306a -->
- [ ] Say in the same section why an absolute sub-frame median is not measurable <!-- longclaw:item=ck_91849761 -->
- [ ] Check no other budget in the gate assumes a sub-frame absolute number <!-- longclaw:item=ck_813a0582 -->
## Activity

<!-- longclaw:event
id: evt_f0e0e50b
kind: create
occurred_at: 2026-09-14T07:28:57.075Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_3e418343
kind: update
occurred_at: 2026-09-14T07:29:17.936Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: description
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_f57da154
kind: update
occurred_at: 2026-09-14T07:29:17.959Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_3c37306a.added
    to: Restate the p50 row in release-candidate.md as within one frame of the 600-ticket floor
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_7fe645a4
kind: update
occurred_at: 2026-09-14T07:29:17.981Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_91849761.added
    to: Say in the same section why an absolute sub-frame median is not measurable
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_d5e0a686
kind: update
occurred_at: 2026-09-14T07:29:17.997Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_813a0582.added
    to: Check no other budget in the gate assumes a sub-frame absolute number
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->
