---
format: longclaw.ticket/v1
id: 2bfe07c0-35dc-4fc2-bf46-27ed794d32c3
key: LC-115
title: Quick create — status trigger is a bare ○ Todo > with a chevron — A bordered pill ○ Todo, no chevron
status: done
priority: p3
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:01.344Z
updated_at: 2026-08-07T13:47:24.793Z
---

**Prototype.** Status trigger is a bare `○ Todo >` with a chevron

**App.** A bordered pill `○ Todo`, no chevron

## Source

`docs/cc_screens_diff.md` — **D-49**, § Quick create, severity P3.

## Checklist

- [x] Match the panel's meta-trigger treatment (see D-3B). <!-- longclaw:item=ck_ddd91824 -->

## Activity

<!-- longclaw:event
id: evt_29169f08
kind: create
occurred_at: 2026-08-05T15:16:01.344Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_486c7a4e
kind: update
occurred_at: 2026-08-07T13:47:24.793Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: done
  - field: checklist.ck_ddd91824.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_8b56ccb0
kind: comment
occurred_at: 2026-08-07T14:11:42.359Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Follow-up: D-49's prototype cell and checklist wording conflicted. The implemented choice is the prototype's bare quick-create trigger while retaining MenuButton's shared menu semantics and D-3B chevron; docs/cc_screens_diff.md now says that explicitly and quick-create-guard.mjs pins the scoped CSS.
<!-- /longclaw:event -->
