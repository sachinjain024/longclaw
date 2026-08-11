---
format: longclaw.ticket/v1
id: 0a926a22-fa77-4d60-8bd1-387e035abf2f
key: LC-211
title: In the Ticket Panel, Create two Horizontal tabs - Activity & Comments
status: in_review
priority: urgent
labels:
  - frontend
  - design
  - release
created_at: 2026-08-11T14:52:42.384Z
updated_at: 2026-08-11T18:36:19.471Z
---

Presently, Comments are part of Activity. We can have Activity as separate tabs, Inside activity we can show X commented at this time but Lets create a separate tab for comments to make comments section clean.

Inside the comments section, user should be able to write markdown content.

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
