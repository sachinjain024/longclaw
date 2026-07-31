---
title: "Complete the merged timeline"
product: LongClaw
status: completed
backlog_id: V0-13
order: 19
owner_area: Frontend
release_blocking: true
depends_on: "18 (MarkdownView), 13 (mutate), 14 (Menu/glyphs), 15 (LabelChip)"
---

# Complete the merged timeline

`src/Timeline.tsx` is 53 lines and **never reads `event.kind`**. Every kind —
create, update, comment, external_change, and whatever a newer writer invents —
collapses into one template: actor tile, a `<ul>` of raw field paths, and a bare
`<p>` of prose. A status change renders as `status todo → in_progress`. A
description edit renders as `description changed`. A checklist tick renders as
`checklist.ck_7d2a.checked false → true`.

That is the product thesis rendered as a debug dump. The merged record is the one
thing LongClaw is for.

## Why this exists

[V0-13](../../backlog/v0-backlog.md) in Wave 1, Step 11. The slice proved the
stream exists; this is where every event kind and the agent treatment are
complete.

The must-pass: *every event kind renders with correct actor type and `via file
edit` provenance; an agent is never rendered as an assignee (ADR 0001)*.

## The approved design, and where it needs a reading

- `screen-specs.md:190-194` — one chronological stream, sorted by time with ID
  tie-break. Composer is avatar + auto-growing field, `⌘↵` posts, posting is
  optimistic.
