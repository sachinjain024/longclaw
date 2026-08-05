---
format: longclaw.ticket/v1
id: 1b576886-6e8d-4ceb-b48e-ad025b9194e1
key: LC-40
title: Annotate the save that overrode an external edit
status: todo
priority: p3
labels:
  - frontend
  - v0-backlog
created_at: 2026-08-05T14:23:16Z
updated_at: 2026-08-05T14:23:16Z
---

Annotate the save that overrode an external edit

## Why it exists

`states.md:129` says a Keep mine save writes the draft as the new content, the overridden external version "remains recoverable in the activity history", **and** the change event is annotated *"overrode an external edit"*. Filed 2026-08-04 out of [plan 39](../../../docs/plans/completed/39-v0-29-write-failure-states.md), which deliberately did not build it. **Read the split before ranking this.** The recoverability half is already true and always was: `FieldChange` carries `from` and `to`, so the value the external editor wrote is in the record the save appends. What is missing is only the annotation — the timeline cannot tell a save that overrode somebody from an ordinary one. That makes it a copy and records item, not a data-loss one, which is why Step 14 closed without it. It got more visible rather than newly broken when plan 39 made Keep mine reachable from the board.

## Source

`docs/backlog/v0-backlog.md` — **V0-43**, Wave 3, step 16, owner Frontend.

## Checklist

- [ ] The timeline distinguishes a save that overrode an external edit from one that did not, and the overridden value is still readable in the record <!-- longclaw:item=ck_19519014 -->

## Activity

<!-- longclaw:event
id: evt_28249a17
kind: create
occurred_at: 2026-08-05T14:23:16Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
