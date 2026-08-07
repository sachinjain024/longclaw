---
format: longclaw.ticket/v1
id: bddade28-b128-46b9-825d-ad43857baf74
key: LC-92
title: Filter states — the echoed query is unquoted, so an empty-looking query is invisible
status: done
priority: p3
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:01.002Z
updated_at: 2026-08-07T05:51:31.184Z
---

**Prototype.** "Nothing matches “zzzz”." (curly quotes)

**App.** "Nothing here matches zzzz." (no quotes)

## Source

`docs/cc_screens_diff.md` — **D-32**, § Filter states, severity P3.

## Checklist

- [x] Quote the echoed query so an empty-looking query is still visible. <!-- longclaw:item=ck_96f4e678 -->

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

<!-- longclaw:event
id: evt_dde1fe74
kind: update
occurred_at: 2026-08-07T05:49:24.261Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: in_progress
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_c002fd29
kind: update
occurred_at: 2026-08-07T05:51:31.184Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: in_progress
    to: done
  - field: checklist.ck_96f4e678.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

The echoed query sits inside the prototype's curly pair (`prototype.js:571`), so a query that is whitespace — or wearing it — is still visible as what was asked. The test types `"  zzzz  "` and reads the quotes back.
<!-- /longclaw:event -->
