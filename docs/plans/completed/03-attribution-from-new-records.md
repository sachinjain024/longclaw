---
title: "Attribute a change from newly appended records only"
product: LongClaw
status: done
completed: 2026-07-31
backlog_id: V0-07
order: 3
owner_area: Domain
release_blocking: true
depends_on: none
---

# Attribute a change from newly appended records only

The app credits an external change to the newest actor in the file, which is not
necessarily the actor who made the change it just observed.

## Why this exists

LongClaw's premise is a shared record where a human can see what an agent did. If
the app can credit an agent for a person's edit, or a person for an agent's, the
record is not shared — it is unreliable. `CONTEXT.md` defines an acknowledgement as
attributed _"only from the records in the file"_, and the round-trip scenario makes
actor correctness release-blocking.

Recorded in [the risk register](../../architecture-spike-risk-register.md) as
_"Activity attribution can disagree with the file change that triggered the
watcher."_ The register's instruction: _"Diff stable before/after records and
associate only newly appended event IDs. Otherwise show actor unknown; never
guess."_

## Working rules

- Topic branch off updated `main`. Never commit to `main`; never merge without being
  asked. (`AGENTS.md`)
- `export PATH="/opt/homebrew/opt/rustup/bin:$PATH"`. `npm --prefix apps/desktop ci`
  if `node_modules` is missing.
- `npm run verify` must pass before you commit.
- Never rewrite a file to make attribution easier. The file is the source of truth
  (ADR 0009); attribution is a read.

## Current behaviour

`IndexedRow.last_activity` is built in `indexed_row`
(`apps/desktop/src-tauri/src/core/storage.rs:210`):

```rust
last_activity: ticket.last_activity().map(|event| ActivitySummary { … }),
```

That is _the newest record in the file_, whoever wrote it and whenever. The
frontend then reads exactly that: `externalMark` (`apps/desktop/src/freshness.ts:35`)
takes `ticket.lastActivity?.actor` as the actor of the change it just observed.

The two disagree whenever the newest record is not the record describing this
change. Concretely:

- An agent appends an activity record, then a person edits the description in an
  editor _without_ appending one. The observed change is the person's; the newest
  record is the agent's; the card shows the agent accent and `❯ updated by <agent>`.
- Any external write that appends nothing at all inherits whatever actor happened to
  be last.

The frontend is already careful and does not need changing: `attribution.ts` treats
an unattributed change as `unknown` and never as an agent, and
`wearsAgentAccent(actorType)` gives `unknown` the agent accent by design, with
`actorGlyph` returning `⚠`. The defect is that Rust hands it a confident, wrong
actor instead of `unknown`.

## Where the fix goes

`process_burst` (`apps/desktop/src-tauri/src/engine.rs:303`) already has both sides
in hand, a few lines apart:

```rust
if directory_key(&path)
    .and_then(|key| self.index.row(&key))          // ← the OLD row, before ingest
    .is_some_and(|row| row.content_hash() == hash)
{ continue; }
if let Ok(ticket) = self.index.ingest(&path) {      // ← the NEW row
```

So the previous row is available at the moment the new one is produced. What it
carries today is only `last_activity` — one `ActivitySummary` — which is enough for a
usable rule but not for a full diff.

Two options; pick one and record why:

- **Compare against the previous last-activity id.** If the new document's activity
  list contains the old `last_activity.id`, the records after it are the newly
  appended ones — attribute from the last of those, or `unknown` if there are none.
  If the old id is absent (history rewritten, records reordered), attribute
  `unknown`. Cheap, no new state.
- **Carry the full record identity set on the row.** More faithful to "diff stable
  records", but it grows the index for every ticket. The register's own note says
  the index must stay affordable; measure before choosing this.

Either way the rule is the same: **the actor of an observed change is the actor of a
record that was not there before. Otherwise `unknown`.**

Note this fix also improves the human-file-edit acknowledgement that
[the round-trip scenario](../../acceptance/agent-round-trip.md) § 4 flags for pilot
review — a hand edit with no record becomes `⚠ file changed on disk — actor
unknown` instead of borrowing the last actor.

## How to prove it

Rust, in `apps/desktop/src-tauri/tests/watcher_integration.rs` (external writes) with
unit coverage beside the diff logic:

- **A record-less external write reads as unknown.** Take a ticket whose newest record
  is an agent's, change the description externally without appending anything, and
  assert the emitted row's attribution is `unknown` — not that agent.
- **A newly appended agent record is credited to the agent.** The normal path must not
  regress.
- **Rewritten history reads as unknown.** If the old last-activity id is gone from the
  file, do not guess.
- **The app's own write is unaffected.** It is suppressed by the receipt before
  attribution is ever considered.

Frontend, in `apps/desktop/src/freshness.test.ts` and `src/Board.test.tsx`: an
`unknown` actor renders the `⚠` treatment and the actor-unknown copy, which
`attribution.test.ts` already partly covers.

Manual: [the round-trip scenario](../../acceptance/agent-round-trip.md) § 4, whose
pass conditions include _"if the agent's record carried no actor metadata, the
acknowledgement reads `⚠ file changed on disk — actor unknown` rather than crediting
an agent."_

## Done when

