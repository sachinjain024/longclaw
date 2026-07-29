---
format: longclaw.ticket/v1
id: 019c8c7e-5f42-7b09-a07c-7411ef79e129
key: LC-42
title: "Add retry support to the sync worker"
status: in_progress
priority: p1
assignee: sachin
labels:
  - reliability
  - backend
rank: "a0V"
created_at: 2026-07-27T08:20:00Z
updated_at: 2026-07-27T09:12:31Z
archived_at: 2026-07-27T09:30:00Z
---

The worker currently fails permanently after a transient network error.

## Acceptance criteria

- Retries use exponential backoff.
- Permanent failures remain visible.

## Checklist

- [x] Add retry policy <!-- longclaw:item=ck_7d2a -->
- [ ] Add failure metrics <!-- longclaw:item=ck_8e31 -->
- [ ] Cover timeout behavior <!-- longclaw:item=ck_a821 -->

## Attachments

<!-- longclaw:attachment
id: att_7d2a
file: attachments/att_7d2a-debug-log.txt
name: debug-log.txt
media_type: text/plain
size: 26
added_at: 2026-07-27T09:10:00Z
added_by:
  type: human
  id: sachin
-->
[debug-log.txt](./attachments/att_7d2a-debug-log.txt)
<!-- /longclaw:attachment -->

## Activity

<!-- longclaw:event
id: evt_f83f615b
kind: update
occurred_at: 2026-07-27T09:12:31Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: in_progress
  - field: checklist.ck_7d2a.checked
    from: false
    to: true
-->
### Claude Code updated this ticket

Implemented the retry policy. Metrics still need to be added.
<!-- /longclaw:event -->
