---
format: longclaw.ticket/v1
id: 019c8ca0-0000-7000-8000-000000000003
key: LC-8
title: Agents may add plain Markdown tasks
status: todo
priority: p3
created_at: 2026-07-29T00:00:00Z
updated_at: 2026-07-29T00:00:00Z
---

The checklist is ordinary Markdown, so an agent can append an item without
knowing how to mint a stable item id. LongClaw adopts the item on its next
write; until then the item is readable and checkable by position.

## Checklist

- [x] Item with a stable id <!-- longclaw:item=ck_0001 -->
- [ ] Item an agent appended
