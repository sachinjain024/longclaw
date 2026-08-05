---
format: longclaw.ticket/v1
id: cbead507-64d3-4b92-9c83-74edddf05427
key: LC-1
title: Close the atomic-replace race
status: done
priority: urgent
labels:
  - storage
  - v0-backlog
created_at: 2026-08-05T14:22:44Z
updated_at: 2026-08-05T14:22:45Z
---

~~Close the atomic-replace race~~ **Done 2026-07-31** — `atomic_replace` swaps with `renamex_np(RENAME_SWAP)`, hashes the displaced bytes, restores them and returns a typed conflict on mismatch, and refuses the write where the volume cannot swap. [Plan 01](../../../docs/plans/completed/01-atomic-replace-race.md)

## Source

`docs/backlog/v0-backlog.md` — **V0-01**, Wave 0, step 14, owner Storage.

## Checklist

- [x] Passed: driven-interleaving race test in tests/storage_integration.rs, confirmed failing against the previous fs::rename path <!-- longclaw:item=ck_b89f2184 -->

## Activity

<!-- longclaw:event
id: evt_14fe1b5c
kind: create
occurred_at: 2026-08-05T14:22:44Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_026bd1a9
kind: update
occurred_at: 2026-08-05T14:22:45Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_b89f2184.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Imported from `docs/backlog/v0-backlog.md`. The must-pass verification for V0-01 is recorded there as passed.
<!-- /longclaw:event -->
