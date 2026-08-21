---
format: longclaw.ticket/v1
id: 0a926a22-fa77-4d60-8bd1-387e035abf2f
key: LC-211
title: In the Ticket Panel, Create two Horizontal tabs - Activity & Comments
status: done
priority: urgent
labels:
  - frontend
  - design
  - release
created_at: 2026-08-11T14:52:42.384Z
updated_at: 2026-08-21T06:47:23.452Z
---

Presently, Comments are part of Activity. We can have Activity as separate tabs, Inside activity we can show X commented at this time but Lets create a separate tab for comments to make comments section clean.

Inside the comments section, user should be able to write markdown content.


## Checklist

## Activity

<!-- longclaw:event
id: evt_53863898
kind: create
occurred_at: 2026-08-11T14:52:42.384Z
actor:
  type: human
  id: local
-->
### You created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_f9db57a1
kind: update
occurred_at: 2026-08-11T18:36:19.471Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: in_review
-->
### Claude Code updated this ticket

Two tabs over one record. Activity is selected on open and holds every entry, drawing a comment as the line that says one happened; Comments holds the bodies alone. The composer sits under both rather than inside Comments, so commenting on what an agent just did still costs no click. For the Markdown half of the ticket: the timeline already rendered comments as Markdown, but nothing on the way in said so, so the composer now carries the same six formatting buttons the description editor has, over the same helper. Worth checking by hand: whether Activity is the tab you want selected on open.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_84a79cd3
kind: comment
occurred_at: 2026-08-11T23:18:43.468Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Reworked on your note: Comments is selected on open, Activity is still the first tab and one click away. The composer already sat under both, so this changed what is on screen rather than what is reachable. One knock-on worth knowing: the theme matrix probed the panel's message anatomy and change anatomy in one state, and those now live on different tabs — it is two states now, and its agent-accent probe moved to .timeline-entry.agent .change-actor, which is the selector the contract was always about.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_354dc594
kind: comment
occurred_at: 2026-08-12T06:48:03.083Z
actor:
  type: human
  id: local
-->
### You commented

## Item
- Adding a test comment
- To check the markdown formatting
- Actually we don’t need the toolbar
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_a03a8ac5
kind: update
occurred_at: 2026-08-21T06:26:03.832Z
actor:
  type: human
  id: local
changes:
  - field: checklist.ck_440fe3ff.added
    to: Test1
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_424e4b1a
kind: update
occurred_at: 2026-08-21T06:26:08.859Z
actor:
  type: human
  id: local
changes:
  - field: checklist.ck_440fe3ff.removed
    from: Test1
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_2ffc5811
kind: update
occurred_at: 2026-08-21T06:26:12.405Z
actor:
  type: human
  id: local
changes:
  - field: checklist.ck_686d393d.added
    to: T1
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_19f57ea0
kind: update
occurred_at: 2026-08-21T06:26:21.861Z
actor:
  type: human
  id: local
changes:
  - field: checklist.ck_686d393d.removed
    from: T1
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_d6ac9086
kind: update
occurred_at: 2026-08-21T06:47:23.452Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: in_review
    to: done
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->
