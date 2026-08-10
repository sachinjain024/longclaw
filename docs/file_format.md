---
title: "LongClaw — On-Disk File Format & Data Model"
product: LongClaw
status: approved
approved_at: "2026-07-29"
scope: "Phase 0 file format and data model; Phase 1 v0 storage contract"
sources:
  - vision.md
  - design_brief.md
  - mvp_plan_order.md
---

# LongClaw — On-Disk File Format & Data Model

Approved at the M1 human-review gate on 2026-07-29.

## Recommendation

For v0, use one directory per ticket containing:

- one canonical `ticket.md` with all structured ticket data, description, checklist, attachment registry, comments, and activity;
- one `attachments/` directory containing the ticket's text, image, and video attachments.

The directory boundary is established from day one so parts of `ticket.md` can be extracted into sidecar files later without changing the ticket's stable path.

```text
repo/
└── .longclaw/
    ├── longclaw.yaml
    ├── AGENTS.md
    └── tickets/
        └── LC-42/
            ├── ticket.md
            └── attachments/
                ├── att_7d2a-debug-log.txt
                ├── att_8e31-failure-state.png
                └── att_a821-reproduction.mp4
```

This preserves the v0 convenience of one read and one ticket-record write while keeping attachment bytes next to the ticket that owns them.

An agent working on a ticket should:

1. Read `.longclaw/AGENTS.md`.
2. Read the ticket's `ticket.md`.
3. Inspect files under `attachments/` when referenced by the ticket.

The ticket directory is the unit of context. In v0, `ticket.md` is the sole canonical structured record for the ticket. Attachment files are canonical ticket-owned content, while their identity, metadata, attribution, and ordering are registered in `ticket.md`.

## Ticket record

Each ticket directory contains a `ticket.md` file:

```md
---
format: longclaw.ticket/v1
id: 019c8c7e-5f42-7b09-a07c-7411ef79e129
key: LC-42
title: Add retry support to the sync worker
status: in_progress
priority: p1
assignee: sachin
labels:
  - reliability
  - backend
rank: "a0V"
created_at: 2026-07-27T08:20:00Z
updated_at: 2026-07-27T09:12:31Z
---

The worker currently fails permanently after a transient network error.

## Acceptance criteria

- Retries use exponential backoff.
- Permanent failures remain visible.

## Checklist

- [x] Add retry policy <!-- longclaw:item=ck_7d2a -->
- [ ] Add failure metrics <!-- longclaw:item=ck_8e31 -->
- [ ] Cover timeout behavior <!-- longclaw:item=ck_a821 -->

## Attachments

<!-- longclaw:attachment
id: att_7d2a
file: attachments/att_7d2a-debug-log.txt
name: debug-log.txt
media_type: text/plain
size: 18432
added_at: 2026-07-27T09:10:00Z
added_by:
  type: human
  id: sachin
-->
[debug-log.txt](./attachments/att_7d2a-debug-log.txt)
<!-- /longclaw:attachment -->

## Activity

<!-- longclaw:event
id: evt_f83f615b
kind: update
occurred_at: 2026-07-27T09:12:31Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: in_progress
  - field: checklist.ck_7d2a.checked
    from: false
    to: true
-->
### Claude Code updated this ticket

Implemented the retry policy. Metrics still need to be added.
<!-- /longclaw:event -->
```

Important choices:

