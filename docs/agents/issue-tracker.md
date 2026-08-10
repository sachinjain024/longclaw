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

The creation surface is the `longclaw` CLI ([ADR 0011](../adr/0011-cli-is-the-creation-surface-agents-use.md)). Build it once with `cargo build --release --manifest-path apps/desktop/src-tauri/Cargo.toml --bin longclaw`; it prints JSON and exits non-zero on failure.

```sh
longclaw ticket create --title "…" --description "…" --label storage \
  --checklist "…" --agent-id claude-code --agent-name "Claude Code"
longclaw ticket edit LC-42 --status in_progress --agent-id claude-code
longclaw ticket edit LC-42 --move-item ck_7d2a --after ck_0f19   # reorder; no --after is the top
longclaw ticket show LC-42
longclaw ticket list
longclaw                     # the full surface
```

When a skill says to publish a spec or ticket:

1. Create the ticket with `longclaw ticket create`, one per requested ticket, and read the allocated key from its output.
2. **Pass `--agent-id`.** Without it the activity entry says a human did it, and the format contract's rule is that an actor is declared and never inferred.
3. Apply the appropriate triage label from `triage-labels.md`. A label must be defined in `longclaw.yaml` first — `longclaw label add --slug … --name …` — because the CLI refuses a slug the project does not define.
4. If the binary is not built and cannot be, present the prepared ticket content and ask the user to create the ticket before editing its assigned directory.

Specs live in the Markdown body of `ticket.md`. Additional headings such as `## Approach`, `## Discoveries`, and `## Blocked by` are ordinary description content.

## Editing rules

- Preserve immutable `id`, `key`, and ticket-directory paths.
- Preserve unknown supported frontmatter fields.
- Use the constrained YAML subset documented in `docs/file_format.md`.
- Change checklist state without removing its `longclaw:item` marker.
- Reorder checklist items through `--move-item`, which moves the line whole and names the item it now follows; a hand-edit that rewrote the lines in place would move the ids with them.
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
