---
format: longclaw.ticket/v1
id: 019c8d20-1a2b-7c3d-9e4f-5a6b7c8d9e03
key: LC-99
title: A description nobody canonicalized
status: todo
priority: p2
created_at: 2026-07-30T09:00:00Z
updated_at: 2026-07-30T09:06:00Z
---

A setext heading
================

*   a star bullet with loose spacing
-  a dash bullet
    - a four-space indent
+ and a plus

A line with two trailing spaces  
is a hard break, and the spaces are load bearing.

> a block quote

1. an ordered item
2. and another

| column | column |
| --- | --- |
| a | b |

```js
const spacing = '  load   bearing  ';
```

	A tab-indented line.

<!-- an ordinary HTML comment, which is not a longclaw record -->

## Checklist

- [ ] Leave the description exactly as it was written <!-- longclaw:item=ck_9901 -->

## Activity

<!-- longclaw:event
id: evt_9901
kind: create
occurred_at: 2026-07-30T09:06:00Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket

Wrote the description in its own hand, none of it in the style the app emits.
<!-- /longclaw:event -->
