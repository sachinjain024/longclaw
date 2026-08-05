---
format: longclaw.ticket/v1
id: 0baec687-360d-4239-9502-a6282fbd9713
key: LC-135
title: "Unparseable ticket file — error shown as plain prose with no line reference: \"status must be one of backlog, todo, …; found not_a_real_status\""
status: todo
priority: p2
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:01.662Z
updated_at: 2026-08-05T15:16:01.662Z
---

**Prototype.** Danger banner shows the parser error in mono **with `file:line`** (`ticket.md:7 — mapping values are not allowed here…`)

**App.** Error shown as plain prose with no line reference: "status must be one of backlog, todo, …; found not_a_real_status"

## Source

`docs/cc_screens_diff.md` — **D-52**, § Unparseable ticket file, severity P2.

## Checklist

- [ ] Include the line number — it is the whole point of showing the raw file. <!-- longclaw:item=ck_feb86cba -->

## Activity

<!-- longclaw:event
id: evt_60c1bc80
kind: create
occurred_at: 2026-08-05T15:16:01.662Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
