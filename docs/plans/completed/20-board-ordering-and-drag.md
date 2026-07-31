---
title: "Board ordering control, Manual mode, and drag-and-drop"
product: LongClaw
status: completed
backlog_id: "V0-09"
order: 20
owner_area: Domain
release_blocking: true
depends_on: "14 (the shared menu and the ordering seam), 16 (the shared bucketing)"
---

# Board ordering control, Manual mode, and drag-and-drop

ADR 0003 gives the board two orders and only one of them exists. The second one
is the interesting half: Priority is a comparator over an enum, and Manual is a
per-ticket string that two files have to agree about with nothing between them.

Everything the frontend needed was already built. `src/ordering.ts` has held
`byPriority` and `orderColumn(tickets, compare)` since V0-08, waiting for a
second comparator. `src/Menu.tsx` has held a `footnote` prop since V0-08, put
there for this menu's note. `TicketEdit.rank` has accepted a string or `null`
since plan 12. So this is a comparator, a rank allocator, and a drop.

## Working rules

- Frontend only. Nothing in Rust needs to change; `rank` already round-trips.
- Every write goes through `mutate()` (plan 13). No second write path.
- The preference is device-local app state (`data-requirements.md:19`) and must
  never reach `longclaw.yaml` or a ticket file.
- A rank an agent wrote is preserved. The format contract says agents do not
  invent ranks; the app owes one it did not write the same courtesy.

## Do this

1. **`src/rank.ts`** — fractional indexing, base 62 in ASCII order, with the
   integer-part header that makes head and tail drops constant-length. Its own
   module and its own unit tests, including the adversarial cases.
2. **`src/ordering.ts`** — `byRank` beside `byPriority`, `comparatorFor(mode)`,
   and `rankForDrop(ordered, key, gap)`. Decide the mixed ranked/unranked case
   and make it total.
3. **`src/boardGeometry.ts`** — `gapAt(offsets, position)`. The drop position has
   to be arithmetic, because most of the column is not in the document.
4. **`src/Board.tsx`** — native HTML5 drag events in Manual only, a drop line, and
   edge auto-scroll. No drag library.
5. **`src/App.tsx`** — the header control on `MenuButton` with the spec's
   footnote, the preference in `localStorage` per project, and `reorderTicket`
   beside `changePriority`.
6. **`src/IssueList.tsx`** — the same preference for the rows inside a group
   (`screen-specs.md:146`). No drag.

## Done when

- Drag is available only in Manual; Priority writes no rank; switching the order
  rewrites nothing. Each pinned by a test that was confirmed failing first.
- `npm --prefix apps/desktop run check` passes.
- `npm run perf:board` and `npm run perf:list` are re-run, in both orders.

## Outcome

Shipped as planned, with three decisions the plan left open and one limitation
that is worth reading before V0-15 touches ordering again.

### The rank allocation scheme

`apps/desktop/src/rank.ts` is fractional indexing: base 62 in ASCII order
(`0-9A-Za-z`), so plain `<` on the string is the order and nothing parses a rank
at read time. A key carries an integer part whose first character states its
length — `a`+1 digit, `b`+2, `Z`+1 and `Y`+2 going negative — and an optional
fraction after it.

The header is the whole reason to prefer this over a bare midpoint string.
Without it, appending at the tail lengthens the key every few cards: 500
consecutive tail drops would leave a ~100-character rank in the frontmatter.
With it, the tail increments an integer and the head decrements one, so the two
common drops stay four characters wide however many times they happen — which is
what the tests assert. Splitting the *same* gap 200 times does spend length, one
character per five splits, and no scheme avoids that.

The algorithm is the one David Greenspan's write-up describes
(`rocicorp/fractional-indexing`, MIT), written out rather than depended on: it is
a hundred lines, the allocation is a v0 format commitment (`file_format.md:131`),
and plan 08 already measured what a transitive dependency costs here.

It also settles a small mystery. `file_format.md:66`'s example is `rank: "a0V"`,
and `a0V` is exactly what this allocates for a card dropped into the first gap it
is ever asked about. The example was not invented.

