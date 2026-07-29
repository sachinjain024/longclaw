---
format: longclaw.ticket/v1
id: 019c8ca0-0000-7000-8000-000000000006
key: LC-11
title: One invalid event degrades only that timeline entry
status: todo
priority: none
created_at: 2026-07-29T00:00:00Z
updated_at: 2026-07-29T00:00:00Z
---

An unreadable activity record must not hide the ticket or the records around it.

## Activity

<!-- longclaw:event
kind: comment
occurred_at: 2026-07-29T01:00:00Z
actor:
  type: agent
  id: forgetful-agent
-->
### An event without an id

Activity entries need a stable id to be attributable and append-only.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_00c0ffee
kind: comment
occurred_at: 2026-07-29T02:00:00Z
actor:
  type: human
  id: local
-->
### You commented

This entry is intact and must still be visible.
<!-- /longclaw:event -->
