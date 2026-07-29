---
format: longclaw.ticket/v1
id: 019c8c7e-5f42-7b09-a07c-7411ef79e129
key: LC-1
title: Load canonical ticket files
status: in_progress
priority: p2
labels:
  - storage
created_at: 2026-07-29T00:00:00Z
updated_at: 2026-07-29T09:12:31Z
---

This fixture exercises the local file parsing path without requiring an account,
network service, analytics, or telemetry.

## Acceptance criteria

- Frontmatter parses from the constrained YAML subset.
- The ticket renders in the desktop shell.

## Checklist

- [x] Parse metadata from constrained YAML <!-- longclaw:item=ck_7d2a -->
- [ ] Render the ticket in the desktop shell <!-- longclaw:item=ck_8e31 -->

## Activity

<!-- longclaw:event
id: evt_5c1f8a2b
kind: create
occurred_at: 2026-07-29T00:00:00Z
actor:
  type: human
  id: local
-->
### You created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_f83f615b
kind: update
occurred_at: 2026-07-29T09:12:31Z
actor:
  type: human
  id: local
changes:
  - field: status
    from: todo
    to: in_progress
  - field: checklist.ck_7d2a.checked
    from: false
    to: true
-->
### You updated this ticket

Started on the parser while the shell was still a placeholder.
<!-- /longclaw:event -->
