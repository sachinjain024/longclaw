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

## Outcome

Completed 2026-07-31 on branch `board-virtualization`.

### What the measurement said first

The board was traced before anything was changed, because the plan said to. Three
things came back, and they set the shape of the work:

- **Scrolling was the expensive interaction, not rendering.** A 5,000-ticket board
  scrolled at 71 ms p50 / 74 ms p95 a frame. Cutting the rendered cards to what
  fits on screen — with nothing else changed — put it at 21 ms, the same as a
  200-ticket board. So the cost was the nodes in the document, and no amount of
  selector narrowing would have touched it.
- **`content-visibility: auto` does not help.** Measured at 75 ms p50 / 96 ms p95,
  slightly _worse_ than doing nothing. It would also have been unavailable
  anyway: `tauri.conf.json` sets `minimumSystemVersion: 13.0`, and no WebKit that
  ships with macOS 13 supports it.
- **There was no keyboard navigation to measure.** WebKit does not put `<button>`
  in the Tab order unless full keyboard access is switched on, so on the shipped
  board the cards could not be reached from the keyboard at all. The plan asked
  for `j`/`k`-or-arrows navigation to be traced; it had to be built first.
  `docs/design/prototype/keyboard-focus-map.md` § Board already specified it, key
  for key — roving focus, `↑`/`K` and `↓`/`J` within a column, `←`/`H` and `→`/`L`
  across columns with the row index clamped, focus entering at the first card of
  the first non-empty column. This implements that section; the `S`, `P`, and `C`
  bindings beside it remain unimplemented and belong to their own items.

### What shipped

- **Each column is its own windowed scroll container** (`screen-specs.md` § Board,
  which already asked for independent column scrolling). `boardGeometry.ts` holds
  the arithmetic — strides, offsets, and the visible range — as pure functions.
- **The geometry is exact rather than measured.** The stylesheet pins both card
  heights to new tokens, `--lc-size-board-card` (55px) and
  `--lc-size-board-card-fresh` (79.33px). Both are what the card already
  measured, so nothing moved. The fresh height is only knowable because `.actor`
  is now `white-space: nowrap`. `screen-specs.md` § Board states "the footer never
  wraps" as a property of the card — it says it while capping label chips, so it
  is not literally a rule about the acknowledgement line, but it is the same
  intent, and the shipped CSS held neither: a long enough agent name wrapped the
  footer and made the card 12px taller. It truncates now, the way the card's title
  already did.
- **Cards are memoized on their own ticket**, and the acknowledgement clock is
  handed only to cards wearing an acknowledgement, so the once-a-second tick does
  not re-render a column that has nothing to say. Grouping is one pass over the
  tickets instead of one `filter` per status.
- **Roving focus**, to `keyboard-focus-map.md` § Board. Arrows, or
  `j`/`k`/`h`/`l`, move a single tab stop through the visual order. The column
  keeps its focused card and its open card mounted wherever they have been
  scrolled to, so windowing can never drop focus onto the body. Sideways moves
  skip empty columns and clamp to the one they land in.
- **The pulse plays once.** `.pulse-dot` carried its animation unconditionally,
  and a CSS animation restarts whenever its element mounts — so with the column
  windowed, scrolling a fresh card out and back would have replayed the two-beat
  pulse for a change the human saw two minutes ago, which is exactly what the
  plan's item 4 forbids. `freshness.isPulsing` gates the animation on the change
  still being newer than the pulse itself; the ring and the footer stay, because
  they are still true.
- **`perf/`, the harness.** It builds the app's own bundle as a web page with the
  three Tauri modules stubbed, serves it, and drives it in WebKit. Adds one
  dependency, `playwright-core@1.62.1` (13 MB, downloads no browsers); the
  reasoning, including why not `playwright`, `safaridriver`, or hand-rolling, is
  in `perf/README.md`. It is not part of `npm run verify`.

### The trace

`npm run perf:board`, 2026-07-31, macOS 26.5.2 (build 25F84), Apple Silicon,
Node 22.15.1, WebKit 26.5 (`AppleWebKit/605.1.15`) via `playwright-core` 1.62.1,
production Vite build, 1440×900. 5,000 tickets across six columns; 78 cards
rendered.

| Interaction (input → paint)        | n   | p50   | p95   | max   | 600-ticket floor p50 / p95 |
| ---------------------------------- | --- | ----- | ----- | ----- | -------------------------- |
| Keyboard `ArrowDown` down a column | 145 | 17 ms | 18 ms | 19 ms | 17 / 17 ms                 |
| Scrolling a full column            | 131 | 20 ms | 22 ms | 24 ms | 20 / 20 ms                 |
| External write → paint             | 40  | 19 ms | 20 ms | 22 ms | 19 / 20 ms                 |

