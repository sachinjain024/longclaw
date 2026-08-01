---
title: "The dense issue list"
product: LongClaw
status: completed
backlog_id: V0-14
order: 16
owner_area: Frontend
release_blocking: false
depends_on: "07 (board virtualization), 14 (the shared menu), 15 (the label chip)"
blocks: "V0-09 and V0-15, which both order and filter what this surface draws"
---

# The dense issue list

The board answers "what is in flight". Nothing in the app answers "what exists".

## Why this exists

Three things live only on the list surface, and none of them has anywhere else to be:

- **Canceled.** The board draws that column only when it holds something, so the
  one status a person goes looking for after the fact is the one the board is
  free to hide.
- **The archive.** ADR 0004 keeps archived tickets off the board and makes the
  list the archive surface. Without the list, archiving a ticket in v0 would put
  it somewhere with no way back.
- **Density.** A board card is three lines. A project with five hundred tickets is
  not readable three lines at a time.

`docs/backlog/v0-backlog.md:118` is the row. Its must-pass has two clauses, and
they pull in different directions: the surfaces have to *agree* (one state, two
projections) and the list has to be *fast* (5,000 rows on one axis, which is
harder than 5,000 rows across six independent scrollers).

## Working rules

- Topic branch off updated `main`. Never commit to `main`; never merge without
  being asked. (`AGENTS.md`)
- Zustand is a thin cache; subscribe through selectors (ADR 0006). Neither surface
  may hold a second copy of a ticket.
- Every visual value comes from a `--lc-*` token. `npm run tokens:check` is in the
  gate and there are zero hardcoded colours in the stylesheet today.
- Keyboard navigation follows the *visual* order (`screen-specs.md:115`).
- The design is settled: `screen-specs.md` § Issue list, read in full. Do not
  invent anatomy.

## Current behaviour

- **`Board.tsx:71` `layOutColumns`** buckets by status into `STATUSES` order,
  appends a synthetic `unreadable` column, orders each column through
  `ordering.ts`, and produces the seats the arrows read. The list's grouping is
  the same bucketing behind a different presentation.
- **`boardGeometry.ts`** holds the windowing arithmetic: strides, running
  offsets, a binary search, and `windowFor`. Card heights are pinned to tokens and
  asserted against them. It is written for one column of one kind of thing.
- **`App.tsx`** owns the content header and mounts the board. There is no view
  toggle and no `List` anywhere in the app.
- **There is no status dot.** Not on cards, not on column headers, not in the
  shared menu — V0-08 shipped the status menu without a glyph and said so, because
  the glyph is a dot that did not exist.
- **`freshness.ts`, `LabelChip.tsx`, `PriorityGlyph.tsx`, `ordering.ts`** are all
  built and all belong on a list row.

## What to change

1. **Factor the bucketing out of the board** rather than writing it twice. The one
   difference worth a flag: the board keeps every status column (ADR 0002's fixed
   set is the scaffold) and the list keeps only statuses that hold tickets.
2. **Generalize the geometry, do not fork it.** The list is one scroller of two
   kinds of slot — sticky 32px headers and 36px rows. A second copy of the binary
   search that drifts from the first is the failure mode: the drift shows up as
   jitter, and no jsdom test can see jitter.
3. **Build the status dot as a shared component** and pass it into the status
   menu's options, which closes V0-08's open edge. Its colours are the existing
   `--lc-status-*` tokens; check before adding any.
4. **Build the archived group** from `archivedAt`, which every indexed row already
   carries: a focusable header button (`keyboard-focus-map.md:110`), collapsed by
   default, rows at 80% opacity. V0-11 owns the archive *mutation* and taking
   archived tickets off the board. Do neither here.
5. **One roving tab stop**, in one dimension, the way the board does it in two.

## How to prove it

**Agreement.** Tests that drive real events and snapshots through the store and
assert both surfaces show the same tickets: an app edit, an external edit, a
rebuild, and a restart.

