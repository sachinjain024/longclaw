<!-- longclaw:generated file=AGENTS.md version=1 -->
# Working on LongClaw with an agent

LongClaw generated this file and rewrites it whenever this project changes.
Do not edit it — an edit here is overwritten without warning. Your own
instructions go in `PROJECT.md`, beside this file, which LongClaw creates
once and never writes to again.

## This project

- Name: LongClaw
- Key: `LC`
- Ticket format: `longclaw.ticket/v1`

The project is the folder that holds `.longclaw/`, so a ticket named in a
sentence resolves without searching: `LC-42` is the directory
`.longclaw/tickets/LC-42/`, and its record is
`.longclaw/tickets/LC-42/ticket.md`. A recently minted key may carry a
trailing lowercase letter — `LC-42n` — because two branches allocating
from one working tree would otherwise mint the same number. Both forms are
keys and both are read the same way.

## Canonical files

- `.longclaw/longclaw.yaml` — project identity, people, label definitions,
  and which ticket properties this project has turned on.
- `.longclaw/tickets/<KEY>/ticket.md` — the complete structured record for
  one ticket.
- `.longclaw/tickets/<KEY>/attachments/` — that ticket's attachment bytes.

Read a ticket's `ticket.md` first: it is the whole record rather than a
summary of one. Open a file under `attachments/` only when the ticket
references it and you need it. This file, `CLAUDE.md` and `PROJECT.md` are
documentation; they are not project data.

## Use the CLI

`longclaw` is how this project is driven, and it ships with the LongClaw
app. Start with:

```sh
longclaw help
```

That prints every command, the `status` and `priority` sets, the date format
and the attribution rule. It is compiled into the binary, so it cannot go
stale the way a generated file can — read it rather than working from
memory, and rather than trusting a command spelled out here.

Three things are worth knowing before the first one:

- A command prints JSON on stdout. A failure prints a typed error on stderr
  and exits non-zero, and the error says what to fix.
- `--path` defaults to the working directory, so run commands from this
  project's folder or pass `--path` explicitly.
- An edit carries the hash of the bytes it read, so a command built from a
  stale read is refused rather than written over whoever changed the file
  first.

Create a ticket:

```sh
longclaw ticket create \
  --title "Search returns archived tickets" \
  --description "Steps, expected, actual." \
  --status todo --priority p2 \
  --agent-id your-tool-id --agent-name "Your Tool"
```

Edit one — a status, a checklist tick and a note are one command, and one
activity entry:

```sh
longclaw ticket edit LC-1 \
  --status in_progress \
  --check ck_1b8e4f02 \
  --comment "Reproduced. The archived filter runs after the query." \
  --agent-id your-tool-id --agent-name "Your Tool"
```

## This project's vocabulary

### Labels

A ticket may carry only a slug this project defines; a `--label` naming one
it does not is refused rather than written.

| Slug | Name |
|---|---|
| `design` | Design |
| `domain` | Domain |
| `format` | Format |
| `frontend` | Frontend |
| `index` | Index |
| `parked` | Parked |
| `persistence` | Persistence |
| `platform` | Platform |
| `post-mvp` | Post-MVP |
| `product` | Product |
| `prototype-diff` | Prototype Diff |
| `release` | Release Blocker |
| `storage` | Storage |
| `v0-backlog` | v0 backlog |

`longclaw project show` prints what the project defines now. To add one:

```sh
longclaw label add --slug security --name Security --color blue
```

### Ticket properties

`type`, `due`, `start` and `estimate` are opt-in. This project has turned on:

| Property | Accepts | Flags |
|---|---|---|
| `type` | one of bug, chore, docs, feature, spike | `--type <slug>`, `--clear-type` |
| `due` | a date, `YYYY-MM-DD` | `--due <date>`, `--clear-due` |

Do not write a property that is not listed. An unlisted one is a property
this project does not read, and a value you find under it is being hidden
rather than deleted — keep it exactly as it is.

## Rules `longclaw help` does not state

- **Never create `.longclaw/tickets/<KEY>/` by hand.** A key is allocated by
  claiming its directory, which is the one thing that stops two agents
  minting the same key at the same moment. `longclaw ticket create` is the
  only thing that may spend one.
- **Always pass `--agent-id`,** and `--agent-name` when you have one. The
  format declares who acted and never infers it, so an entry without it says
  a human did the work.
- **Activity is append-only.** Correct a mistake by appending another entry,
  never by editing or deleting one that is already there.
- **`id` and `key` are one identity and do not change.** The single exception
  is `ticket renumber`, and it exists for two branches that minted the same
  key rather than for renaming.
