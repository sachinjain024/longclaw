# LongClaw

LongClaw is a shared planning and execution system in which humans own work and agents contribute to its record.

## Language

**Ticket**:
A unit of planned work owned by a human that accumulates scope, execution context, and an attributed history.
_Avoid_: Issue, task

**Project**:
A folder a human chose, made a LongClaw project by the `.longclaw/` directory inside it. `.longclaw/longclaw.yaml` holds its identity — name, ticket key prefix, theme, people, and label definitions — and `.longclaw/tickets/<KEY>/` holds one directory per ticket. The folder is the unit a human opens, moves, backs up, and puts under version control.
_Avoid_: Workspace, repository, board

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

**Status**:
Where a ticket sits in its lifecycle: `backlog`, `todo`, `in_progress`, `in_review`, `done`, or `canceled`. The set is fixed in v0 and the same in every project ([ADR 0002](docs/adr/0002-fixed-statuses-in-v0.md)); per-project statuses come later.
_Avoid_: State, stage, column

**Priority**:
How urgent a ticket is: `urgent`, `p1`, `p2`, `p3`, `p4`, or `none`. Listed most urgent first, and that order is also the default order tickets appear in ([ADR 0003](docs/adr/0003-priority-default-ordering-manual-option.md)), which a board may override with Manual.
_Avoid_: Severity, importance, rank

**Label**:
A tag defined by the project, not by the ticket. `longclaw.yaml` defines each label's slug, display name, and colour; a ticket carries slugs, and the CLI refuses a slug the project has not defined — so a label cannot be brought into existence by using it.
_Avoid_: Tag, category, component

**Checklist item**:
A task inside a ticket, carrying a stable id in a `longclaw:item` marker so a change can be attributed to that item rather than to the line it happens to occupy. An item may be appended without an id; LongClaw adopts it and mints one on its next write.
_Avoid_: Subtask, todo, step

**Archive**:
Taking a ticket off the board without deleting it or losing its history ([ADR 0004](docs/adr/0004-archive-in-v0.md)). An archived ticket is out of every status group and appears in the list's own archived group. Archiving is reversible; deletion is not offered.
_Avoid_: Close, delete, hide

**Field**:
A text-bearing editable the caret can sit in — a `<textarea>`, a contenteditable, or a textual `<input>`. A checkbox and a `<select>` are controls but not fields, and the distinction is load-bearing: single-key shortcuts stand down inside any control, while the keys a field *owns*, such as ⌘Z, stand down only for something with text and an undo stack of its own.
_Avoid_: Input, control, box
