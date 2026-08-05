---
format: longclaw.ticket/v1
id: 1872ed6e-b94d-401d-b3fc-2cfb0136ea50
key: LC-27
title: "Partially written files: debounce, stability check, retry on later events"
status: done
priority: p3
labels:
  - storage
  - v0-backlog
created_at: 2026-08-05T14:23:04Z
updated_at: 2026-08-05T14:23:05Z
---

~~Partially written files: debounce, stability check, retry on later events~~ **Done 2026-08-02** — watcher stability checks already let partial writes settle to final content, retries later events, and does not rewrite invalid intermediate bytes. [Plan 38](../../../docs/plans/completed/38-complete-step-14-recovery.md)

## Source

`docs/backlog/v0-backlog.md` — **V0-27**, Wave 3, step 14, owner Storage.

## Checklist

- [x] Passed: watcher integration covers partial writes, burst coalescing, and later unreadable-file recovery without creating permanent degraded state or rewriting the file <!-- longclaw:item=ck_f2c83d95 -->

## Activity

<!-- longclaw:event
id: evt_b92db939
kind: create
occurred_at: 2026-08-05T14:23:04Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_4a121ea2
kind: update
occurred_at: 2026-08-05T14:23:05Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_f2c83d95.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Imported from `docs/backlog/v0-backlog.md`. The must-pass verification for V0-27 is recorded there as passed.
<!-- /longclaw:event -->
