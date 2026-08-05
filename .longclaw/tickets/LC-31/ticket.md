---
format: longclaw.ticket/v1
id: 9fe7ce5f-d0da-409f-bc70-54dccfcbf59e
key: LC-31
title: A recoverable copy of the project registry before any registry schema change
status: done
priority: p3
labels:
  - persistence
  - v0-backlog
created_at: 2026-08-05T14:23:08Z
updated_at: 2026-08-05T14:23:09Z
---

~~A recoverable copy of the project registry before any registry schema change~~ **Done 2026-08-02** — `RegistryStore` now writes `project-registry.backup.json` from the current live registry before each later save, still fails closed on invalid registry JSON, and reports both `path` and `backupPath`. Recovery is documented in `apps/desktop/README.md`. [Plan 38](../../../docs/plans/completed/38-complete-step-14-recovery.md)

## Source

`docs/backlog/v0-backlog.md` — **V0-31**, Wave 3, step 14, owner Persistence.

## Checklist

- [x] Passed: registry tests prove corrupt registry bytes are left untouched, backup restoration recovers projects, corrupt backups heal from the live registry, and after a third save the backup holds the two-project state before the latest change <!-- longclaw:item=ck_789e15ce -->

## Activity

<!-- longclaw:event
id: evt_2007736b
kind: create
occurred_at: 2026-08-05T14:23:08Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_1550755f
kind: update
occurred_at: 2026-08-05T14:23:09Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_789e15ce.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Imported from `docs/backlog/v0-backlog.md`. The must-pass verification for V0-31 is recorded there as passed.
<!-- /longclaw:event -->
