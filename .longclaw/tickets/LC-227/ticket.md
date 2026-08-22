---
format: longclaw.ticket/v1
id: 57c3c15c-497f-4647-a6ea-641e6cc3d9f3
key: LC-227
title: Add Other Fields to Tickets like Due Date, Start Date, Est Effort, Type
status: todo
priority: urgent
labels:
  - release
created_at: 2026-08-22T06:13:17.138Z
updated_at: 2026-08-22T06:43:35.344Z
---

Brainstorm with LLM agent like what other fields we should support. A few items I can think of are Type - Bug/Task, Due State, Start Date, Effort

- When Due Date is within a week, we highlight the ticket or add some indicator
- Should we show the Start Date and Due Date on the Card or only Due date on the card. We can take inspiration from Todoist on this.
- What are the other ticket types we should support - Is Task / Bug sufficient?

Create a Checklist once the execution plan is finalized. We should do a UX prototype first before building this feature.

In the UX Prototype we should consider increasing the width of the Ticket Panel and adding a right panel that contains all the properties like Status, Priority, etc and move the description, etc to the top.

## Activity

<!-- longclaw:event
id: evt_7da0bfb7
kind: create
occurred_at: 2026-08-22T06:13:17.138Z
actor:
  type: human
  id: local
-->
### You created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_87d81e49
kind: update
occurred_at: 2026-08-22T06:36:55.553Z
actor:
  type: human
  id: local
changes:
  - field: title
    from: Add Support for Ticket Type like Bug, Task or whatelse?
    to: Add Other Fields to Tickets like Due Date, Start Date, Est Effort, Type
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_c8a4ad8b
kind: update
occurred_at: 2026-08-22T06:43:35.344Z
actor:
  type: human
  id: local
changes:
  - field: description
-->
### You updated this ticket
<!-- /longclaw:event -->
