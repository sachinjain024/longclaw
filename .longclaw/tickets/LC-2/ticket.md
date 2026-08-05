---
format: longclaw.ticket/v1
id: 86390af7-b58a-414d-98b4-37fa55281b6f
key: LC-2
title: Detect a project-event sequence gap and recover by snapshot
status: done
priority: urgent
labels:
  - frontend
  - v0-backlog
created_at: 2026-08-05T14:22:45Z
updated_at: 2026-08-05T14:22:46Z
---

~~Detect a project-event sequence gap and recover by snapshot~~ **Done 2026-07-31** — a gap raises `reconciling`, `App` fetches exactly one snapshot, and the store resumes from the new `ProjectSnapshot.sequence` boundary. [Plan 02](../../../docs/plans/completed/02-event-sequence-gap.md)

## Source

`docs/backlog/v0-backlog.md` — **V0-02**, Wave 0, step 14, owner Frontend.

## Checklist

- [x] Passed: loss, reordering, convergence, project-switch, and failed-request tests in state.test.ts and App.test.tsx, confirmed failing against the previous applyEvent <!-- longclaw:item=ck_84ece441 -->

## Activity

<!-- longclaw:event
id: evt_33ff347e
kind: create
occurred_at: 2026-08-05T14:22:45Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_e84b11f8
kind: update
occurred_at: 2026-08-05T14:22:46Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_84ece441.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Imported from `docs/backlog/v0-backlog.md`. The must-pass verification for V0-02 is recorded there as passed.
<!-- /longclaw:event -->