**A rank this build did not write is preserved and ordered by, and never used as
a bound.** `isAppRank` rejects anything outside the alphabet — a LexoRank string
like `0|hzzzzz:`, a bare fraction, a trailing `0` that would be a second spelling
of the same position — and `rankBetween` drops such a bound rather than parsing
it. Comparison still uses the whole string, because ignoring a rank would move a
card nobody touched.

### The mixed ranked/unranked rule

**Ranked cards first, in rank order; everything with no rank after them, in the
priority order it already had.** A rank is a position a human chose; no rank is a
position nobody chose.

Two consequences are deliberate. Switching a board nobody has dragged into Manual
changes nothing on screen, which is the honest reading of "the ordering choice
never rewrites files" — the choice does not move anything either. And the first
card dragged in a column lands at the boundary between the ordered cards and the
unordered ones, rather than exactly under the pointer.

**That boundary is the limitation.** A drop is bounded by the nearest *ranked*
card on each side, so a drop into the middle of a run of unranked cards has no
bounds to split and lands at the boundary; and dragging a ranked card *below* an
unranked one cannot be expressed as a rank on that card alone, so it writes
nothing at all. Building an order downwards from the top of a column works
perfectly, one write per drop. Reaching into the unranked tail does not.

The alternative was to allocate ranks for the whole column on its first drop.
That is what every hosted tracker does, and it was rejected: it writes a rank
into files nobody dragged, bumps their `updated_at`, and puts a "reordered this
by hand" line in each of their timelines. In a product whose files are shared
with agents, a 400-write burst as the price of one drag is the wrong trade, and
`edit_ticket` is one file per call anyway. `rankForDrop` returning `undefined`
for a drop it cannot express is the honest version of that constraint.

### Dragging over a virtualized column

Native HTML5 drag events. No library was added; the whole feature is four
handlers, and a drag library would not have solved the hard part.

The hard part is that a drop cannot be read off the element under the pointer,
because most of the column is not in the document. `gapAt(offsets, position)` in
`boardGeometry.ts` turns the pointer's offset into the sizer into a gap index
over the same offsets the window is cut from, so a gap 3,000 cards below the
viewport is as answerable as the one under the pointer. Reaching it is the other
half: hanging the drag within 44px of either edge scrolls the column on an
animation frame for as long as the pointer stays there.

Memoization survived intact, deliberately. `dragstart` and `dragend` both bubble,
so they are handled on the grid and on the stack rather than on the card — a
per-card callback would change identity on every scroll and un-memoize the whole
column. A card's only new props are two booleans.

Cross-column drops are refused: moving between columns is a status change, and
`S` owns that.

### Where the preference lives

`localStorage`, under `longclaw.boardOrdering`, as a project-id → mode map,
hydrated and written back in `App.tsx` exactly as `appearance` is
(`App.tsx:54`). In the packaged app that is a file inside the WebKit store in the
OS app-support container, which is what `data-requirements.md:19` asks for.

ADR 0009 gives Rust filesystem authority and `registry.rs` is the app-state
store, so extending it was the other candidate. It was not taken: the appearance
preference set the precedent, a view preference has no business in the store that
holds project paths, and V0-31 is open on registry recovery — adding a field
there means adding to the schema whose corruption strands every known project.
A value this build does not recognise is dropped on read rather than trusted.

### The keyboard

**Reordering is pointer-only, and that is the specification rather than a gap.**
`keyboard-focus-map.md:158-161`, under *Not bound in v0 (deliberate)*: "No
drag-and-drop keyboard equivalent — reordering within a column is post-v0
(LC-136 canceled); status moves *are* the keyboard path across columns (`S`)."
So no binding was invented, and `Board.test.tsx`'s claim that a modified arrow
belongs to the window is untouched.

The *mode* is better off than the map assumed. `:107-110` names the palette as
its keyboard path, and the palette is Wave 2 — but the control shipped as an
ordinary focusable trigger in the content header, so Tab reaches it and the menu
already takes arrows and Enter. Nothing about ordering is unreachable today.

