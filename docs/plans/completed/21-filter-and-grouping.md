---
title: "Filter, sort, and grouping behaviour"
product: LongClaw
status: completed
backlog_id: V0-15
order: 21
owner_area: Frontend
release_blocking: true
depends_on: "16 (grouping seam), 20 (ordering seam), 17 (archived exclusion)"
---

# Filter, sort, and grouping behaviour

V0-15's title reads broad and its content is narrow. An audit of
`docs/design/prototype/` finds **no** label filter, **no** priority filter, **no**
filter chips, and **no** group-by control. Three things are specified, and this
plan builds exactly those:

1. **A filter field** in the content header, 190×28px (`screen-specs.md:47`),
   focused by `⌘F` which also selects the existing query
   (`keyboard-focus-map.md:31`). The query is session-only app state
   (`data-requirements.md:41`) and never reaches disk.
2. **The ordering control** — already shipped by V0-09. Nothing to build; this
   plan puts the filter beside it and pins the must-pass clause with a test.
3. **Grouping is fixed.** Board and list group by status only, the board keeps
   the whole scaffold (ADR 0002) and the list renders only statuses that hold
   tickets (`screen-specs.md:135-136`). `src/grouping.ts` already owns both.
   There is no group-by control in v0 and this plan does not invent one.

## Why this exists

"Without filtering, a real repository's board becomes unusable at exactly the
size where the product should start paying off." Both surfaces are windowed and
happily draw 5,000 rows; neither gives you a way to look at twelve of them.

## Must-pass

> Filter with no matches shows the designed state, not an empty board; sort and
> grouping are view state and never rewrite files.

## The decisions this plan makes

### Where filtering sits

**Before grouping, in `App.tsx`, as its own function** — not inside
`groupByStatus`.

`groupByStatus` already returns fewer tickets than it was given, because V0-11
put the archived exclusion there. That exclusion is a *statement about status*: an
archived ticket carries a date and not a status (ADR 0004), so it has no bucket to
sit in. A filter is not a statement about status; it is a statement about which
rows the human asked to see. Folding it in would make one function do three
unrelated things, and both surfaces would inherit a rule neither could see.

So `App.tsx` narrows the array once and hands the result to whichever surface is
up. Both surfaces are already projections of one array and hold no rows of their
own, so the windowing, the seats, and the roving focus all recompute from
`props.tickets` exactly as they do after an archive.

### The match rule, and where it runs

**Client-side, over the loaded rows.** Not `search_tickets`, for three reasons:

- `TicketIndex::search` truncates at `SEARCH_LIMIT = 100`
  (`src-tauri/src/core/index.rs:23`). A search surface that shows the best 100
  hits is right; a *filter* that silently drops the 101st match from the board is
  a lie about the project.
- The store already holds every row. Round-tripping IPC on every keystroke to
  get back a subset of what is already in memory buys nothing and costs the
  keystroke budget.
- The command returns a detached array. The board would then be showing rows
  from a second source that a `ticketChanged` event does not update.

The rule is the backend's rule minus the one field the row does not carry:
**lowercased, whitespace-collapsed substring over key, title, and label slugs.**
`TicketIndex::search` also matches the description, and a `TicketRow` has no
description — putting one on the row would add a bounded copy of every
description to every snapshot for a field no surface renders. That divergence is
stated here and in `filtering.ts`, and it is the seam V0-24 sits on: **the header
filter narrows what is in front of you; search finds a ticket anywhere, including
by its description, and that is the one that calls `search_tickets`.**

### Degraded rows

**Exempt from the filter, always drawn.** A file this build cannot parse has no
text to compare, so the app cannot honestly say the query does not match it —
hiding it would be an assertion the app is not entitled to make. So the Unreadable
column and the Unreadable group survive every query, and the no-match panel says
so when it is standing beside them.

This diverges from `TicketIndex::search`, which matches a degraded record on its
key alone. That is right for a search — you asked for a needle — and wrong for a
filter, which decides what the whole surface shows.

### The no-match state

`states.md:37-41` and `screen-specs.md:130-131`: a centered panel "No matches",
the echoed query, a secondary **Clear filter**, and `Esc`. Built beside
`EmptyBoard` in `App.tsx` and sharing its styling, with `role="status"` so a
filter that empties the screen says so out loud.

It triggers when a query is active and **the surface in front of you** has no
readable row to draw. That last clause matters: the board never draws an archived
ticket, so a query matching only archived tickets is "no matches" on the board
while the list has a row for it. In that state the board drops its fixed scaffold
— six empty columns beside a "No matches" panel *is* the empty board the must-pass
forbids.

### `Esc` precedence

`keyboard-focus-map.md:19-21` puts the filter on the **last** rung: menu →
overlay/modal → description edit → ticket panel → active filter → nothing. So the
filter's handler is a document listener that stands down when a rung above it is
occupied:

- **Menu** already calls `stopPropagation` on its own `Escape`
  (`Menu.tsx:121-126`), so the event never reaches the document at all.
- **Description editor** does the same (`DescriptionEditor.tsx:120-126`), and it
  only exists inside the panel.
- **Ticket panel** and the **create modal** are checked by state: the handler
  returns early while `selectedKey` is set or `ticketFormOpen` is true.
- `event.defaultPrevented` is honoured as a belt-and-braces rung.

### `⌘F`

Focuses the field and selects the query. `preventDefault` takes the chord from
the webview's own find — which is the point: WebKit's find bar would search the
*windowed* DOM, so it would tell the user there is one match in a column of four
hundred. The chord is skipped entirely when no filter field is mounted, so a
webview with no project open keeps its default.

## Done when

