---
title: "Recover from an event-sequence gap"
product: LongClaw
status: ready
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
