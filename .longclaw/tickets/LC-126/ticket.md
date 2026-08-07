---
format: longclaw.ticket/v1
id: fa7505d6-c957-4d32-8381-846fceb4707f
key: LC-126
title: Project settings — key field, disabled once a ticket exists, with locked after first ticket — No Key field at all
status: done
priority: p1
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:01.516Z
updated_at: 2026-08-07T03:46:55.669Z
---

**Prototype.** Key field, disabled once a ticket exists, with `locked after first ticket`

**App.** **No Key field at all**

## Source

`docs/cc_screens_diff.md` — **D-41**, § Project settings, severity P1.

## Checklist

- [x] Add it, disabled with the note. It is the one setting a user cannot change later — hiding it is worse than showing it locked. <!-- longclaw:item=ck_04b552c7 -->

## Activity

<!-- longclaw:event
id: evt_263871aa
kind: create
occurred_at: 2026-08-05T15:16:01.516Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_08f507a3
kind: update
occurred_at: 2026-08-07T03:46:55.669Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: done
  - field: checklist.ck_04b552c7.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->