- The directory name contains only the immutable human key, not the title. Renaming a title must not rename paths.
- `id` is the globally unique identity; `key` is the human-facing identifier such as `LC-42`.
- `status` is one of `backlog`, `todo`, `in_progress`, `in_review`, `done`, or `canceled`.
- `priority` is one of `urgent`, `p1`, `p2`, `p3`, `p4`, or `none`. Priority order is the default board order.
- Checklist items use ordinary Markdown tasks plus invisible stable IDs. Agents can safely change `[ ]` to `[x]`, while the app can still identify and attribute changes to a particular item. The order of the lines is the order of the list, so reordering moves a line whole — its ID travels with it, and a change is recorded as `checklist.<id>.moved`.
- `rank` is optional and lives on the ticket, preventing a shared board-order file from becoming a conflict hotspot. It affects order only when the board's device-local sort option is **Manual**. Drag-and-drop is disabled for priority sorting and writes ranks only in Manual mode. In v0, LongClaw owns rank allocation; agents preserve existing ranks and do not invent them.
- Derived values such as checklist progress, comment count, and last activity are not stored in the ticket.
- Every canonical structured record declares its own versioned `format`; project format version alone is not sufficient for safe partial migrations.
- Attachment and activity entries receive stable IDs in v0 so they can be moved into individual files later without reconstructing identity or attribution.

### Markdown and YAML subset

Ticket frontmatter uses a deliberately constrained YAML subset:

- mappings, lists, strings, booleans, nulls, and numbers only;
- no anchors, aliases, custom tags, merge keys, or multiple documents;
- timestamps are UTC RFC 3339 strings rather than YAML-native timestamp values;
- duplicate keys are invalid;
- key order has no semantic meaning;
- unknown supported keys are preserved during round trips.

The Markdown body remains ordinary CommonMark apart from three reserved sections:

- `## Checklist`, containing Markdown tasks with invisible `longclaw:item` markers;
- `## Attachments`, containing bounded `longclaw:attachment` records;
- `## Activity`, containing bounded `longclaw:event` records.

Other headings, such as `## Approach` or `## Discoveries`, are normal description content.

## Embedded activity

In v0, comments and change events are embedded in `ticket.md`. Every activity entry has structured YAML metadata inside bounded HTML comment markers and a human-readable Markdown presentation:

```md
<!-- longclaw:event
id: evt_f83f615b
occurred_at: 2026-07-27T09:12:31Z
kind: update
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: in_progress
  - field: checklist.ck_7d2a.checked
    from: false
    to: true
-->
### Claude Code updated this ticket

Implemented the retry policy. Metrics still need to be added.
<!-- /longclaw:event -->
```

The activity model follows these rules:

- `ticket.md` is authoritative for current state.
- The embedded activity section is authoritative for historical narration in v0.
- Activity entries are semantically append-only. A correction appends another event instead of editing an existing event.
- The parser uses the `longclaw:event` boundaries rather than visible headings, so event bodies may contain arbitrary Markdown headings.
- Activity never drives or rolls back ticket state.
- If state changes without a matching activity entry, preserve the state and mark the history as incomplete. Never roll the state back to match the history.
- If the app directly observes a stable before-and-after external change, it may create a durable `external_change` activity event with `actor.type: unknown`.
- If the app did not observe the transition, it must not invent an actor, timestamp, or field-level historical details.
- Actor type is explicit. The app never guesses whether an actor is a human or agent from its name.
- Local projects expose no identity or profile UI in v0. App-authored human activity uses the reserved actor `{ type: human, id: local }`, omits a personal name, and renders as “You” in the app. The reserved `local` actor is not an assignee or a member of the project `people` registry.
- Activity is sorted by `occurred_at`, with `id` used as a deterministic tie-breaker.

Keeping activity embedded gives v0 agents one file to read and mutate. The accepted tradeoff is that comments, state changes, checklist updates, and activity appends all contend on `ticket.md`. Content-hash conflict detection and the external-edit UI are required from v0.

## Project-level files

### `longclaw.yaml`

Keep stable project metadata, the human registry, and label definitions in one compact file:

```yaml
format: longclaw.project/v1
id: 019c8c31-4d7e-71ad-8997-e67700962b55
name: LongClaw
key: LC
theme: indigo
created_at: 2026-07-27T08:00:00Z
people:
  sachin:
    name: Sachin Jain
labels:
  backend:
    name: Backend
    color: blue
  reliability:
    name: Reliability
    color: amber
```