- `components.md:195-208` — the per-voice anatomy. **Human entry:** 26px circle
  avatar, plain, no rail, no tint. **Agent entry:** 26px tile, 2px
  `accent-agent-rail`, mono name in `accent-agent-text`, `AGENT` badge, meta
  `12s · via file edit`. **Change events:** "single 12px glyph + one line 12px
  `ink-2`, actor name in its accent text color", and "Agent description edits log
  as events (\"edited the description\"); expandable diff later".
- `states.md:169-173` — attribution comes only from explicit actor records; an
  observed change with none logs as `file changed on disk — actor unknown` with a
  warn glyph.
- `file_format.md:194` — sort by `occurred_at`, `id` as tie-breaker.

**The tension:** `states.md:169` says every external mutation gets "tile avatar,
rail, AGENT badge, `via file edit` meta", while `components.md:207` says a change
event is a *single glyph and one line* — no avatar. Both are the approved design
and they describe the same agent status change differently.

The reading this plan takes: `components.md` is the per-entry anatomy and wins on
layout, `states.md` is the provenance rule and wins on content. So a change entry
is compact — glyph plus one line, no 26px tile — and it still carries the 2px
rail and `via file edit` when its actor is an agent. A comment entry gets the
full anatomy including the badge. Written down here because the must-pass depends
on which one you read.

## Every event kind

`ActivityKind` is `"create" | "update" | "comment" | "external_change" | string`.
The open tail is deliberate: Rust parses an unfamiliar kind as
`EventKind::Other(String)` and preserves it (`core/ticket.rs:172-207`).

| Kind | Treatment |
|---|---|
| `comment` | Message entry: avatar or tile, name, badge, meta, body through `MarkdownView` |
| `create` | Change entry: `✦ You created this ticket` |
| `update` | Change entry: one glyph + one sentence per `FieldChange`, plus the body if the write carried a note |
| `external_change` | Change entry, and the only place `actor.type: unknown` belongs: `⚠ file changed on disk — actor unknown` |
| anything else | **Message entry, with the kind named in the meta.** See below |

The unknown-kind fallback is the discipline the app already applies to an
undefined label slug and an unsupported attachment media type: render it as
itself, say what you do not know, drop nothing. A message entry is the safe
shape — it shows the actor and the whole body — and the meta gains
`recorded as "<kind>"` so the app is not silently claiming it is a comment.

## Field paths become sentences

`FieldChange.field` is what `TicketDocument::apply` writes plus whatever an
external writer chose. From `apply()`: `title`, `status`, `priority`, `labels`,
`rank`, `archived_at`, `description` (recorded `from: None, to: None`, because
the diff is not tracked), `checklist.<id>.checked`, `checklist.<id>.added`.

Each becomes one sentence with the app's own glyph vocabulary — `StatusDot`,
`PriorityGlyph`, `LabelDot` — rather than a re-description in words. A checklist
id resolves against the ticket's own checklist so the line names the item. An
unrecognised field keeps its raw path in a `wash` code chip, because for a key
this build does not know the path is the only honest thing to show.

## Do this

1. `src/timelineEvents.ts` — the whole decision as pure functions:
   `sortActivity`, `entryShape`, `changeLines`. Unit-testable without a DOM,
   which is where the enumeration of every field and every kind is pinned.
2. `src/Timeline.tsx` — render those, reusing `StatusDot`, `PriorityGlyph`,
   `LabelDot`, `actorGlyph`, `actorName`, `describeAge`, and `MarkdownView` for
   every prose body.
3. `markdown.ts` + `MarkdownView.tsx` — add **ordered lists and block quotes**.
   V0-12 left them out only because `file_format.md` shows neither, and named the
   literal `1.` as the subset's weakest point. A timeline comment is exactly
   where an agent writes numbered steps. Keep both of V0-12's properties: no
   `html` node, and no reformatting of untouched content.
4. `TicketPanel.tsx` — composer avatar, auto-growing field, and optimistic
   posting through the existing `save(edit, options)` seam. Not a new write path.

## Done when

- Every kind in the table above has a test, including the unknown kind.
- Every field `apply()` can write has a test that its line is a sentence.
- `external_change` with no actor renders the warn copy from `states.md:172`.
- Sorting is by `occurredAt` with `id` as the tie-break, tested on equal times.
- An ADR 0001 test pins that an agent appears only as an actor and never in the
  meta grid, so a future change cannot quietly reintroduce an assignee.
- Ordered lists and block quotes render, with V0-12's two properties intact.
- `npm --prefix apps/desktop run check` is green.

## Watch out for

- **Do not invent attribution.** A change with no actor record is `unknown`, and
  `unknown` is not an agent. `attribution.ts` already holds that rule; do not add
  a second one here.
- **Do not build a diff view.** `components.md:207` defers the expandable diff
  explicitly. A description edit is one line.
- **Do not remove the human avatars.** They are actor identity, which ADR 0001
  permits and the spec requires. The clause is about assignees.

## Outcome

Done 2026-08-01. `src/Timeline.tsx` reads `event.kind` now, and the decision it
reads sits in a new pure module, `src/timelineEvents.ts`: `sortActivity`,
`entryShape`, `unfamiliarKind`, `changeLines`, `describeChange`. Nothing about a
kind or a field is decided in JSX.

**How each kind renders.**

- **`comment`** — a message entry. Human: 26px circle, `You`, no rail, no
  provenance. Agent: tile, mono name in `accent-agent-text`, `AGENT` badge,
  `12s · via file edit`. Body through `MarkdownView` with `headingOffset={3}`,
  as [18's outcome](18-markdown-editor.md) asked for.
- **`create`** — a change entry, `✦ You created this ticket`.
- **`update`** — a change entry, one glyph and one sentence per `FieldChange`,
  with the actor named once on the first line. A note written alongside the
  change renders below as markdown.
- **`external_change`** — a change entry, and the only place `actor.type:
  unknown` appears. It leads with `⚠ file changed on disk — actor unknown` and
  the entry takes an `unattributed` class. That copy now lives once, as
  `UNATTRIBUTED_CHANGE` in `attribution.ts`, because `freshness.ts` was already
  saying the same sentence in its own string.
- **Anything else** — a message entry, which is the shape that shows the most,
  with `· recorded as “deployed”` appended to the meta. The app renders the
  record whole and says it does not know the kind, rather than filing it silently
  under one it does. That is the same discipline as an undefined label slug.

**What a field says.** Every value `apply()` writes is a sentence: `renamed this
to “…”`, `moved this to In Review`, `set priority to Urgent`, `added backend
label`, `reordered this by hand`, `cleared the manual order`, `archived this`,
`unarchived this`, `edited the description`, `checked “Add metrics”`, `added
“Write the migration” to the checklist`. A checklist id resolves against the
ticket's own checklist; a label slug resolves through `resolveLabels`. Status,
priority and label changes carry `StatusDot`, `PriorityGlyph` and `LabelDot`
rather than re-describing them in words. A field this build does not interpret
keeps its raw path in a `wash` code chip — for a key with no name, the path is
the only true thing to show.

**The tension the plan named, resolved as written.** `components.md:207` won on
layout and `states.md:169` won on provenance: a change entry is compact and keeps
the rail and the `via file edit` meta. If that reads wrong on screen, the fix is
one branch in `TimelineEntry`, not a rewrite.

**Two things beyond the plan.**

- **The markdown subset gained ordered lists and block quotes**, which is
  [V0-12's](18-markdown-editor.md) named weakest point closed. `ListBlock` has
  `ordered` and `start`, so a list starting at 7 renders `<ol start="7">`; a new
  `BlockquoteBlock` holds parsed blocks, so a quoted list is a list. Two
  CommonMark rules were implemented deliberately: only a `1.` may interrupt a
  paragraph, so "shipped in\n1985. A good year." stays prose; and a `>`-less line
  ends a quote rather than being absorbed as a lazy continuation, because
  under-quoting one line is a smaller lie than quoting a line nobody marked.
  V0-12's two properties are intact — still no `html` node, and the editor still
  never writes the tree back, so the no-reformatting test is untouched. It broke
  one V0-12 assertion, `shows the whole document in the preview, rendered or
  not`, which asserted `> a block quote` was literal text; it now asserts the
  `<blockquote>` and the `<ol>`.
- **A cross-language pin.** `ipc-contract.json` gained `appliedFieldChanges`.
  `core::ticket::tests::json_contract_applied_field_changes` applies an
  every-field edit and asserts the serialized changes equal it; the frontend
  reads the same array and asserts each entry has a sentence. A field added to
  `apply` now fails on both sides rather than reaching a human as a raw wire
  value. The appended item's minted id is normalized before comparison, so the
  fixture pins the shape of the dotted path and not the id.

**Also shipped:** the composer has its avatar and an auto-growing field, and
posting is optimistic — the entry appears immediately marked `posting`, and a
failed write removes it and puts the text back in the composer. It goes through
`save(edit, options)`'s existing `apply` seam; there is no new write path.
Clearing the field happens inside `apply`, so a save the conflict banner refuses
leaves the draft exactly as typed.

### On the `confirm` risk

V0-13's Pilot column is `confirm`, meaning the design ships unexamined. The risk
is not in the agent treatment — the rail, the badge and the provenance are
specified precisely and there is little room to get them wrong. It is in the
**change-event sentences**, which no spec dictates and no user has read. Eleven
of them were written here from scratch. `moved this to In Review` may read oddly
for a status the team thinks of as a state rather than a place; `reordered this
by hand` says nothing about where the ticket went. A ticket with a long history
will be mostly these lines, so if the timeline feels wrong in use, read them
before touching the anatomy. They are one table in `timelineEvents.ts` and
changing one is a one-line edit and a one-line test change.

The second, smaller risk: a change entry has no avatar, so a stream of agent
updates is a column of rails with a mono name repeated down the left. That is
what `components.md:207` asks for, and it is the one place a screenshot would
have settled the question faster than an argument.

### Confirmed red first

- Ten of the fourteen claims in `Timeline.test.tsx`, run against the old
  53-line component before it was replaced. The four that passed are the ones the
  single template happened to satisfy: the human comment's plainness, the agent
  comment's rail and badge, the agent external change's provenance, and the
  negative check that a known kind is not labelled unfamiliar.
- Seven of the forty-nine in `markdown.test.ts`, against the parser before
  ordered lists and block quotes existed.
- `must-pass: an agent is an actor and never an assignee` and `posts a comment
  optimistically, and puts it back if the write fails`, each confirmed failing
  with its half of the panel change reverted.
- `json_contract_applied_field_changes`, confirmed failing with one extra field
  in the fixture.

### Validation

`npm --prefix apps/desktop run check`: green — tokens, prettier, eslint, clippy,
`tsc --noEmit`, 387 frontend tests across 23 files, 158 Rust tests, and
`vite build`. No new design tokens were needed: `--lc-accent-agent-rail`,
`--lc-accent-agent-text`, `--lc-accent-agent-soft` and `--lc-warn` all already
existed, and every colour added to `styles.css` is a `var(--lc-*)`.
`npm run verify` was not run, as instructed.
