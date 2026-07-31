---
title: "Virtualize the board and list"
product: LongClaw
status: ready
backlog_id: V0-06
order: 7
owner_area: Frontend
release_blocking: false
depends_on: none
blocks: "Wave 1's issue-list surface (V0-14)"
---

# Virtualize the board and list

The spike proved the data flow, not 5,000 rendered cards. The one Step 4 budget with
no measurement behind it is the one this fixes.

## Why this exists

Every other performance budget has a number against it. This one reads: _"Phase 1 must
add virtualization and a WebKit trace; the spike intentionally does not render 5,000
rows."_ The Rust side is fast — 5,000 tickets rebuild in ~711 ms and search in
~2.35 ms — so if the product feels slow at scale, this is where it will be.

Recorded in [the risk register](../../architecture-spike-risk-register.md) as _"Linear
React rendering becomes expensive on a large board"_, likelihood **high**, with the
instruction to enforce it _"before Phase 1 breadth"_.

That timing matters: Wave 1's issue list (V0-14) is a vertical list of every ticket in
the project. Building it on an unvirtualized foundation means building it twice.

**This item is independent of everything else on the list.** It is the one to run in
parallel if two people are working.

## Working rules

- Topic branch off updated `main`. Never commit to `main`; never merge without being
  asked. (`AGENTS.md`)
- `npm --prefix apps/desktop ci` if `node_modules` is missing. `npm run verify` must
  pass before you commit.
- Zustand is a thin cache; subscribe through selectors (ADR 0006).
- Every visual change must come from tokens — no hardcoded colors, and no layout
  movement. `npm run tokens:check` is part of the gate.
- Keyboard navigation follows the _visual_ order
  (`docs/design/prototype/screen-specs.md` § Board). Virtualization must not break
  that, and it must not break focus.

## Current behaviour

- **`Board.tsx`** is 135 lines and renders every ticket it is given, in status
  columns. Columns are 264 px fixed and scroll independently
  (`screen-specs.md` § Board).
- **`App.tsx:45`** subscribes to the whole ticket array:
  ```ts
  const tickets = useLongClawStore((state) => state.tickets);
  ```
  so any change to any ticket re-renders the board's whole tree. `App.tsx` has around
  fifteen such store subscriptions.
- **`state.ts`** keeps `tickets` as a single sorted array (`byKey`), rebuilt on every
  `applyEvent` and `setSnapshot`.
- **The `reportVisibleUi` probe** (`lib.rs:213`, `api.ts:153`) already measures what is
  actually painted on an animation frame, and the spike used it for its
  `VISIBLE_UI_PROBE` timings. Reuse it rather than inventing a measurement.

## The budget to hit

From [the spike report](../../architecture-spike-report.md) § Performance budgets,
p95 on the oldest supported Mac:

| Path                                 | Budget                       |
| ------------------------------------ | ---------------------------- |
| Large-board keyboard/input → paint   | **≤ 50 ms p95, ≤ 16 ms p50** |
| Cold start → first interactive paint | ≤ 1,500 ms                   |
| Stable external save → visible paint | ≤ 500 ms                     |

The middle row is not this item's target but is easy to regress: virtualization adds
mount work on first paint.

## What to change

1. **Virtualize the lanes, not the page.** Each board column scrolls independently, so
   each is its own windowed list. The list view groups by status with sticky headers —
   virtualize within groups.
2. **Narrow the subscriptions.** A card should re-render when _its_ ticket changes, not
   when any ticket does. This is the selector work ADR 0006 asks for, and it is likely
   the bigger win of the two.
3. **Keep the card a single focusable unit.** The spec is explicit: interior elements
   are not tab stops, and clicking anywhere opens the panel. A focused card that gets
   unmounted by scrolling must not lose focus silently.
4. **Preserve the acknowledgement treatment.** The agent ring, the single two-beat
   pulse, and the decay are the product's signature moment. A recycled row must not
   replay the pulse, and a card scrolled out and back must not look freshly changed.

Pick the smallest thing that hits the budget. If narrowing selectors alone gets there
for the board and only the list needs windowing, that is a better outcome than a
windowing library everywhere.

## How to prove it

**A 5,000-ticket browser trace.** The register asks for it by name. Build the project
with the existing harness — `tests/performance.rs` generates 5,000 tickets, and
`npm run dev:fixture` registers a fixture project — then take a WebKit trace of:

- keyboard navigation down a column (`j`/`k` or arrows), measuring input → paint;
- scrolling a full column;
- one external write landing while the board is open.

Record p50 and p95 for each. A single median number is not evidence for a p95 budget.

**Regression cover in the suite:**

- `Board.test.tsx` — existing card, acknowledgement, decay, and degraded-row cases must
  pass unchanged. They are the contract this work must not break.
- A render-count assertion: changing one ticket re-renders one card, not the board.
- Focus retention across a scroll that unmounts the focused card.

**Visual check.** Board in Indigo and Clay, light and dark, before and after — no layout
movement, no changed spacing. The renders under
`docs/design/prototype/renders/` are the reference.

## Done when

- The trace exists with p50 and p95 numbers for all three interactions, inside budget,
  recorded in the `## Outcome` section alongside the machine and build used.
- The `PERF` line from `npm run perf:rust` is recorded too, so the Rust and frontend
  numbers sit side by side.
- `npm run verify` passes with the new regression tests.
- The register row and [the release-risks](../../release-risks.md) row are updated, and
  the large-project scenario in [the acceptance index](../../acceptance/README.md)
  moves from required to partly covered.
- [The spike report](../../architecture-spike-report.md) budget table's empty cell for
  large-board input → paint is filled in with the measurement.

## Watch out for

- **Measure before you optimise.** The board may already hit 50 ms p95 at 5,000
  tickets, in which case the deliverable is the trace and the regression tests, not a
  windowing library. Do not add a dependency to fix a problem you have not observed.
- **A new dependency is a decision.** Lockfiles are committed and CI checks them. If a
  windowing library is genuinely needed, record the choice and why hand-rolling was
  worse.
- **Sticky group headers and virtualization interact badly.** The list spec has 32 px
  sticky headers per status group and an archived group at the bottom
  (ADR 0004). Get that geometry right or the list will jitter.
- **Do not change the ordering rules.** Priority order by default, Manual reading
  `rank` (ADR 0003). Ordering is a view preference and never rewrites files.
