---
format: longclaw.ticket/v1
id: bddade28-b128-46b9-825d-ad43857baf74
key: LC-92
title: Filter states — the echoed query is unquoted, so an empty-looking query is invisible
status: todo
priority: p3
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:01.002Z
updated_at: 2026-08-05T15:16:01.002Z
---

**Prototype.** "Nothing matches “zzzz”." (curly quotes)

**App.** "Nothing here matches zzzz." (no quotes)

## Source

`docs/cc_screens_diff.md` — **D-32**, § Filter states, severity P3.

## Checklist

- [ ] Quote the echoed query so an empty-looking query is still visible. <!-- longclaw:item=ck_96f4e678 -->

## Activity

<!-- longclaw:event
id: evt_96c52ed8
kind: create
occurred_at: 2026-08-05T15:16:01.002Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
