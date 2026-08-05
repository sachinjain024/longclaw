---
format: longclaw.ticket/v1
id: 73d7b411-6c4c-40d8-a973-df112bbc888c
key: LC-46
title: V0-42 — an interaction-budget gate that works on a CI runner
status: backlog
priority: p1
labels:
  - frontend
  - post-mvp
created_at: 2026-08-05T14:23:17Z
updated_at: 2026-08-05T14:23:17Z
---

**V0-42 — an interaction-budget gate that works on a CI runner.** [The row](../../../docs/backlog/v0-backlog.md) has the full argument

## Why now

Two must-pass budgets are backed by "somebody remembered to run it". A CI job was tried and correctly removed: a shared runner is ~6x slower and misses ≤50 ms p95 even at the 600-ticket floor, so it measured the machine

## Source

`docs/backlog/post-mvp-backlog.md` — **P3**, Tier 1, owner Frontend.

## Checklist

- [ ] A regression in board or list interaction cost is caught by something other than a human's memory, on an unmodified tree, repeatedly, saying what it measured and on what hardware <!-- longclaw:item=ck_e2a0a9dc -->

## Activity

<!-- longclaw:event
id: evt_8439289d
kind: create
occurred_at: 2026-08-05T14:23:17Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
