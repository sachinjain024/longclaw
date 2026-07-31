---
title: "Archive and unarchive"
product: LongClaw
status: completed
backlog_id: V0-11
order: 17
owner_area: Domain
release_blocking: false
depends_on: "13 (the mutation seam), 16 (the list, and the archived group in it)"
blocks: "V0-24, which owns the `· archived` tag on a search result"
---

# Archive and unarchive

Archiving is how a long-lived local project stays tidy without a destructive
operation. ADR 0004 puts it in v0 and says exactly what it is: `archived_at` in
the frontmatter, and the ticket directory never moves and never goes away.

## Why this exists

Half of it was already built and the halves did not meet.

- **Rust is done.** `TicketEdit.archived` sets or removes `archived_at`, records
  the field change, and appends the activity event. It is tested, and it is a
  frontmatter flip: the directory is not touched.
- **The list's archived group is done.** V0-14 shipped it collapsed behind a
  focusable header (`IssueList.tsx`), rendered from `IndexedRow.archivedAt`.
- **Nothing sets the field**, and **the board renders archived tickets anyway** —
  so today the group is unreachable and the one rule ADR 0004 states is broken.

`docs/backlog/v0-backlog.md:115` is the row. Its must-pass: archiving sets
`archived_at` and never moves or deletes the directory; archived tickets leave
the board, stay findable, and unarchive cleanly.

## Working rules

- Topic branch off updated `main`. Never commit to `main`. (`AGENTS.md`)
- One write path. `mutate()` in `src/mutations.ts` (plan 13) — no second toast
  stack, no second undo, no `editTicket` call outside it.
- Both surfaces are projections of one store array. Do not fork the data.
- Every colour comes from a `--lc-*` token.
- The design is settled: `screen-specs.md:116` (board), `:164-168` (panel),
  `keyboard-focus-map.md:107-110` (no single-key binding — the palette is the
  keyboard path, and the palette is Wave 2). Do not invent a shortcut.

## The two problems worth thinking about

**Where the board's exclusion goes.** `grouping.ts` is the bucketing both
surfaces call, and the list needs to keep seeing archived tickets while the
board stops.

**The mutation outlives the panel.** `screen-specs.md:166` says archiving closes
the panel. The panel's `save()` puts the optimistic state, the conflict banner,
and the revert in component state — all of which stop existing at the moment the
archive succeeds or fails.

## Do this

1. Take archived tickets out of `groupByStatus`, not out of `Board.tsx`.
2. Raise archive and unarchive in `App.tsx`, the way `changePriority` already is.
   The panel gets a ghost button and an `archived` prop, and writes nothing.
3. Guard the no-op: `TicketDocument::apply` refuses an edit that changes nothing.
4. Pin the Rust half of "stay findable" with a test over `engine.search`.
5. Confirm Canceled is not conflated with archived, on both surfaces.

## Done when

- The board draws no archived card and counts none; the list still does both.
- Archiving from the panel closes it, writes `{ archived: true }`, raises the
  undo toast, and its Undo writes `{ archived: false }` against the hash the
  first write returned.
- A failed archive puts the card back and says so.
- Focus does not land on `<body>` when the panel closes.
- Search returns archived tickets, pinned by a Rust test.
- `npm --prefix apps/desktop run check` passes.

## Outcome

Completed 2026-07-31 on branch `wave-1-ticket-domain-and-surfaces`. No Rust
behaviour changed: the backend was complete, as expected. Two Rust tests were
added to pin it.

### Where the board's exclusion landed

In **`groupByStatus` (`src/grouping.ts`)**, not in `Board.tsx`.

Archived is a date and not a status (ADR 0004), so an archived ticket has no
status bucket to sit in. Stating it there rather than in the board makes it a
fact about bucketing that every caller inherits — the board today, V0-15's
grouping tomorrow — instead of a rule the board happens to apply and a third
surface could forget. The list already split its archived rows out with
`isArchived` before calling in, so it lost nothing and in fact lost a line: it
now hands the whole array over and gets the live tickets back.

The cost is that `groupByStatus` returns fewer tickets than it was given, which
is worth knowing about. The escape hatch is that `isArchived` is public and the
list is the demonstration of how to use it. **V0-15 inherits this**: if filtering
ever wants archived tickets inline, that is a new argument here, not a filter in
a surface.

### How the mutation outlives the panel

It is raised in **`App.tsx`, `setArchived(ticket, archived)`** — the same level
`changePriority` is raised at, and for a stronger reason. The panel's
`save(edit, options)` was the tempting seam, and it cannot survive its own
unmount:

- its `apply` returns a revert that calls `setPendingStatus`-style component
  state, which is a no-op once the panel is gone, so a failed write would revert
  nothing visible;
