---
format: longclaw.ticket/v1
id: 73d7b411-6c4c-40d8-a973-df112bbc888c
key: LC-46
title: V0-42 — an interaction-budget gate that works on a CI runner
status: canceled
priority: p1
labels:
  - frontend
  - post-mvp
created_at: 2026-08-05T14:23:17Z
updated_at: 2026-08-11T14:02:05.497Z
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

<!-- longclaw:event
id: evt_825c5ae7
kind: update
occurred_at: 2026-08-11T14:02:05.497Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: backlog
    to: canceled
-->
### Claude Code updated this ticket

Duplicate of LC-38, which tracks the same work and stays open.

Both are one backlog row seen from two registers: LC-38 is `v0-backlog.md` V0-42, and this ticket is `post-mvp-backlog.md` P3, whose own text points at it — "V0-42 — an interaction-budget gate that works on a CI runner. The row has the full argument". Both were imported on 2026-08-05 in the same batch, and neither noticed the other.

Closing this one rather than LC-38 because LC-38 carries the argument: the CI job added and removed on 2026-08-01, run 30675271000, filter p95 86 ms at 5,000 tickets and 77 ms at the harness's own 600-ticket floor against a 194 ms local first paint. `AGENTS.md` also names V0-42 as the open item for a gate that works on a runner.

The work is not done. It is tracked in LC-38.
<!-- /longclaw:event -->
