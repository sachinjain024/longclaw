# A reference points at a file it does not own, and may leave the project

**Status:** accepted 2026-10-15, for [LC-206](../../.longclaw/tickets/LC-206/ticket.md) ([spec](../specs/LC-206-attachments.md)). Adds a reserved section and a record type to [the file format](../file_format.md#references).

Docs written for a ticket — a spec, a UX prototype, a design — were linked from the ticket's description by convention. The prototype review of LC-206 settled that they belong in the ticket's References section instead, beside its attachments, and that a person may add one by hand, including a file outside the project.

A **reference** is a bounded `longclaw:reference` record under a new reserved `## Ticket References` section, after `## Attachments` and before `## Activity`. It holds an id, a path, `added_at` and `added_by`, and nothing else.

- **It never owns the file.** Nothing is copied and nothing is read except to check that the path resolves. Removing a reference drops the record and never touches the file. A path that does not resolve reads as missing; the record stays.
- **The path says where the file is.** Relative to the project, with forward slashes, when the file is inside it; absolute when it is not. This is the first record the format allows to name a path outside the project. It is allowed because a reference is a pointer the person chose, not a canonical copy, and the absolute form is how the row knows to say _outside project_ — the one reference a teammate's clone cannot follow. A relative path may not contain `..`, so a reference cannot leave the project without saying so.
- **The name is derived, never stored.** The row shows the path's last segment. There is nothing to rename and no second spelling to drift from the first.

## Consequences

- `## Ticket References` becomes a reserved heading, and plain `## References` deliberately does not. A references heading is common in hand-written and agent-written descriptions, and reserving it would have ended any such description there and moved its links into a registry section with no records. `## Ticket References` is a heading nobody writes by accident; the app refuses to write a description containing it, as it does `## Checklist`. The panel still calls the section References — only the heading in the file is qualified.
- `TicketEdit` gains `add_reference`, `remove_reference` and `restore_reference`. An added path is normalized against the disk by the project before a document applies it.
- References narrate themselves in activity as `references.<id>.added` and `.removed`, carrying the file's name.
- The convention of linking a spec from a ticket's description gives way to recording it as a reference once `longclaw ticket reference` ships.
