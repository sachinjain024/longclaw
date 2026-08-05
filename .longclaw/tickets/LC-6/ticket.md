---
format: longclaw.ticket/v1
id: 4028ed7d-ec28-42ed-8b63-b1f735b4c0d5
key: LC-6
title: Virtualize board and list lanes, subscribe through selectors, and enforce an input-to-paint budget
status: done
priority: urgent
labels:
  - frontend
  - v0-backlog
created_at: 2026-08-05T14:22:49Z
updated_at: 2026-08-05T14:22:50Z
---

Virtualize board and list lanes, subscribe through selectors, and enforce an input-to-paint budget

## Why it exists

The spike proved the data flow, not 5,000 rendered cards. The register asks for this *before* Phase 1 breadth, because the list surface in Wave 1 is the thing that renders them.

## Must-pass

Done 2026-07-31 for the board. `npm run perf:board` traces 5,000 tickets in WebKit at 18 ms p95 keyboard, 22 ms p95 scroll, 20 ms p95 external write, against a ≤ 50 ms p95 budget. Lanes are windowed and cards memoized per ticket; the list surface lands on the same geometry under V0-14. **Amended 2026-08-01, then corrected the same day:** a CI job was added to enforce the budget rather than report it, and removed hours later the first time it ran on a runner — a shared macOS runner misses the ≤50ms p95 even at the harness's 600-ticket floor size (run 30675271000: filter floor p95 77ms, first paint 1226ms against 194ms locally). The budget is a Step 4 real-hardware number and the runner is ~6x slower, so the job was measuring the machine. **The budget is enforced locally and nowhere else**, which is where this row started; V0-42 is the open item for a gate that works on a runner. See V0-14

## Source

`docs/backlog/v0-backlog.md` — **V0-06**, Wave 0, step 16, owner Frontend.

## Checklist

- [x] Done 2026-07-31 for the board. npm run perf:board traces 5,000 tickets in WebKit at 18 ms p95 keyboard, 22 ms p95 scroll, 20 ms p95 external write, against a ≤ 50 ms p95 budget. Lanes are windowed and cards memoized per ticket; the list surface lands on the same geometry under V0-14. Amended… <!-- longclaw:item=ck_a5a30673 -->

## Activity

<!-- longclaw:event
id: evt_d0732e87
kind: create
occurred_at: 2026-08-05T14:22:49Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_fe567f3f
kind: update
occurred_at: 2026-08-05T14:22:50Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_a5a30673.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Imported from `docs/backlog/v0-backlog.md`. The must-pass verification for V0-06 is recorded there as passed.
<!-- /longclaw:event -->