The project key is one or more characters, uppercase ASCII letters and digits only, starting with a letter — `LC`, `LC2`, `L`. It is the prefix of every ticket key and of every ticket directory name, so the same grammar governs both: a ticket key is `<KEY>-<n>` where `n` carries no leading zero. Length is not part of the grammar; a project keeps whatever key length it was created with, and the creation surfaces cap a new key at five characters for readability. The shared case table both implementations test against is [`fixtures/project-key-grammar.json`](../fixtures/project-key-grammar.json).

The project key becomes immutable after the first ticket is created. Otherwise, changing it would require renaming every human-facing ticket key and directory.

Because the prefix is the project key, it also says which project a ticket directory belongs to. A directory under `.longclaw/tickets/` whose prefix is not this project's key is not this project's ticket, however well-formed its contents are; see the reader rule in [Write and conflict rules](#write-and-conflict-rules).

Ticket assignees refer to stable IDs in `people`. Only registered people are valid assignees. Local projects have no assignee or identity UI in v0, so they do not require a local human entry in `people`. Agents appear as explicitly typed actors in embedded activity events but never in the assignable people registry.

Tickets store label slugs. This lets a label's display name or color change without rewriting every ticket carrying that label.

Keeping these small, infrequently changed registries together reduces file-format surface area in v0. They can be split in a future schema version if real collaboration data shows that the project file has become a conflict hotspot.

### `AGENTS.md`

This is the generated agent-facing editing contract. It should explain:

- which files are canonical;
- which fields agents may change;
- actor and timestamp rules;
- how to check off a checklist item;
- how to append a bounded activity entry;
- how to register and safely read an attachment;
- how unknown fields must be preserved;
- atomic-write expectations;
- invalid or partial-file behavior;
- before-and-after examples of safe mutations.

It must specifically instruct an agent to treat `ticket.md` as the complete structured record and read files under `attachments/` only when referenced and relevant.

This instruction file is documentation, not source-of-truth project data. LongClaw owns `.longclaw/AGENTS.md`, but must not create or overwrite an unrelated `AGENTS.md` at the repository root. A project may additionally link to this contract from its existing root agent instructions.

## Attachments

Attachments are supported in v0 for text, image, and video files. They live with the ticket that owns them:

```text
.longclaw/tickets/LC-42/
├── ticket.md
└── attachments/
    ├── att_7d2a-debug-log.txt
    ├── att_8e31-failure-state.png
    └── att_a821-reproduction.mp4
```

Each attachment has two parts:

1. The file bytes under `attachments/`.
2. A bounded `longclaw:attachment` registry entry under `## Attachments` in `ticket.md`.

The registry entry contains the stable attachment ID, relative file path, original display name, detected media type, size, creation timestamp, and actor attribution. Descriptions and comments may refer to the same attachment using relative Markdown links:

```md
![Failure state](./attachments/att_8e31-failure-state.png)
```

Attachment rules:

- The v0 app supports attachments whose detected media type is `image/*`, `text/*`, or `video/*`.
- Each attachment is limited to 10 MB (10,000,000 bytes).
- Copy files into the ticket's `attachments/` directory; never store absolute external paths as canonical attachments.
- Name files `<attachment-id>-<sanitized-original-name>`.
- Keep the original display name in the ticket registry.
- Use forward-slash relative paths contained within the ticket directory. Reject absolute paths, `..` traversal, and symlinks that escape the ticket directory.
- Determine media type from file content and use the extension only as a secondary signal.
- Treat registered attachment files as immutable in v0. Replacing content creates a new attachment ID and file.
- Copy the file atomically before appending its registry entry to `ticket.md`.
- A file present without a registry entry is a recoverable orphan. Surface it for recovery; never silently delete it.
- A registry entry whose file is missing is a missing attachment. Preserve the metadata and show a repair affordance.
- Index supported text content with an explicit size limit. Index only metadata for images and videos.
- Store generated image thumbnails, video poster frames, transcoding output, and other previews in disposable application cache rather than the project.
- Serve videos with byte-range support so seeking does not require loading the complete file.
- Warn when large files may be unsuitable for ordinary git storage or may benefit from Git LFS. LongClaw does not modify git configuration automatically.

An unsupported media type already present on disk remains preserved as an opaque attachment rather than being executed or rendered as trusted content. The v0 app does not create a new registry entry for it.

## Agent access and CLI projection

The v0 agent interface is the versioned project-file contract itself. Agents read and safely edit `.longclaw/longclaw.yaml` and canonical `ticket.md` files according to `.longclaw/AGENTS.md`.

A CLI/JSON projection would add commands that expose the same records as machine-readable JSON and perform mutations on an agent's behalf. It is deferred until a real second caller needs it. No CLI, JSON projection, or sidecar JSON file is required for v0, and its absence does not block the direct file round-trip.

## Data that should not live in the project

The following data is disposable, device-specific, or user-specific and should live in the operating system's application-support directory rather than `.longclaw/`:

- SQLite or other search indexes;
- watcher checkpoints;
- cached content hashes;
- transient locks and temporary writes;
- window and panel state;
- starred and recently opened projects;
- command-palette history;
- terminal sessions and terminal-to-ticket bindings;
- optimistic UI state.

None of this data should enter git or cloud sync. Deleting it must never lose canonical project information; the app should be able to rebuild it from the project files.

## Write and conflict rules

- The app writes files atomically using a sibling temporary file followed by a rename.
- Parsers tolerate short-lived partial files produced by external editors and debounce filesystem events before reporting a stable parse error.
- The app records a content hash when an edit begins and compares it with the current on-disk content before saving.
- A stale in-app edit is never silently written over a newer external edit.
- Unknown supported fields are preserved during read-modify-write operations.
- Files using a newer unsupported format version are shown read-only rather than migrated or rewritten automatically.
- An unparseable ticket remains visible as a degraded ticket with access to its raw contents and parse error.
- A ticket key's prefix is the project that owns it. A reader settles ownership from the directory name before it believes the contents, so a directory whose key names another project — copied in, or left behind by a project that was renamed — degrades with a diagnostic naming both keys instead of being indexed as this project's ticket. It is never renamed, moved, or rewritten into conformity, and it is never a candidate for an app write.
- The parser validates embedded attachment and activity records independently. An invalid record degrades only that attachment or timeline entry when the rest of `ticket.md` remains safely parseable.
- Ticket creation scans canonical active, archived, and recoverably deleted tickets while holding an exclusive project-scoped creation lock. It never trusts the disposable index alone when allocating a key.

Current state and embedded activity share one atomic `ticket.md` write in v0. Their recovery rule remains asymmetric:

- a valid `ticket.md` mutation without an event updates current state but leaves history incomplete;
- a change event without the corresponding state mutation is historical narration only and never applies the change;
- a comment event does not require any current-state mutation.

Adding an attachment spans the attachment file and `ticket.md`, so it is not a filesystem transaction. The app copies the attachment first and registers it second. An interrupted operation therefore leaves a recoverable orphan instead of a registry entry pointing at bytes that were never copied.

## Lifecycle semantics

Cancellation, archival, and deletion should be distinct:

- `status: canceled` records a workflow outcome and keeps the ticket active in history and search.
- `archived_at` hides an old ticket from ordinary views without moving or deleting its directory.
- Hard deletion is not part of the normal ticket workflow. If added, it should use a recoverable trash operation and must never reuse the deleted ticket key.
- Activity entries are never hard-deleted as part of ordinary ticket editing.
- Removing an attachment from the registry must not immediately destroy its bytes. Move it to a recoverable ticket-local trash location or retain it as an orphan until an explicit purge operation is designed.

Keeping archived tickets in place avoids path churn and preserves relative links from source files, comments, or commits.

## Alternatives considered

| Model | Benefit | Problem |
|---|---|---|
| Flat `LC-42.md` files | Fewest paths | Adding attachments or splitting data later changes the ticket's filesystem shape |
| Ticket directory with one `ticket.md` plus attachments | One structured read/write, stable path, and colocated files | All structured mutations contend on `ticket.md` |
| Ticket directory with per-event activity files | Better write and merge isolation | More files and multi-file agent mutations in v0 |
| Pure append-only event sourcing | Excellent concurrent-write behavior | Difficult to inspect manually and adds reducer and migration complexity |
| YAML or JSON only | Easy strict parsing | Loses the Obsidian-like Markdown editing experience |

The chosen v0 model is the ticket directory with one `ticket.md` and one `attachments/` directory. It prioritizes the first agent round-trip: one structured ticket read, one structured ticket write, and direct access to supporting files.

The team accepts that activity growth and app-versus-agent contention may eventually justify extracting data from `ticket.md`. Establishing the directory now makes that change local to the ticket directory rather than a project-wide path redesign.

## Future component extraction

Do not create empty component directories in v0. Extract a component only after actual usage shows that file size, parsing, write contention, or merge behavior warrants it.

Activity is the most likely first extraction:

```text
.longclaw/tickets/LC-42/
├── ticket.md
├── activity/
│   ├── evt_f83f615b.md
│   └── evt_a912ce77.md
└── attachments/
```

The v0 embedded activity format is designed for lossless extraction:

- every event already has an immutable ID;
- actor, time, kind, and changes are already structured;
- the bounded Markdown body can become the event file body;
- the external path to `ticket.md` does not change.

A future ticket format version may declare external activity storage. During migration, the app must support old embedded tickets and new extracted tickets concurrently so each ticket can migrate atomically and independently.

Description and checklist remain in `ticket.md` unless evidence supports another split. The directory shape leaves that option open without committing to it prematurely.

## Ticket ID allocation

Use two identifiers:

- a globally unique immutable `id` for durable identity and future synchronization;
- a short project-scoped `key`, such as `LC-42`, for humans and filesystem navigation.

For v0, sequential human keys are reasonable if only the app creates tickets. This matches the product rule that humans plan and agents execute, and avoids prematurely designing distributed offline allocation.

The app determines the next sequence number from canonical active, archived, and recoverably deleted tickets while holding a project-scoped creation lock. The index may accelerate the scan but cannot decide the result. Numbers are never reused.

Before agents can create tickets or team sync is introduced, the allocation policy must be revisited. Options include server-issued ranges, randomized human keys, or conflict-time reassignment. The internal immutable ID means that future key reconciliation does not change the ticket's underlying identity.

## Recommended v1 invariants

1. A ticket's internal `id`, human `key`, and directory path do not change after creation.
2. In v0, `ticket.md` is the sole canonical structured record for current state, description, checklist, attachment registry, comments, and activity.
3. Each activity entry has a globally unique ID and is semantically append-only.
4. Every actor explicitly declares whether it is a human or an agent.
5. Only registered humans can be assignees.
6. Checklist items have stable IDs even though they render as ordinary Markdown tasks.
7. Every attachment belongs to exactly one ticket, lives under that ticket's `attachments/` directory, and has a stable registry entry in `ticket.md`.
8. Attachment files are immutable in v0; replacement creates a new attachment.
9. Derived data and device-specific state never become project source of truth.
10. The app never rewrites content it cannot parse safely.
11. Unknown supported fields survive a read-modify-write round trip.
12. The local index can always be deleted and rebuilt without losing information.
13. Missing activity never invalidates or rolls back valid current state.
14. An invalid embedded record degrades locally when the rest of the ticket remains safely parseable.
15. Future component extraction preserves the ticket directory and `ticket.md` path.
