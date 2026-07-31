---
title: "Recover from an event-sequence gap"
product: LongClaw
status: done
completed: 2026-07-31
backlog_id: V0-02
order: 2
owner_area: Frontend
release_blocking: true
depends_on: none
---

# Recover from an event-sequence gap

One dropped project event leaves the board permanently stale while everything about
the UI still says it is live.

## Why this exists

The product's claim is that external changes appear without a refresh. A visible
error breaks that claim honestly; silent staleness breaks it while telling the user
everything is fine. That is the worse failure, and it is the one the app has today.

Recorded in [the risk register](../../architecture-spike-risk-register.md) as _"A
missed project-event sequence does not trigger snapshot recovery."_ The sequence
numbers exist and old events are dropped correctly — the gap check is what is
missing.

This is the cheapest severe fix on the list: one function, one store, no Rust.

## Working rules

- Topic branch off updated `main`. Never commit to `main`; never merge without being
  asked. (`AGENTS.md`)
- `npm --prefix apps/desktop ci` if `node_modules` is missing.
- `npm run verify` must pass before you commit.
- Zustand is a thin frontend cache, not a second source of truth (ADR 0006). The
  answer to "is my state wrong?" is always "ask Rust for a snapshot".

## Current behaviour

`applyEvent` in `apps/desktop/src/state.ts:119` opens with:

```ts
applyEvent: (envelope, observedAt = Date.now()) => {
  const state = get();
  if (envelope.sequence <= state.lastSequence) return;
  if (state.activeProjectId && envelope.projectId !== state.activeProjectId) return;
```

The first guard correctly ignores an older or duplicated sequence. Nothing then asks
whether the sequence _skipped_. Each of the four branches — `ticketChanged`,
`ticketRemoved`, `indexRebuilt`, and the project-unavailable fallthrough — ends by
setting `lastSequence: envelope.sequence`, so after a gap the store quietly adopts
the new high-water mark and the change it never saw is lost for good.

Sequence numbers are assigned in `emit` (`apps/desktop/src-tauri/src/engine.rs:292`)
with `fetch_add`, so they are contiguous per engine and a gap really does mean a lost
event rather than a numbering quirk.

## What to change

Detect `envelope.sequence > state.lastSequence + 1` and recover by snapshot rather
than by applying the event in hand:

1. **Suspend incremental application.** Do not apply the event you were handed and
   then reconcile — that applies history out of order. Mark the store as recovering
   and drop incremental events until the snapshot lands.
2. **Request exactly one snapshot.** Not one per event that arrives while you wait.
3. **Resume from the snapshot's boundary.** Adopt its `generation`, and the sequence
   the snapshot was taken at, then accept incremental events again.
4. **Say so, briefly.** The user does not need a modal, but a moment of
   "reconciling" is honest where silence is not. `loading` already exists in the
   store for this kind of state.

`reconcileProject` (`apps/desktop/src/api.ts:124`) is the existing snapshot request.
`App.tsx:211-226` already calls it from `focus` and `visibilitychange` handlers and
is the pattern to copy, including its error handling. `openProject` and
`rebuildIndex` also return a `ProjectSnapshot`.

Decide and write down whether the store performs the recovery itself or exposes the
need and lets `App` do the call. The store is deliberately thin (ADR 0006), so
exposing the need is the more consistent choice — but either is defensible if
recorded.

## How to prove it

In `apps/desktop/src/state.test.ts`, which already covers `applyEvent`:

- **A gap suspends and asks once.** Feed sequence 1, then 3. Assert the change from 3
  is not applied incrementally, that exactly one recovery is requested, and that
  feeding 4 and 5 while recovering does not request more.
- **Recovery converges.** After the snapshot is applied, state equals what it would
  have been had no event been lost. This is the assertion that matters — the others
  are mechanism.
- **Reordering is still ignored.** Sequence 3 then 2: the 2 is dropped, and no
  recovery is triggered, because a late duplicate is not a gap.
- **Acknowledgements survive.** `externalMarks` carry the agent acknowledgement, and
  `setSnapshot` already preserves them across a rebuild deliberately
  (`state.ts:113`). A recovery must not wipe the ring off a card an agent just
  touched.
- **Project switching is unaffected.** The existing `activeProjectId` guard must still
  short-circuit before any gap logic, or switching projects will look like a gap.

## Done when

- The tests above are in `state.test.ts` and fail against today's `applyEvent`.
- `npm run verify` passes.
- The register row and [the release risks](../../release-risks.md) row are updated.
- [The acceptance index](../../acceptance/README.md) row for the event-loss scenario
  can move from required to covered.

## Watch out for

- **`lastSequence` starts at 0** and the first real event is 1, so the very first
  event must not read as a gap. Guard the initial case explicitly.
- **A rebuild also emits.** `rebuild(reason, emit)` at `engine.rs:202` publishes an
  `indexRebuilt` event with its own sequence; recovery must not fight it.
- **Two engines, one store.** Switching projects starts a new engine with its own
  sequence counter starting from zero, which is exactly why the `activeProjectId`
  guard runs first. Do not reorder those two guards.
- **Do not add retry-forever.** If the snapshot request itself fails, surface the
  error like `App.tsx` already does. A silent retry loop rebuilds the same problem
  one layer up.

## Outcome

Closed on 2026-07-31.

