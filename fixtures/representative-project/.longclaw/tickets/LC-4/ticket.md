---
format: longclaw.ticket/v1
id: 019c8c7e-8c33-70a1-b455-19d2e6f1c8d7
key: LC-4
title: Archive an old ticket without moving its directory
status: done
priority: p4
labels:
  - reliability
rank: a0V
created_at: 2026-07-20T10:00:00Z
updated_at: 2026-07-28T16:05:00Z
archived_at: 2026-07-28T16:05:00Z
---

Archived tickets stay in place so relative links from commits and comments keep
resolving. This fixture also carries an attachment registry entry so the
registry survives app writes it does not understand yet.

## Attachments

<!-- longclaw:attachment
id: att_7d2a
file: attachments/att_7d2a-debug-log.txt
name: debug-log.txt
media_type: text/plain
size: 85
added_at: 2026-07-28T15:58:00Z
added_by:
  type: agent
  id: fixture-agent
  name: Fixture Agent
-->
[debug-log.txt](./attachments/att_7d2a-debug-log.txt)
<!-- /longclaw:attachment -->

## Activity

<!-- longclaw:event
id: evt_3f7a91c2
kind: external_change
occurred_at: 2026-07-28T15:58:00Z
actor:
  type: unknown
changes:
  - field: status
    from: in_review
    to: done
-->
### The file changed on disk

LongClaw observed a stable before-and-after change it did not author.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_4a1b02de
kind: update
occurred_at: 2026-07-28T16:05:00Z
actor:
  type: human
  id: local
changes:
  - field: archived_at
    to: 2026-07-28T16:05:00Z
-->
### You archived this ticket
<!-- /longclaw:event -->