Run to run these move by a millisecond or two; the numbers above are one run, and
the floor beside them is from the same one.

Against the budget of ≤ 50 ms p95 and ≤ 16 ms p50:

- **Every p95 is inside the budget**, with roughly a 2.5× margin.
- **No p50 is below 16 ms, and none can be.** One frame at 60 Hz is 16.7 ms, so
  the least any input → paint measurement can report is a frame. That is why the
  harness measures a small board through the same code on the same machine and
  reports it beside the full one: at 5,000 tickets every interaction lands within
  a millisecond of the 600-ticket floor, so what the median measures is the frame,
  not the board. `perf:board` fails on that comparison rather than on the
  unreachable absolute.

Before, for the same interactions: scroll 71 ms p50 / 74 ms p95, external write
36 ms p50 / 47 ms p95, keyboard not reachable. Load to first painted rows went
from 533 ms to 112 ms, which is the mount cost the plan warned virtualization
could regress going the other way.

Storage numbers from the same machine, for the pair the plan asked to sit side by
side:

```
PERF tickets=5000 open_ms=1790.36 rebuild_ms=1628.07 search_ms=2.14 detail_ms=0.50 write_ms=53.36 create_ms=63.50
PERF-UI tickets=5000 rendered_rows=78 first_paint_ms=112 nav_key=ArrowDown
```

### Automated proof

- `boardGeometry.test.ts` — strides, offsets, the visible range at both ends of a
  column, the unmeasured first paint, and that the constants agree with the tokens
  the stylesheet is generated from.
- `Board.test.tsx` — the existing card, acknowledgement, decay, degraded-row, and
  grouping cases pass **unchanged**. Added: a column renders a window and not
  the rest; the sizer reserves the whole column; a scroll swaps the window; a focused
  card that scrolls out stays mounted and keeps focus; the open card stays
  mounted; a single tab stop; arrows and `j`/`k` move in visual order; a move
  crosses to the next non-empty column; a modified arrow is left to the window;
  navigation reaches a card the column is not rendering; **a change to one ticket
  presents one card and no other**; the once-a-second acknowledgement tick
  presents only the card wearing one; the pulse beats on a change that has just
  arrived, not on one already seen, and not again when a scroll brings the card
  back.
- `npm run verify` passes: 113 frontend tests, the Rust suite, tokens, format,
  lint, typecheck, build, and `npm run test:watcher`.

### Visual check

`node perf/board-shots.mjs <dir>` renders the board with one card wearing an
unreviewed agent change, in Indigo and Clay, light and dark. Compared against the
same four renders built from `main`: **zero pixels differ in all four**. The
acknowledgement ring, which a scroll container would otherwise clip, keeps its
room because the column's padding was split between the section and the scroll box
rather than added to it.

### Deviations worth naming

- **The harness stubs Tauri rather than driving the app.** The plan said to build
  from the existing harness — `tests/performance.rs` and `npm run dev:fixture`.
  `perf/fixture.ts` instead generates the same 5,000 tickets in TypeScript and
  serves them through stubbed Tauri commands. Driving the real app needs a GUI
  session and cannot run unattended or reproducibly, and the trace is about the
  render path. The consequence is real and worth stating: **this trace does not
  exercise Rust, IPC, or the watcher at all.** `npm run perf:rust` and
  `npm run test:watcher` are what cover those, and the fixture is kept in the
  shape `tests/performance.rs` writes so the two describe one project.
- **The probe is a witness, not the clock.** The plan said to reuse
  `reportVisibleUi` rather than invent a measurement. Its effect only re-runs when
  the ticket array or the sequence changes, so it cannot time a keypress that only
  moves focus. The harness times on the same animation-frame boundary the probe
  reports on, and _asserts_ the probe fired and named the row that was written —
  a measurement that paints the wrong thing fails rather than reads fast.
- **"Lane" is this plan's word; the code says "column".** `screen-specs.md`,
  `keyboard-focus-map.md`, and the existing `BoardColumn`/`.board-column` all say
  column, so the code stayed with column throughout.

### What remains

- **The list surface does not exist yet.** V0-14 builds it, and it inherits
  `boardGeometry.ts`. Its sticky 32px group headers and the archived group
  (ADR 0004) are the geometry this plan warned about and did not have to solve.
- **The trace runs on a current Mac, not the oldest supported one.** The budget is
  stated for the oldest supported Mac; macOS 13's WebKit is older than the one
  measured here. The margin is wide, but the acceptance row stays partly covered
  until it is run there.
- **`App.tsx` still subscribes to the whole ticket array.** It is no longer worth
  changing: with the column windowed and the cards memoized, the board's cost is at
  the floor, and the plan's own instruction was to pick the smallest thing that
  hits the budget.
