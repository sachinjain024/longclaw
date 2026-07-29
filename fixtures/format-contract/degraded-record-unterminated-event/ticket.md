---
format: longclaw.ticket/v1
id: 019c8ca0-0000-7000-8000-000000000007
key: LC-12
title: A half-written event degrades only itself
status: todo
priority: none
created_at: 2026-07-29T00:00:00Z
updated_at: 2026-07-29T00:00:00Z
---

An agent interrupted between opening and closing an activity record leaves this
shape behind. The ticket's current state is still authoritative.

## Activity

<!-- longclaw:event
id: evt_beefbeef
kind: comment
occurred_at: 2026-07-29T03:00:00Z
actor:
  type: agent
  id: interrupted-agent
-->
### Interrupted Agent commented

The closing marker never arrived.