- A query narrows both surfaces identically, and the no-match panel appears on
  both with the query echoed and a working Clear filter.
- `Esc` clears the filter, and does not clear it while a menu, the panel, or the
  create modal is open.
- The query is never written to `localStorage` and never crosses IPC.
- A test proves that typing a query, switching order, and switching view call no
  `editTicket`, `createTicket`, or project write.
- `npm run perf:board` / `perf:list` re-traced, with a filtered trace added.
- `npm --prefix apps/desktop run check` green.

## Watch out for

- **Focus on a row the filter just removed.** Both surfaces recompute `rovingKey`
  from `seats`, so a key that is gone falls back to the first row — that path
  already exists for archive, and the filter must not need a second one.
- **Do not add a mutation.** This item raises none.
- **Do not build V0-24's search surface** and do not add a filter axis the
  prototype does not specify.

## Outcome

Shipped the three controls the design specifies and no fourth. **No additional
filter axis was designed** — the prototype has no label filter, no priority
filter, no filter chips and no group-by control — so the narrowness of this item
is the specification's, not a scope cut made here.

**What is new.** `apps/desktop/src/filtering.ts` (`filterTickets`, `isFiltering`),
the 190×28px field and the `NoMatches` panel in `src/App.tsx`, a `scaffold` prop
on `Board`, and `.filter-field` / `.no-matches` in `styles.css`. The ordering
control was not touched: V0-09 built it, and this only put the filter beside it.
Grouping is unchanged — `src/grouping.ts` still owns it, and no group-by control
exists.

**Filtering sits before grouping**, in `App.tsx`, and not inside `groupByStatus`.
The archived exclusion there is a statement about status; a filter is a statement
about which rows were asked for. `App.tsx` narrows once and both surfaces receive
the result, so the board and the list cannot disagree about what a query means,
and every downstream thing — the seats, the windowing, the roving tab stop —
recomputes from `props.tickets` exactly as it already does after an archive.

**The rule is client-side**, over key, title, and label slugs, lowercased and
whitespace-collapsed. That is `TicketIndex::search`'s rule minus the description,
which a `TicketRow` does not carry. It does not go through `search_tickets`, and
speed is the *second* reason: `SEARCH_LIMIT = 100` means the command would drop
the 101st match without saying so, which is right for a search and a lie for a
filter. Per-row search text is cached in a `WeakMap` keyed by the row object, so a
keystroke over 5,000 tickets builds no strings — the numbers below show the filter
costing the same at 5,000 as at 600.

**Unreadable files are exempt from the filter and always drawn.** A file this
build cannot parse has no text to compare, so "the query does not match it" is a
claim the app is not entitled to make. This is a deliberate divergence from Rust,
which matches a degraded record on its key alone. The no-match panel says so when
it is standing beside one.

**`Esc` is the last rung**, as `keyboard-focus-map.md:19-21` asks. `Menu` and
`DescriptionEditor` already `stopPropagation`, so the event never reaches the
filter's document listener; the ticket panel and the create modal are checked by
state, because the panel closes on `Esc` without preventing anything. Three tests
pin each of the three.

**The perf harness found a real defect the tests did not.** Both surfaces
re-focus their roving row in a layout effect whose dependencies include
`rovingKey` — and a query changes `rovingKey`, so typing in the header yanked
focus onto a card mid-word. WebKit then read the next backspace as "navigate
back" and destroyed the page, which is how it surfaced. Both effects now answer a
*new focus request* rather than any change to the key it points at
(`Board.tsx`, `IssueList.tsx`), which is what their own comments always claimed.
Two tests cover it, one per surface.

**A filtered trace is now part of the harness**, on by default in
`--only`: it types the query in a character at a time and deletes it again, with
the fixture arranged so the leading characters match all 5,000 rows.

**Numbers** (WebKit, 5,000 tickets, p50/p95 ms, ≤50 ms p95 budget, floor 600):

| surface / order | keyboard | scroll | filter | write |
|---|---|---|---|---|
| board · priority | 13/16 | 17/19 | 14/30 | 14/15 |
| board · manual | 13/15 | 17/19 | 14/31 | 14/15 |
| list · priority | 13/15 | 17/19 | 14/19 | 14/15 |
| list · manual | 13/16 | 17/18 | 14/18 | 15/16 |

All within budget. The filter's p95 at 5,000 is within a millisecond of its own
600-ticket floor on every run, so the cost is the keystroke round trip and not the
project.

**Tests confirmed red first:** all sixteen behavioural claims in `App.test.tsx`
§ "the header filter (V0-15)" — fourteen against the pre-filter app, and the two
focus-steal claims against the shipped filter, which is the pair that mattered.
`filtering.test.ts`'s eight unit claims are new-module coverage and are not
claimed as red-first.

`npm --prefix apps/desktop run check`: green. `npm run verify` was not run, per
the brief.

**Three things worth a look.**

1. **The header filter and search will mean slightly different things by
   design.** Typing in the header cannot match a description, because the row
   does not carry one. V0-24 should build search on `search_tickets`, where
   description matching already exists and the 100-result cap is correct, and
   should say on screen that it searches more than the filter does. Putting a
   bounded description on `TicketRow` would unify them at the cost of a copy of
   every description in every snapshot; that trade was not taken here.
2. **The board drops its scaffold in the no-match state.** ADR 0002's fixed
   column set is the board's point, and this is the one case where it stands
   down — six empty columns beside a "No matches" panel is exactly the empty
   board the designed state replaces. It is one prop with one caller.
3. **The query clears when the project changes.** Nothing specifies this. A
   query about one project is meaningless in the next, but it is a decision made
   here rather than read off a document.