**The budget.** ≤ 50 ms p95 for keyboard, scroll and external-write at 5,000
tickets. `npm run perf:board` measures the board; extend it to the list and report
the numbers. A must-pass clause about a budget that is never measured is not met.

**Regression cover.** `Board.test.tsx` must pass unchanged: it is the contract the
refactor must not break.

## Done when

- Both must-pass clauses have tests, each confirmed to fail without the behaviour.
- The list trace exists with p50 and p95 for all three interactions, inside budget,
  recorded here beside the board's.
- `npm --prefix apps/desktop run check` passes.
- The backlog row and this plan's row in `docs/plans/active/README.md` are updated.

## Watch out for

- **Sticky and virtualization interact badly** — plan 07 said so and did not have
  to solve it. A `position: sticky` header needs a real place in the scroller's
  flow; it cannot be absolutely positioned.
- **The probe queries `.ticket-row`.** `App.tsx`'s `reportVisibleUi` and its
  post-create focus call both do. The list's rows are not board cards, and the perf
  harness fails loudly if the probe stops naming what was painted.
- **Do not touch `applyEvent`.** The sequence-gap reconcile is load-bearing and
  well-tested. Read it; leave it.

## Outcome

Completed 2026-07-31 on branch `wave-1-ticket-domain-and-surfaces`.

### What shipped

- **`src/IssueList.tsx`** — the surface. One scroller, a `section` per group with
  a sticky 32px header over a `surface` card of 36px rows, only statuses that hold
  tickets, and the archived group last. Row anatomy is `screen-specs.md:141-146`
  in that order: status dot 13 · mono ID in a 58px column · priority glyph · title
  · fresh dot · checklist fraction · ≤2 chips · relative updated time, mono, right
  aligned, 46px. No assignee slot (ADR 0001).
- **`src/grouping.ts`** — the bucketing, lifted out of `Board.tsx`. `groupByStatus`
  takes the comparator and a `keepEmpty` flag; `seatsFor` builds the seat map both
  surfaces navigate by. `Board.tsx` lost 50 lines and kept every test.
- **`src/listGeometry.ts`** — the list's composition, and no arithmetic of its own.
  It flattens groups into slots and strides and hands them to `runningOffsets` and
  `windowFor` in `boardGeometry.ts`. A test asserts that its offsets *are* what
  `runningOffsets` returns for those strides, so the two cannot drift apart without
  going red.
- **`src/StatusDot.tsx`** — one geometry, six statuses: Todo's unfilled ring is the
  base, Backlog is that ring dashed, everything else is the circle filled. The
  colour is a class over `currentColor`, so the SVG holds no hue and Done can route
  to the human accent (D5) in the stylesheet where that is already known. All six
  `--lc-status-*` tokens already existed; **nothing was added to the token file.**
- **The retrofit.** The status menu's rows carry the dot
  (`TicketPanel.tsx`), which closes the gap V0-08's backlog row names. The board's
  column headers carry it too (`screen-specs.md:103` asked for it and V0-06 left it
  out); the header's flex was re-laid so the dot belongs to the name rather than
  being pushed to the far edge by `space-between`.
- **`src/listRow.ts`** — the row's presentation, the seam `boardCard.ts` is for the
  card. It is what lets the test count renders.
- **The view toggle** in the content header, and `App.tsx` mounting whichever
  surface is chosen from the same `tickets` array.
- **`perf/board-trace.mjs` drives both surfaces** behind `--surface`, and
  `npm run perf:list` is the second entry point. The scenarios are written once;
  only the selectors and the write target differ.

### The trace

`npm run perf:board` and `npm run perf:list`, 2026-07-31, macOS 26.5 (Darwin
24.3.0), Apple Silicon, Node 26.5.0, WebKit 26.5 (`AppleWebKit/605.1.15`) via
`playwright-core` 1.62.1, production Vite build, 1440×900. 5,000 tickets.

