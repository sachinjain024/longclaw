# Issue tracker: LongClaw local Markdown

Tickets and specs for this repository use the LongClaw files under `.longclaw/`, following `docs/file_format.md`.

## Layout

- Project metadata: `.longclaw/longclaw.yaml`
- Agent editing contract: `.longclaw/AGENTS.md`
- Canonical ticket record: `.longclaw/tickets/<KEY>/ticket.md`
- Attachments: `.longclaw/tickets/<KEY>/attachments/`

The ticket directory is the unit of context. In v0, `ticket.md` is authoritative for current state, description, checklist, attachment registry, comments, and activity. Attachment bytes live under the owning ticket's `attachments/` directory.

## Reading a ticket

1. Read `.longclaw/AGENTS.md`.
2. Read the ticket's `ticket.md`.
3. Inspect attachments only when referenced and relevant.

## Creating and publishing tickets

LongClaw owns ticket creation and human-facing key allocation. Agents must not guess a key or create `.longclaw/tickets/<KEY>/` directly.

When a skill says to publish a spec or ticket:

1. Use the LongClaw app or CLI creation surface when available.
2. Create one LongClaw ticket per requested ticket.
3. If no creation surface is available, present the prepared ticket content and ask the user to create the ticket before editing its assigned directory.
4. Apply the appropriate triage label from `triage-labels.md`.

Specs live in the Markdown body of `ticket.md`. Additional headings such as `## Approach`, `## Discoveries`, and `## Blocked by` are ordinary description content.

## Editing rules

- Preserve immutable `id`, `key`, and ticket-directory paths.
- Preserve unknown supported frontmatter fields.
- Use the constrained YAML subset documented in `docs/file_format.md`.
- Change checklist state without removing its `longclaw:item` marker.
- Keep `ticket.md` authoritative for all structured ticket data.
- Append historical narration as a new bounded `longclaw:event` record under `## Activity`.
- Explicitly identify activity actors as human or agent.
- Preserve attachment IDs and bounded `longclaw:attachment` records.
- Treat registered attachment files as immutable; replacement creates a new attachment.
- Only registered humans may be assignees.
- Never rewrite content that cannot be parsed safely.
- Never silently overwrite a newer external edit.

## Triage operations

Triage labels are slugs in the ticket's `labels` frontmatter list. Their canonical-role mapping is defined in `docs/agents/triage-labels.md`.

When triage changes ticket state or labels:

1. Update `ticket.md`.
2. Append an activity entry describing the change.
3. Preserve all unrelated fields and Markdown content.

## Wayfinding operations

- A map is a regular LongClaw ticket carrying the `wayfinder:map` label.
- Each child decision is a separate LongClaw ticket carrying the `wayfinder:ticket` label.
- Record the map ticket key and blocking ticket keys in ordinary Markdown sections.
- Determine the frontier by scanning child tickets for unresolved tickets whose blockers are complete.
- Claim work by moving the child ticket to `in_progress` and appending an activity entry.
- Resolve work by adding an `## Answer` section, moving the ticket to `done`, and appending an activity entry.
- Add the result and child-ticket link to the map ticket's decisions-so-far section.
