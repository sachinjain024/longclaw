---
format: longclaw.ticket/v1
id: 34ed268c-d7f0-4a72-bcbf-3f402e0c8109
key: LC-7
title: Attribute a change from newly appended event IDs only
status: done
priority: urgent
labels:
  - domain
  - v0-backlog
created_at: 2026-08-05T14:22:50Z
updated_at: 2026-08-05T14:22:51Z
---

~~Attribute a change from newly appended event IDs only~~ **Done 2026-07-31** — attribution rides on the `ticketChanged` event rather than the row, and comes only from records the file did not have before. [Plan 03](../../../docs/plans/completed/03-attribution-from-new-records.md)

## Source

`docs/backlog/v0-backlog.md` — **V0-07**, Wave 0, step 14, owner Domain.

## Checklist

- [x] Passed: unit tests beside core::attribution plus record-less, appended, and rewritten-history watcher tests, confirmed failing against the newest-record rule. The round-trip scenario's § 4 walkthrough is still unwalked <!-- longclaw:item=ck_ee89e6c4 -->

## Activity

<!-- longclaw:event
id: evt_44088374
kind: create
occurred_at: 2026-08-05T14:22:50Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_ef9ef843
kind: update
occurred_at: 2026-08-05T14:22:51Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_ee89e6c4.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Imported from `docs/backlog/v0-backlog.md`. The must-pass verification for V0-07 is recorded there as passed.
<!-- /longclaw:event -->
