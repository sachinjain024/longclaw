---
format: longclaw.ticket/v1
id: 019c9f45-153b-79ee-9c11-2feab3d4b2aa
key: LC-1
title: "LC-1 Watch a real external edit cross the boundary"
status: in_progress
priority: urgent
labels:
  - architecture
created_at: 2026-07-29T08:05:00Z
updated_at: "2026-07-29T07:59:34.411Z"
---

Edit this title or checklist in an ordinary editor while the spike is open.

## Acceptance criteria

- The visible row changes without a manual refresh.
- The row receives the external-change trace.

## Checklist

- [x] Register the project root <!-- longclaw:item=ck_root -->
- [ ] Deliver the external change <!-- longclaw:item=ck_watch -->

## Activity

<!-- longclaw:event
id: evt_fixture_agent
kind: update
occurred_at: 2026-07-29T08:32:00Z
actor:
  type: agent
  id: codex
  name: Codex
changes:
  - field: checklist.ck_root.checked
    from: false
    to: true
-->
### Codex updated this ticket

Prepared the watcher acceptance path.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_ec559b501aa842d385ff64f44ee0c8e1
kind: update
occurred_at: 2026-07-29T07:59:34.412Z
actor:
  type: human
  id: longclaw-spike
  name: LongClaw spike UI
changes:
  - field: title
    to: "LC-1 Watch a real external edit cross the boundary"
-->
### LongClaw spike UI updated this ticket

Changed the title through the atomic-write architecture proof.
<!-- /longclaw:event -->
