# Local projects have no assignee

**Status:** accepted 2026-07-29, and propagated through the prototype and specs in the same change.

Assignment expresses accountability between team members, and a local project has exactly one human. In local project mode there is no assignee concept: every ticket is Unassigned, cannot be assigned, and the Assignee field is hidden from every surface (ticket panel, list rows, board cards, quick/full create, the `A` shortcut, and the "Assign…" palette command). Assignee is a team-plan concept and appears only in team project mode.

## Consequences

- The `assignee` frontmatter field stays in the ticket schema as optional and is simply absent in local projects, so enabling team mode later is not a format migration. "Assignee is always a human, never an agent" still holds wherever the field exists.
- The `people` registry in `longclaw.yaml` is not required for assignment in v0.
- Local projects expose no identity or profile UI. App-authored human activity uses the reserved on-disk actor `{ type: human, id: local }`, omits a personal name, and renders as “You.” This reserved actor is attribution metadata, not an assignee or registered person.
- The Step 2 prototype and its specs show assignee UI in local mode; they must be revised to match this decision.
