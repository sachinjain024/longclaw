# Local projects have no assignee

Assignment expresses accountability between team members, and a local project has exactly one human. In local project mode there is no assignee concept: every ticket is Unassigned, cannot be assigned, and the Assignee field is hidden from every surface (ticket panel, list rows, board cards, quick/full create, the `A` shortcut, and the "Assign…" palette command). Assignee is a team-plan concept and appears only in team project mode.

## Consequences

- The `assignee` frontmatter field stays in the ticket schema as optional and is simply absent in local projects, so enabling team mode later is not a format migration. "Assignee is always a human, never an agent" still holds wherever the field exists.
- The `people` registry in `longclaw.yaml` is not required for assignment in v0. The open question of local human identity (Step 2 handoff, `data-requirements.md` item 1) narrows to actor attribution on comments and activity events — a display identity, not an assignment target.
- The Step 2 prototype and its specs show assignee UI in local mode; they must be revised to match this decision.
