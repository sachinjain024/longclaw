---
format: longclaw.ticket/v1
id: 06fc371e-8a69-4b05-9a78-a8e72b085de1
key: LC-3
title: Validate the project prefix during rebuild and ingest; degrade a mismatch rather than indexing it
status: done
priority: urgent
labels:
  - format
  - v0-backlog
created_at: 2026-08-05T14:22:46Z
updated_at: 2026-08-05T14:22:47Z
---

~~Validate the project prefix during rebuild and ingest; degrade a mismatch rather than indexing it~~ **Done 2026-07-31** — ownership is decided from the key's prefix in `read_ticket_file`, before the contents are parsed, so rebuild, ingest, detail, and the write refusal all inherit one rule. [Plan 04](../../../docs/plans/completed/04-project-prefix-validation.md)

## Source

`docs/backlog/v0-backlog.md` — **V0-03**, Wave 0, step 14, owner Format.

## Checklist

- [x] Passed: the invalid-key-foreign-project-prefix fixture, rename coverage in tests/watcher_integration.rs, and degrade/read/refuse/rebuild coverage in tests/storage_integration.rs, confirmed failing with the ownership rule removed <!-- longclaw:item=ck_a94617e1 -->

## Activity

<!-- longclaw:event
id: evt_24fdd565
kind: create
occurred_at: 2026-08-05T14:22:46Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_93ec6e74
kind: update
occurred_at: 2026-08-05T14:22:47Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_a94617e1.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Imported from `docs/backlog/v0-backlog.md`. The must-pass verification for V0-03 is recorded there as passed.
<!-- /longclaw:event -->