### The plan was wrong about one thing: this needed Rust

"One function, one store, no Rust" does not survive step 3 of its own instructions.
Resuming from *the snapshot's boundary* requires the snapshot to carry a boundary,
and `ProjectSnapshot` had only a `generation`. Without a sequence there is no
correct value for `lastSequence` after recovery: keep the old one and the events
that arrive next re-trigger the gap forever; adopt the triggering event's and you
have silently accepted the loss you just detected.

So `ProjectSnapshot` gained `sequence: u64`, and with it the frontend `types.ts`
mirror and the pinned `tests/fixtures/ipc-contract.json`. The contract test caught
the wire change on the first run, which is exactly its job.

**The read order matters and is load-bearing.** `ProjectEngine::snapshot` and
`rebuild` read `self.sequence` *before* the index rows. The two are not atomic
together, so the boundary is approximate — and reading it first makes it
approximate in the safe direction. Too low costs a redundant re-apply of an event
the snapshot already contains, and every event kind is idempotent (`ticketChanged`
and `indexRebuilt` carry whole rows; `ticketRemoved` is a delete). Too high would
skip an event the rows do not contain, which is the failure this field exists to
prevent. Both call sites carry a comment pointing at the field's doc.

### What the frontend does

`applyEvent` gained two guards, after the existing two and deliberately in this
order:

```ts
if (envelope.sequence <= state.lastSequence) return;   // older or duplicate
if (state.activeProjectId && envelope.projectId !== …) return;   // other project
if (state.reconciling) return;                          // already recovering
if (envelope.sequence > state.lastSequence + 1) { … }   // a gap
```

The project guard stays ahead of the gap check because another project's engine
counts from zero, and reordering them would make every project switch look like a
gap. `lastSequence` deliberately does **not** advance on a gap: adopting the new
high-water mark is precisely how the change nobody saw becomes unrecoverable.

**The store raises a flag; `App` does the fetch.** `reconciling: boolean` is the
flag, and the recovery effect in `App.tsx` calls the existing `reconcileProject`.
This is the choice the plan called more consistent with ADR 0006, and it is the one
taken: the store stays a cache with no I/O. `applySnapshot` lowers the flag and
adopts `Math.max(lastSequence, snapshot.sequence)` — never backwards, because an
ordinary focus reconcile can carry a boundary older than events already applied on
top of it, and adopting it would replay them.

Exactly one snapshot is requested because the flag gates the effect and every event
arriving meanwhile is dropped rather than queued.

### Decisions not in the plan

- **`reconcileFailed()`.** A failed snapshot request must not leave the app in
  `reconciling` forever, which would be a *worse* silent staleness than the one
  being fixed — the board would stop updating entirely. It lowers the flag without
  adopting a sequence, so the next event that skips asks once more. This is
  retry-on-next-gap, not retry-on-a-timer: bounded by event arrival, with the error
  visible every time it fails. The plan's "do not add retry-forever" is respected;
  its "surface the error" alone would have wedged the app.
- **`setLoading(false)` is not in a `finally`.** Applying the snapshot lowers
  `reconciling`, which re-runs the effect and marks the in-flight pass inactive
  before a `finally` would run. Found by a failing test, not by reasoning. Both
  calls now sit in the `then`.
- **The disk-state chip says `reconciling`**, not `reading`. The plan asked for a
  brief honest signal; reusing `loading`'s "reading" would have described the wrong
  thing.
- **Existing tests had to state a precondition they were relying on the absence
  of.** The fixture envelopes carry sequences 1–4, and several tests applied
  sequence 2, 3, or 4 to a store at 0 — which is now correctly a gap. They use a new
  `applyInSequence` helper that seeds `lastSequence` to `envelope.sequence - 1`. The
  tests did not change what they assert; they now say out loud that they are not
  about gaps.

### How it was proved

Six tests in `state.test.ts` and two in `App.test.tsx`, covering every case the plan
listed:

| Case | Test |
|---|---|
| A gap suspends and asks once | `stops applying events when one goes missing, and asks for a snapshot once` |
| Recovery converges | `converges on the state it would have had if nothing was lost` |
| Reordering is still ignored | `treats a late duplicate as reordering rather than a gap` |
| Acknowledgements survive | asserted inside the convergence test |
| Project switching is unaffected | `does not read a project switch as a gap` |
| Failure does not wedge or loop | `lets the next gap ask again after a failed snapshot request` |
| The boundary never goes backwards | `never moves the sequence boundary backwards on an ordinary reconcile` |
| One request, resumed, loading cleared | `fetches one snapshot, says it is reconciling, and resumes` |
| A failed request surfaces | `surfaces a failed snapshot instead of retrying behind the user's back` |

**The red half was verified.** With the gap branch disabled, the three tests that
are about gap detection fail and the rest pass:

```
× stops applying events when one goes missing, and asks for a snapshot once
× converges on the state it would have had if nothing was lost
× lets the next gap ask again after a failed snapshot request
Tests  3 failed | 16 passed (19)
```

The other three are regression guards — they assert that something is *not* treated
as a gap — so they pass either way by design.

`npm run verify` passes, including `npm run test:watcher`.

### Still open

[The acceptance index](../../acceptance/README.md) row for the event-loss scenario
has not been moved from required to covered. The automated coverage is green, but
the scenario is written as a human walkthrough and has not been walked.
