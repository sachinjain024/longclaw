# LongClaw

LongClaw is a shared planning and execution system in which humans own work and agents contribute to its record.

## Language

**Ticket**:
A unit of planned work owned by a human that accumulates scope, execution context, and an attributed history.
_Avoid_: Issue, task

**Actor**:
A human or agent that contributes a comment or change to a ticket.
_Avoid_: User, contributor

**Assignee**:
The human accountable for a ticket. An agent is never an assignee.
_Avoid_: Owner, agent assignee

**Attachment**:
A ticket-owned text, image, video, or other supporting file that forms part of the ticket's context.
_Avoid_: Asset, upload

**Activity event**:
An immutable, attributed historical record of a comment or ticket change.
_Avoid_: Log entry, audit row