- **Never silently overwrite an external edit.** When a write is refused as
  stale, re-read the ticket and decide what to do with what changed. Do not
  retry the same command until it lands.
- **Keep what you do not understand.** A key this build does not read is
  preserved rather than dropped, and so is a value under a property this
  project has turned off — turning it off hides the value; it does not delete
  it.
- **If a file will not parse, leave it alone and say so.** LongClaw shows an
  unreadable ticket with its raw contents and a diagnostic rather than
  repairing it, and so should you.

## If the CLI is not available

An agent, an editor or a script on a machine without LongClaw installed can
still read and write these files: the file format is the durable contract and
the CLI is the recommended path through it, not a gate in front of it. What
you cannot do this way is create a ticket — a key is spent by claiming its
directory, and nothing outside LongClaw may spend one.

### What you may change

| Field | Rule |
|---|---|
| `title` | one line |
| `status` | one of `backlog`, `todo`, `in_progress`, `in_review`, `done`, `canceled` |
| `priority` | one of `urgent`, `p1`, `p2`, `p3`, `p4`, `none` |
| `labels` | slugs defined in `longclaw.yaml` |
| `type` | one of bug, chore, docs, feature, spike |
| `due` | a date, `YYYY-MM-DD` |
| description | any CommonMark outside the reserved sections |
| checklist | flip `[ ]` to `[x]`, or append a task |
| activity | append a bounded record; never edit or delete an existing one |

Do not change `format`, `id`, `key`, `created_at` or `rank`. LongClaw owns
`rank`; preserve any value you find and do not invent one. Keep every key you
do not understand exactly as it is. `.longclaw/longclaw.yaml` is the source of
truth for the label slugs, the people and the enabled properties a ticket may
use — read it rather than guessing, and do not add a value it does not define.

### Timestamps and attribution

Timestamps are UTC RFC 3339 strings such as `2026-07-29T09:12:31Z`. Set
`updated_at` when you change ticket state. Attribute yourself explicitly:

```yaml
actor:
  type: agent
  id: your-tool-id
  name: Your Tool
```

`type` is one of `human`, `agent` or `unknown` — never guess. An agent is
never an assignee.

### Checking off a checklist item

Before:

```md
- [ ] Add retry policy <!-- longclaw:item=ck_7d2a -->
```

After:

```md
- [x] Add retry policy <!-- longclaw:item=ck_7d2a -->
```

Keep the `longclaw:item` marker: it is how a change is attributed to that
item. A task you append without one still works — LongClaw adopts it and mints
an id on its next write.

### Appending an activity entry

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

Use `kind: comment` with no `changes` for a plain comment. Every `id` must be
unique within the ticket. If you change state without appending an entry, the
state still stands and the history is merely incomplete — LongClaw never rolls
state back to match history.

### Attachments

Copy the file into the ticket's `attachments/` directory as
`<attachment-id>-<sanitized-name>`, then register it under `## Attachments`
with its id, relative `file` path, original `name`, `media_type`, `size`,
`added_at` and `added_by`. Copy the bytes first and register second, so an
interruption leaves a recoverable file rather than an entry pointing at
nothing. Treat registered files as immutable: replacement means a new id.

### Writing safely

- Write atomically: write a sibling temporary file, then rename it over
  `ticket.md`. LongClaw's watcher expects that pattern and will not mistake
  your write for its own.
- The YAML subset allows mappings, lists, strings, booleans, nulls and
  numbers. No anchors, aliases, tags, merge keys, multiple documents or
  duplicate keys. Files are UTF-8 with LF line endings.
- The frontmatter `key` and the ticket's directory name are one identity.
  Never change either.

## Your own instructions

`PROJECT.md`, beside this file, is yours: this project's conventions, the words
it wants used, anything an agent should know that LongClaw cannot generate.
LongClaw creates it once and never writes to it again, so what you put there
survives every rename, label change and property change that rewrites this
file.

## A complete example

```md
---
format: longclaw.ticket/v1
id: 3f9c1a7d-4e02-4b8c-9a71-5d6e0c2f8b34
key: LC-1
title: An example of the shape you are editing
status: todo
priority: p2
created_at: 2026-07-29T00:00:00Z
updated_at: 2026-07-29T00:00:00Z
---

The description is ordinary CommonMark.

## Checklist

- [ ] An example task <!-- longclaw:item=ck_1b8e4f02 -->

## Activity

<!-- longclaw:event
id: evt_2c7a90d5
kind: create
occurred_at: 2026-07-29T00:00:00Z
actor:
  type: human
  id: local
-->
### You created this ticket
<!-- /longclaw:event -->
```
