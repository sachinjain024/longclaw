---
format: longclaw.ticket/v1
id: 07c105c5-ddec-4354-a479-a991af0a6276
key: LC-51
title: The startup-probe race
status: backlog
priority: p2
labels:
  - platform
  - post-mvp
created_at: 2026-08-05T14:23:17Z
updated_at: 2026-08-05T14:23:17Z
---

**The startup-probe race.** `LONGCLAW_EXIT_AFTER_FIRST_PROBE` can report a startup time for an empty board (`src/App.tsx:353`)

## Why now

Diagnostics-only and accepted for v0, but it is a measurement affordance that is silently wrong some fraction of the time — the worst failure mode a measurement can have. `perf:startup` works around it by waiting for a probe with rows; the probe should not need working around

## Source

`docs/backlog/post-mvp-backlog.md` — **P7**, Tier 2, owner Platform.

## Activity

<!-- longclaw:event
id: evt_47480986
kind: create
occurred_at: 2026-08-05T14:23:17Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
