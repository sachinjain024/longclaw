---
format: longclaw.ticket/v1
id: 516bb1fa-6d89-4eaf-9cb0-8db9d9e4862d
key: LC-30
title: Corrupt or deleted index recovery; idempotent rebuild
status: done
priority: p3
labels:
  - index
  - v0-backlog
created_at: 2026-08-05T14:23:07Z
updated_at: 2026-08-05T14:23:08Z
---

~~Corrupt or deleted index recovery; idempotent rebuild~~ **Done 2026-08-02** — the production index is in-memory and disposable; rebuild derives visible state from files and can be repeated safely. [Plan 38](../../../docs/plans/completed/38-complete-step-14-recovery.md)

## Source

`docs/backlog/v0-backlog.md` — **V0-30**, Wave 3, step 14, owner Index.

## Checklist

- [x] Passed: storage and watcher recovery tests rebuild from disk and converge to the same visible project state <!-- longclaw:item=ck_35304ec6 -->

## Activity

<!-- longclaw:event
id: evt_3b198cfb
kind: create
occurred_at: 2026-08-05T14:23:07Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_6bb28ea5
kind: update
occurred_at: 2026-08-05T14:23:08Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_35304ec6.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Imported from `docs/backlog/v0-backlog.md`. The must-pass verification for V0-30 is recorded there as passed.
<!-- /longclaw:event -->