- The tests above are in the suite and fail against today's behaviour.
- `npm run verify` passes, including `npm run test:watcher`.
- The register row and [the release risks](../../release-risks.md) row are updated.
- The choice between the two options above is recorded in the `## Outcome` section
  with its reason, since it affects index cost.

## Watch out for

- **`unknown` is not a bug state.** It is the honest answer, and the design already
  specifies its treatment. Resist making it rare by inferring from timestamps or
  file mtime — that is guessing with extra steps.
- **A degraded row has no activity at all.** `TicketRow::Degraded` carries a
  diagnostic, not records. Do not assume `IndexedRow` on the ingest path.
- **Do not let attribution reach into the conflict path's actor.** `conflict_error`
  (`storage.rs:517`, around line 529) also reads `last_activity` — to name who
  changed the file under a stale write. That use is legitimate and different: it is
  "who is on disk now", not "who made this change". Leave it, and say so in a comment
  so the next reader does not "fix" it.

## Outcome

Closed on 2026-07-31.

### The choice the plan asked to be recorded

**Option one: compare against the previous last-activity id.** No new index state,
no measurement needed, and it answers the question the register actually asked.

Option two — carrying the full record identity set on every row — buys fidelity
only in cases option one already refuses to guess about. If records are reordered
or an id is rewritten, a full set would let you say "these three are new", but the
history has been rewritten and any claim about which one caused *this* change is
still a guess. So the extra index cost per ticket, forever, buys a better answer to
a question we would refuse to answer either way. Option one it is.

### Attribution is a property of the change, not of the ticket

The important decision, and the one that stops this defect coming back: the actor
does **not** go on the row. `ProjectEvent::TicketChanged` gained
`attribution: Option<ActivitySummary>`.

`IndexedRow::last_activity` still means what it always meant — the newest record in
the file — and stays untouched, because that is a real and useful thing for a
timeline preview. The bug was one caller reading it as though it meant something
else. A snapshot has no transition and therefore carries no attribution at all,
which is the type system saying the same thing.

`core::attribution::attribute_change(previously_seen, now_present)` is the rule, as
a pure function with its own unit tests:

- `previously_seen` absent → everything in the file is new to us; the newest record
  is this change.
- `previously_seen` found → the records after it are the appended ones; the last of
  those is the actor, or `None` if there are none.
- `previously_seen` not found → history was rewritten; `None`.

`TicketIndex::ingest_attributing` wires it, because the parsed document is the only
place both the row and the records exist and reading the file twice would be a
second chance for it to move underneath us. The policy stays out of the index: the
index stores rows, it does not decide who did what.

In `process_burst`, the previous row is now read once and used twice — for the
existing same-bytes check and for the id to compare against. It has to be read
before the ingest, because after it that row is gone.

### The frontend

`externalMark` used to take a `TicketRow` and reach into `ticket.lastActivity`.
It now takes the `Actor | undefined` that Rust attributed, and `state.ts` passes
`event.data.attribution?.actor`. The signature change is the point: it is no longer
*possible* to hand this function a ticket and have it find an actor to blame.

Nothing else needed changing. `attribution.ts` already treated `unknown` as a
first-class state, `wearsAgentAccent` already gives it the agent accent, and
`Board.test.tsx` already asserted the `⚠ file changed on disk — actor unknown` copy.
The frontend was right; Rust was handing it a confident wrong answer.

The conflict path was left exactly as the plan asked, and now has a comment saying
why: `conflict_error` reads `last_activity` to answer "who is on disk now", which is
a different and legitimate question.

### How it was proved

Six unit tests beside the rule in `core/attribution.rs`, three watcher-integration
tests, and one store test:

| Case | Test |
|---|---|
| A record-less external write is unknown | `an_external_write_that_appended_no_record_is_actor_unknown` |
| A newly appended record is credited | `a_newly_appended_record_is_credited_to_the_actor_who_wrote_it` |
| Rewritten history is unknown | `rewritten_history_is_actor_unknown_rather_than_a_guess` |
| The app's own write never reaches attribution | `an_app_write_is_not_echoed_back_as_an_external_change` (existing; the receipt suppresses it first) |
| The store does not borrow the row's newest actor | `does not borrow the file's newest actor for a change that appended nothing` |

The watcher tests use LC-2, whose newest record belongs to Fixture Agent, and one of
them asserts that precondition so the test cannot quietly stop being meaningful if
the fixture changes.

**The red half was verified.** With `attribute_change` reduced to "the newest record
in the file" — the old behaviour — the tests that are about the defect fail and the
rest pass:

```
test an_external_write_that_appended_no_record_is_actor_unknown ... FAILED
test rewritten_history_is_actor_unknown_rather_than_a_guess ... FAILED
test result: FAILED. 11 passed; 2 failed; 1 ignored

core::attribution::tests::a_change_that_appended_nothing_is_unknown ... FAILED
core::attribution::tests::rewritten_history_is_unknown_rather_than_guessed ... FAILED
test result: FAILED. 4 passed; 2 failed
```

`npm run verify` passes, including `npm run test:watcher`.

### Still open

[The round-trip scenario](../../acceptance/agent-round-trip.md) § 4 has not been
walked by hand. Its pass condition — a hand edit reading `⚠ file changed on disk —
actor unknown` rather than crediting an agent — is now what the code does and what
the automated tests assert, but the scenario is a human walkthrough and nobody has
done it.
