---
format: longclaw.ticket/v1
id: 8ff64afc-30a0-4e09-a5a1-e8efc9e56d10
key: LC-33
title: Fault-injection and concurrency test suite
status: done
priority: p3
labels:
  - storage
  - v0-backlog
created_at: 2026-08-05T14:23:10Z
updated_at: 2026-08-05T14:23:11Z
---

~~Fault-injection and concurrency test suite~~ **Done 2026-08-02** — Step 14 recovery behavior is covered by focused frontend tests, Rust fault injection, storage race tests, watcher integration tests, and a repeatable stress command. [Plan 38](../../../docs/plans/completed/38-complete-step-14-recovery.md)

## Source

`docs/backlog/v0-backlog.md` — **V0-33**, Wave 3, step 14, owner Storage.

## Checklist

- [x] Passed: npm --prefix apps/desktop run test:stress repeats rapid external bursts and the app/external write race; frontend and Rust suites cover the rest of the recovery matrix <!-- longclaw:item=ck_3f6bca3a -->

## Activity

<!-- longclaw:event
id: evt_7d139d35
kind: create
occurred_at: 2026-08-05T14:23:10Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_816dd18a
kind: update
occurred_at: 2026-08-05T14:23:11Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_3f6bca3a.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Imported from `docs/backlog/v0-backlog.md`. The must-pass verification for V0-33 is recorded there as passed.
<!-- /longclaw:event -->