- its `handles` puts a conflict into component state, so a conflict raised by an
  archive would be swallowed entirely — no banner, and no danger toast either,
  because `handles` returning true suppresses one.

So the panel writes nothing here. It takes `archived: boolean` and
`onArchive(next)`. Two consequences worth naming:

- **The panel's archived state comes from the store row**, not from the file it
  last read. That is deliberate: it is the same row the board and list read, so
  the optimistic flip and a failed write's revert reach all three at once, and
  unarchiving flips the button to "Archive" with no re-read of the file.
- **Archiving closes the panel; unarchiving does not.** `screen-specs.md:166`
  makes the closing part of archiving, and an unarchived ticket is back on the
  board with its panel still open, which is what "unarchive cleanly" looks like.

Focus return: the card the panel was opened from has just left the board, so
`focusSurface()` moves focus to the surface's single tab stop — the card or row
the arrows would move from — and falls back to the create button when nothing is
left to stand on. `closeTicket(key)`'s existing card-return is untouched.

The conflict path was left exactly as it was. The panel's own `save()` is
unchanged, and the App-level archive carries no `handles`, so a conflict there
reverts and raises the danger toast with the conflict's own message — the same
behaviour `changePriority` has had since V0-08. **This inherits that path's one
wart**: Retry re-sends the hash captured when the mutation was built, so retrying
a conflict fails the same way. It is not new and it is not archive-specific;
fixing it means teaching `mutate` to re-read the hash, which is its own item.

### Search, and the `· archived` tag

`core::index.rs`'s `search` filters on the search text alone and has never looked
at `archived_at`, so archived tickets were already findable. That is now pinned
by `an_archived_ticket_is_still_found_by_search`, which archives `LC-2` and finds
it again by title, by key, and in the empty-query listing, and asserts the row it
gets back still carries the date the tag would render from.

**The `· archived` tag itself is not done, and this item does not claim it.**
There is no search UI in the app: `api.ts`'s `searchTickets` wrapper has no
caller, and the search surface is V0-24 (the palette is V0-20/V0-21). The
findability surface that exists today is the list's archived group, and it works.
The tag lands with V0-24.

### Canceled

Not conflated, and now pinned in three places. `status: canceled` is a workflow
outcome that stays visible (`file_format.md:345-347`); `archived_at` is
orthogonal. `Board.test.tsx` asserts a canceled ticket keeps its card and an
archived one does not, whatever its status; `App.test.tsx` archives a canceled
ticket and finds it in the list's archived group still wearing
`Status: Canceled`, with the Canceled group gone from the status list; the Rust
test asserts the status is untouched by an archive and by the unarchive after it.

### Tests, and which were red first

Frontend, all confirmed failing before the change:

- `Board.test.tsx` § "archived tickets never reach the board" — no card and no
  count; the arrows skip it; a canceled ticket keeps its card. **3 red.**
- `TicketPanel.test.tsx` § "the archive button in the header" — the button names
  the action it would take, the chip appears when archived, and the panel itself
  writes nothing. **2 red** (the third, that a degraded file offers no button,
  passed trivially — there was no button at all — and is kept as a guard).
- `App.test.tsx` § "archive and unarchive (V0-11)" — the must-pass round trip,
  the failed write, the focus return, unarchive from the archived group, and the
  canceled case. **5 red.**
- `App.test.tsx` § "the list and the board agree" — its archived test now also
  asserts the board does *not* show the ticket, which is the disagreement the
  two surfaces are allowed.

Rust, pins rather than red-first, each confirmed to fail under an injected
regression:

- `archiving_sets_archived_at_and_leaves_the_directory_where_it_is` — the
  directory listing is byte-for-byte the same set before and after, `ticket.md`
  is where it was, the status and title are untouched, one field change per flip,
  and unarchiving removes the key and leaves the listing alone again. Confirmed
  red with the `archived` branch of `apply` disabled.
- `an_archived_ticket_is_still_found_by_search` — confirmed red with an
  `archived_at`-is-none filter injected into `TicketIndex::search`.

### Validation

- `npm --prefix apps/desktop run test:frontend`: 241 passed, 11 of them new.
- `npm --prefix apps/desktop run test:rust`: green, including the two new tests.
- `npm --prefix apps/desktop run check`: green (tokens, prettier, eslint, clippy,
  tsc, tests, vite build).
- `npm run verify` was not run, per the instructions for this item.

### One thing worth a look

The panel header is now flex rather than a three-column grid, because the
`archived` chip is conditional and a grid with a disappearing child re-columns
everything after it. The actions are held right with `margin-left: auto`, which
also fixes a latent case: when `WriteIndicator` renders nothing, the close button
used to be stretched by the `1fr` column it fell into.