| Surface | Interaction (input → paint) | n   | p50   | p95   | max   | 600-ticket floor p50 / p95 |
| ------- | --------------------------- | --- | ----- | ----- | ----- | -------------------------- |
| List    | keyboard `ArrowDown`        | 145 | 13 ms | 15 ms | 18 ms | 13 / 15 ms                 |
| List    | scroll                      | 200 | 17 ms | 18 ms | 20 ms | 17 / 18 ms                 |
| List    | external write → paint      | 40  | 14 ms | 16 ms | 16 ms | 15 / 16 ms                 |
| Board   | keyboard `ArrowDown`        | 145 | 13 ms | 15 ms | 17 ms | 13 / 16 ms                 |
| Board   | scroll                      | 131 | 17 ms | 18 ms | 20 ms | 17 / 18 ms                 |
| Board   | external write → paint      | 40  | 14 ms | 16 ms | 23 ms | 15 / 16 ms                 |

```
PERF-UI surface=list  tickets=5000 rendered_rows=21 first_paint_ms=192 nav_key=ArrowDown
PERF-UI surface=board tickets=5000 rendered_rows=78 first_paint_ms=124 nav_key=ArrowDown
```

Run to run these move by a millisecond or two, as plan 07 also found: a second
list run put scroll at 19 ms p95 with a 27 ms max. The table above is one run, and
the floor beside it is from that same run, which is the comparison the harness
actually gates on.

Against ≤ 50 ms p95: **every p95 is inside the budget with better than a 3×
margin, and the list is indistinguishable from the board.** It is also
indistinguishable from its own 600-ticket floor on all three interactions, which
is the comparison that means anything — one frame at 60 Hz is 16.7 ms, so no
input → paint measurement can report less, and the question worth asking is
whether 5,000 tickets cost anything a small project does not. They do not: the
list keeps 21 rows in the document at either size.

The board's numbers are also 3–4 ms better than plan 07 recorded on the same
harness. Nothing in this work made the board faster; the machine is different.
That is the reason the harness carries its own floor rather than comparing against
a number written down in July.

### Automated proof

Eleven behavioural claims, each confirmed red by reverting the behaviour and
running the test that covers it:

| Claim | Test |
| --- | --- |
| archived tickets are held out of the status groups | `IssueList.test.tsx` |
| the archived group is collapsed by default | `IssueList.test.tsx` |
| only statuses holding tickets get a group | `IssueList.test.tsx` |
| the list windows its rows | `IssueList.test.tsx` |
| the focused row stays mounted through a scroll | `IssueList.test.tsx` |
| navigation crosses a group header | `IssueList.test.tsx` |
| one changed ticket re-renders one row | `IssueList.test.tsx` |
| the row shows a relative updated time | `IssueList.test.tsx` |
| the status menu's rows carry the status dot | `TicketPanel.test.tsx` |
| the list geometry matches the stylesheet | `listGeometry.test.ts` |
| the list is a projection of the same store state as the board | `App.test.tsx` |

The last one is the must-pass. `App.test.tsx` § "the list and the board agree"
mounts the real `App` over mocked IPC and compares what each surface has on screen
after an app edit through `mutate()`, an external `ticketChanged` delivered to the
listener Rust would use, an `indexRebuilt`, and a remount over a fresh snapshot.
It also asserts the list shows an archived ticket the board does not.

`npm --prefix apps/desktop run check`: green — tokens, format, lint, typecheck,
230 frontend tests (up from 183), 103 Rust unit tests plus the integration suites,
and the Vite build.

### Deviations and decisions worth naming

- **The sticky header's fill is `--lc-surface`, not `--lc-bg`.** The spec says
  `--lc-bg`, and it is describing a list that sits on the app background. In this
  build the list sits inside the `.workspace` card, which is `surface`; a `bg` fill
  would read as a grey band. The intent — a fill so rows do not show through a
  sticky header — is met by the surface it is actually on. If the workspace card
  ever goes away, this goes back to `--lc-bg`.
