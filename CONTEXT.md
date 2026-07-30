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
The human accountable for a ticket in a team project. An agent is never an assignee, and local projects have no assignees — the concept exists only in team mode.
_Avoid_: Owner, agent assignee

**Attachment**:
A ticket-owned text, image, video, or other supporting file that forms part of the ticket's context.
_Avoid_: Asset, upload

**Activity event**:
An immutable, attributed historical record of a comment or ticket change.
_Avoid_: Log entry, audit row

**External change**:
A change to a ticket's file made by anyone other than the app — an agent, an editor, a script. The app observes it through the watcher and attributes it only from the records in the file.
_Avoid_: Remote change, sync

**Acknowledgement**:
The visible, decaying treatment the app gives a ticket that changed externally and has not been reviewed: the ring and pulse on its card, the actor and age line, and the agent-checked rows in its panel. It decays when a human opens the ticket, or two minutes after the change.
_Avoid_: Fresh, highlight, notification
