# Editing LongClaw with an agent

LongClaw generated this file. It describes how to read and change this
project's canonical files without losing data.

## Canonical files

- `.longclaw/longclaw.yaml` — project identity, people, and label definitions.
- `.longclaw/tickets/<KEY>/ticket.md` — the complete structured record for one ticket.
- `.longclaw/tickets/<KEY>/attachments/` — that ticket's attachment bytes.

Read a ticket's `ticket.md` first. Open files under `attachments/` only when
the ticket references one and you need it. This file is documentation, not
project data.

## What you may change

| Field | Rule |
|---|---|
| `title` | one line |
| `status` | one of `backlog`, `todo`, `in_progress`, `in_review`, `done`, `canceled` |
| `priority` | one of `urgent`, `p1`, `p2`, `p3`, `p4`, `none` |
| `labels` | slugs defined in `longclaw.yaml` |
| description | any CommonMark outside the reserved sections |
| checklist | flip `[ ]` to `[x]`, or append a task |
| activity | append a bounded record; never edit or delete an existing one |

Do not change `format`, `id`, `key`, `created_at`, or `rank`. LongClaw owns
`rank`; preserve any value you find and do not invent one. Keep every key you
do not understand exactly as it is.

## Timestamps and attribution

Timestamps are UTC RFC 3339 strings such as `2026-07-29T09:12:31Z`. Set
`updated_at` when you change ticket state. Attribute yourself explicitly:

```yaml
actor:
  type: agent
  id: your-tool-id
  name: Your Tool
```

`type` is `human`, `agent`, or `unknown` — never guess. An agent is never an
assignee.

## Checking off a checklist item

Before:

```md
- [ ] Add retry policy <!-- longclaw:item=ck_7d2a -->
```

After:

```md
- [x] Add retry policy <!-- longclaw:item=ck_7d2a -->
```

Keep the `longclaw:item` marker. It is how a change is attributed to that
item. A task you append without a marker still works; LongClaw adopts it and
mints an id on its next write.

## Appending an activity entry

Add to the end of the `## Activity` section, inside the markers:

```md
<!-- longclaw:event
id: evt_4b91c07a
kind: update
occurred_at: 2026-07-29T09:12:31Z
actor:
  type: agent
  id: your-tool-id
  name: Your Tool
changes:
  - field: status
    from: todo
    to: in_progress
-->
### Your Tool updated this ticket

What you did and what is left.
<!-- /longclaw:event -->
```

Activity is append-only: correct a mistake by appending another entry. Use
`kind: comment` with no `changes` for a plain comment. Every `id` must be
unique within the ticket. If you change state without appending an entry, the
state still stands and the history is merely incomplete — LongClaw never rolls
state back to match history.

## Attachments

Copy the file into the ticket's `attachments/` directory as
`<attachment-id>-<sanitized-name>`, then register it under `## Attachments`
with its id, relative `file` path, original `name`, `media_type`, `size`,
`added_at`, and `added_by`. Copy the bytes first and register second, so an
interruption leaves a recoverable file rather than an entry pointing at
nothing. Treat registered files as immutable: replacement means a new id.

## Writing safely

- Write atomically: write a sibling temporary file, then rename it over
  `ticket.md`. LongClaw's watcher expects that pattern and will not mistake
  your write for its own.
- The YAML subset allows mappings, lists, strings, booleans, nulls, and
  numbers. No anchors, aliases, tags, merge keys, multiple documents, or
  duplicate keys. Files are UTF-8 with LF line endings.
- The frontmatter `key` and the ticket's directory name are one identity. Never
  change either.
- If a file will not parse, leave it alone and say so. LongClaw shows an
  unreadable ticket with its raw contents and a diagnostic rather than
  repairing it, and so should you.

## This project

- Name: LongClaw
- Ticket keys: `LC-1`, `LC-2`, and so on
- Ticket format: `longclaw.ticket/v1`

## A complete example

```md
---
format: longclaw.ticket/v1
id: f11f1e05-a49d-4530-aa32-308279f86c9b
key: LC-1
title: An example of the shape you are editing
status: todo
priority: p2
created_at: 2026-07-29T00:00:00Z
updated_at: 2026-07-29T00:00:00Z
---

The description is ordinary CommonMark.

## Checklist

- [ ] An example task <!-- longclaw:item=ck_65ee6293 -->

## Activity

<!-- longclaw:event
id: evt_bd567ae0
kind: create
occurred_at: 2026-07-29T00:00:00Z
actor:
  type: human
  id: local
-->
### You created this ticket
<!-- /longclaw:event -->
```