If reordering by keyboard is ever reconsidered, it belongs with **V0-23**
(keyboard completeness, Step 12), and V0-23 should read this paragraph first:
adding it would contradict a deliberate line in the approved map, not fill a hole
in it.

### What was confirmed red first

- `rank.test.ts`, all ten claims, against a module that did not exist; then three
  of the `rankForDrop` claims re-confirmed by making the allocator ignore its
  upper bound.
- `ordering.test.ts`, the five Manual-mode claims, against a module with no
  `byRank`.
- `boardGeometry.test.ts`, the four `gapAt` claims.
- `Board.test.tsx`, six of the nine drag claims. The other three — Priority
  writing no rank, a no-move drop writing nothing, and the list having no drag
  handle — are vacuous against a board with no drag at all, so each was
  re-confirmed by mutation instead: removing the `ordering !== "manual"` guard
  from `onDragStart` fails the Priority claim, and forcing `comparatorFor`
  to `"priority"` in `IssueList` fails the list's ordering claim.
- `App.test.tsx`, all seven claims, against an app with no ordering control.

### Two things worth a look

- **`TicketEdit.rank`'s doc comment was wrong on both sides of the wire.** It
  said "leaving Manual mode sends `null`", which is exactly what this item's
  must-pass forbids. Corrected in `src/types.ts` and `core/ticket.rs`: `null` has
  one caller, undoing the drop that gave a card its first rank.
- **jsdom under vitest exposes no `localStorage`,** so the appearance preference
  has never actually been exercised by a test — the app treats a missing store as
  "this does not survive the session" and passes. The persistence claim here
  installs a small in-memory store to have something to persist into. Worth
  knowing before anyone reads the appearance tests as coverage.
- **`fireEvent`'s event init does not reach a drag event in jsdom,** which has no
  `DragEvent` constructor, so `clientY` silently arrives as `undefined` and every
  drop resolves to gap 1. Two of the first tests passed on that coincidence. The
  helper in `Board.test.tsx` builds the event with `createEvent` and puts the
  coordinate on it directly; do the same for any new pointer-position test.

### Perf

`npm run perf:board` and `npm run perf:list`, WebKit, 5,000 tickets, p95 ms for
keyboard / scroll / external write, against a ≤50 ms budget:

| surface | order    | p95 keyboard | p95 scroll | p95 write |
| ------- | -------- | ------------ | ---------- | --------- |
| board   | Priority | 16           | 17         | 16        |
| board   | Manual   | 16           | 18         | 16        |
| list    | Priority | 16           | 18         | 15        |
| list    | Manual   | 15           | 18         | 15        |

Every median is within 4 ms of the 600-ticket floor. The harness gained
`--order=manual`, which clicks the real control before measuring — Manual is the
heavier comparator, because the fixture writes no ranks and every comparison
falls through to priority. Run it from `apps/desktop`; at the repository root the
flag goes to npm.

## Amendment 2026-08-01 — the negative half of the rank clause

V0-09's must-pass includes *`rank` is written only by manual reordering*. The
positive half was well covered: the App round trip asserts a drag's edit is
`{ rank }` and nothing else. The negative half — that nothing *but* a drag writes
one — was not tested anywhere, and the place it looked tested is worse than the
place it looked absent. `CreatedState` in the V0-16 contract test compares the
two creation paths' `rank` fields, but both are `None`, so the comparison would
have held just as well if both paths had started allocating one.

`nothing_but_a_manual_reordering_ever_writes_a_rank` in
`tests/file_format_contract.rs` is the side that cannot pass by accident. Neither
create surface, and none of the nine other mutations a `TicketEdit` can carry,
may put a `rank:` in the bytes, record a `rank` change in the history, or leave
one on the ticket re-read from those bytes. A manual reorder runs at the end as
the control, so none of it can be passing because this build cannot write a rank
at all.

Confirmed red twice: against a create writer that emits `rank: a0V`, and against
a priority edit that allocates one. The first is the case worth having — a rank a
human never dragged, written into a file an agent also reads, is board order
pretending to be ticket data, which is what ADR 0003 exists to prevent.
