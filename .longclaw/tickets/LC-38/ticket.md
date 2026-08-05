---
format: longclaw.ticket/v1
id: 3dddb804-8b7b-40d4-9131-445710de5173
key: LC-38
title: An interaction-budget gate that works on a CI runner
status: todo
priority: p3
labels:
  - frontend
  - v0-backlog
created_at: 2026-08-05T14:23:15Z
updated_at: 2026-08-05T14:23:15Z
---

An interaction-budget gate that works on a CI runner

## Why it exists

V0-06 and V0-14 both carry an interaction budget as a must-pass, and both are currently backed by a run somebody remembered to do. A CI job was added on 2026-08-01 to fix that and removed the same day: a shared macOS runner is ~6x slower than a developer Mac and misses the ≤ 50 ms p95 at **any** project size (run 30675271000 — filter p95 86 ms at 5,000 tickets and **77 ms at the harness's own 600-ticket floor**, first paint 1226 ms against 194 ms locally). The ≤ 50 ms figure is a Step 4 product budget for real hardware; raising it to fit a runner would green the gate rather than keep it. What is machine-independent is the full run tracking its own floor — which is what the floor exists for — but one noisy run is not enough to calibrate a threshold from (scroll floor n=16, so its p95 is effectively its max).

## Source

`docs/backlog/v0-backlog.md` — **V0-42**, Wave 3, step 16, owner Frontend.

## Checklist

- [ ] A regression in board or list interaction cost is caught by something other than a human remembering; the check passes on an unmodified tree across repeated runs, and states what it measures and on what hardware <!-- longclaw:item=ck_e00b2946 -->

## Activity

<!-- longclaw:event
id: evt_1933637f
kind: create
occurred_at: 2026-08-05T14:23:15Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