- **`columnOffsets` is now `runningOffsets`.** It was never about columns; it turns
  strides into running tops. `windowFor` and the binary search were already
  general. The board's callers and `boardGeometry.test.ts` were updated, and this
  is the only interface change — V0-09 and V0-15 should know about it.
- **`Seat.column` is now `Seat.group`,** because the seat map is shared and the
  list has groups. The board's prose still says column everywhere else, which is
  what `screen-specs.md` and `keyboard-focus-map.md` call them.
- **The probe's selector is now `[data-ticket-key]`.** `App.tsx`'s `reportVisibleUi`
  and its post-create focus call both used `.ticket-row`, which is the board card's
  class and not something a 36px list row could wear without inheriting the card's
  layout. The data attribute is the contract both surfaces already satisfied.
- **The perf harness writes to a different ticket per surface.** The board's
  scenario wrote to `PF-3`, the first card of the In Review column, because each
  column scrolls independently and that card is always in the window. On the list
  In Review is the fourth group, 90,000 px down, so the write landed on a row the
  list is free not to draw and the probe assertion caught it. The list writes to
  `PF-6`, the first row of the first group. That the harness *failed* rather than
  reporting a fast number for an unpainted write is the assertion doing its job.
- **`npm run perf:board` did not exist at the repository root.** `AGENTS.md`
  documents it there. Both it and `perf:list` are now root scripts that delegate.
- **`P` does not open the priority menu on a list row.** The board has it because
  `keyboard-focus-map.md` § Board specifies it; the list section does not, and
  guessing at a keyboard contract for a surface whose ordering and filtering
  controls are still unbuilt (V0-09, V0-15) seemed worse than leaving it.
- **Roles: `section` + heading + `button` rows, not `table`/`grid`.** A row is one
  activation target that opens the panel, not a grid of navigable cells. `grid`
  would promise cell navigation the surface does not implement and would need
  `aria-rowcount`/`aria-rowindex` bookkeeping against a DOM that holds 21 of 5,000
  rows. The count in the heading is what tells a screen-reader user how big a group
  is. It is the contract the board already ships, which is also worth something.
- **"View raw file" on a degraded row is a label, not a control.** The row is a
  single focusable unit and a button inside a button is not valid HTML; the panel
  the row opens is where the raw file already is.

### What remains

- **The list is not filtered, sorted, or grouped by anything but status.** V0-15
  owns that, and `groupByStatus(tickets, { compare })` already takes the
  comparator V0-09's Manual mode will supply.
- **Archived tickets still render on the board.** V0-11 owns that, and the list's
  `isArchived` in `tickets.ts` is the predicate it should use.
- **No empty-state or no-matches panel on the list.** `screen-specs.md` gives those
  to the board and to the filter, which is V0-15.
- **The trace runs on a current Mac, not the oldest supported one** — the same gap
  plan 07 left open, and the same wide margin.

## Amendment 2026-08-01 — the budget gates something now

V0-14's must-pass includes *the list renders inside the interaction budget with
V0-06 in place*, and this plan closed it with a number: 15/18/16 ms p95 from a
run of `npm run perf:list`. `perf:list` does assert its own budget and does exit
non-zero over it — but it was wired into neither `npm run verify` nor CI, so the
clause was backed by a trace somebody remembered to run. Nothing would have gone
red if the list got slower.

Both traces now run as a second CI job, `perf` in `.github/workflows/ci.yml`, on
every pull request and every push to `main`. Deliberately *not* in `npm run
verify`: two WebKit runs over 5,000 tickets are minutes, and a pre-commit gate
that costs minutes is a pre-commit gate people learn to skip — which would have
cost more than it caught. `AGENTS.md` § Toolchain says where the traces live and
when to run them by hand.

The job needs two things a bare checkout does not have, both of which V0-14's own
run already discovered: `npm ci` in `apps/desktop`, because `playwright-core` is
a devDependency, and `npx playwright-core install webkit`, because the package
ships the driver and not the browser. WebKit specifically — a Chromium number
would not be evidence about a Tauri webview.
