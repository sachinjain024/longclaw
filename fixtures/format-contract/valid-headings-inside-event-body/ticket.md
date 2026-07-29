---
format: longclaw.ticket/v1
id: 019c8ca0-0000-7000-8000-000000000004
key: LC-9
title: Event bodies may contain any Markdown heading
status: todo
priority: none
created_at: 2026-07-29T00:00:00Z
updated_at: 2026-07-29T00:00:00Z
---

Section boundaries come from the record markers, not from visible headings, so
an agent can quote a heading inside a comment without breaking the file.

## Activity

<!-- longclaw:event
id: evt_a1b2c3d4
kind: comment
occurred_at: 2026-07-29T01:00:00Z
actor:
  type: agent
  id: quoting-agent
-->
### Quoting Agent commented

## Checklist

The heading above belongs to this comment body. It is not a reserved section.
<!-- /longclaw:event -->
