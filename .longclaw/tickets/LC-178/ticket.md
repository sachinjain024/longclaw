---
format: longclaw.ticket/v1
id: f4aa3b26-678b-4c32-87c4-73e484cb7670
key: LC-178
title: Board filter — a filtered column scrolls far past its matches, and a non-matching card is stranded below them
status: done
priority: urgent
labels:
  - frontend
created_at: 2026-08-07T14:50:05.668Z
updated_at: 2026-08-11T11:30:05.882Z
---

**Finding.** With a filter applied, a board column keeps scrolling long after
its last matching card, and a card the query does not match is stranded in the
empty space below.

Filtering the board to `Full Create` leaves Todo with a header that reads **4**
and four cards — `LC-116`, `LC-117`, `LC-118`, `LC-119` — packed correctly at
the top. Scrolling that column then falls through several viewports of nothing
before a fifth card appears alone near the bottom: `LC-170`, *Folder picker: a
folder that already h…*.

A four-card column should not scroll at all.

## What the recording shows

| Time | State |
| ---- | ----- |
| 0:00 | Query `Full Create`. Todo reads 4. The column shows one card, `LC-170`, sitting mid-column with nothing above it. |
| 0:05 | Filter cleared. The unfiltered board is correct: Backlog 31, Todo 25, In Review 6, Done 112, Canceled 1, every column packed from the top. |
| 0:10 | Retyping. At `Full` Todo reads 5 and Done 6, all packed at the top — correct. |
| 0:11 | At `Full Create` Todo reads 4 and shows `LC-116`, `LC-117`, `LC-118`, `LC-119` from the top, no scrollbar — correct. |
| 0:13 | After scrolling Todo, the column is **empty**: no card in the viewport, and the scroll thumb sits about a third of the way down a track far longer than four cards. |
| 0:15 | Further down, `LC-170` alone. |
| 0:18 | Scrolled back near the top, `LC-117` (clipped), `LC-118`, `LC-119`. |
| 0:21 | Down again to `LC-170` alone. |

So five distinct cards render across the scroll range of a column whose header
says four, and the scroll range is many times the height of the cards in it.

`LC-170` is not a match. `filterTickets` compares the query against key, title,
and label slugs (`filtering.ts:59`), and `full create` is in none of `LC-170`,
*Folder picker: a folder that already h…*, or `frontend`. It is also not the
degraded row that rule deliberately exempts — it renders a title, a label chip,
and a `0/3` checklist fraction, so the build parsed it.

## Where to look

Two things have to be true at once for this to appear, and they may be one
cause or two:

- **The sizer outlives the filter.** `.board-sizer` is set to
  `offsets[offsets.length - 1]` (`Board.tsx:592`), and `offsets` is built from
  `props.tickets` — the filtered array. If that height still reflects the
  unfiltered column, the empty region and the long scrollbar follow directly.
- **An anchor renders outside the filtered set.** A column renders its window
  *plus its anchors* — the roving card and the open card, always drawn even when
  the window does not reach them (`Board.tsx:522`, `Board.tsx:415`). An anchor
  seat computed against the unfiltered column, or held across the filter change,
  would put exactly one extra card at a stale offset. `LC-170` wears a ring in
  the recording, which is what a selected or freshly-changed card wears.

Note the recording is of the user's running build; confirm against `main` before
concluding either way.

## Why urgent

The filter is the board's only way to narrow 175 tickets, and this makes its
result unreadable — the header says how many matched, the column does not show
them, and the empty space reads as "no more results" when there are more.

## Source

Screen recording, 2026-08-07 19:23, 21s, `~/Downloads/Screen Recording
2026-08-07 at 7.23.34 PM.mov` (the filename separates the time from `PM` with a
narrow no-break space, U+202F — a literal shell path will not match it).
Reported by the user the same day.

## Checklist

- [x] Reproduce on main: filter the board so a long column keeps a few cards, scroll it, and record the sizer height against the filtered card count. <!-- longclaw:item=ck_5483ecfd -->
- [x] A filtered column's scroll height is the height of its matching cards — no empty region below the last match. <!-- longclaw:item=ck_f7c17a54 -->
- [x] No card outside the filtered set renders, including the roving and open anchors when their ticket no longer matches. <!-- longclaw:item=ck_f1b6532e -->
- [x] The column header's count and the number of cards reachable by scrolling agree under a filter. <!-- longclaw:item=ck_b208b494 -->
- [x] Cover it in Board.test.tsx: filter a windowed column down and assert both the sizer height and the rendered keys. <!-- longclaw:item=ck_ac8705f1 -->
- [x] Run perf:board and quote the numbers — this touches column geometry. <!-- longclaw:item=ck_69366df9 -->

## Activity

<!-- longclaw:event
id: evt_f0fe22d3
kind: create
occurred_at: 2026-08-07T14:50:05.668Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_3148b306
kind: update
occurred_at: 2026-08-07T16:17:43.674Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: in_review
  - field: checklist.ck_5483ecfd.checked
    from: "false"
    to: "true"
  - field: checklist.ck_f7c17a54.checked
    from: "false"
    to: "true"
  - field: checklist.ck_f1b6532e.checked
    from: "false"
    to: "true"
  - field: checklist.ck_b208b494.checked
    from: "false"
    to: "true"
  - field: checklist.ck_ac8705f1.checked
    from: "false"
    to: "true"
  - field: checklist.ck_69366df9.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Both halves are one cause, and it is the anchors rather than the sizer.

A column draws its window plus its anchors, and the roving card and the open card are usually one card — clicking a card makes it both. With that card outside the window, `BoardColumn` pushed its index twice, so React was handed two children under one key. React's own warning calls that unsupported; what it did here was leave the second node mounted for good.

Reproduced on main: 400 cards in Todo, `LC-200` open and roving, then filtered to four. `.board-sizer` measures 392px — the four matching cards, exactly right — and the leftover `LC-200` renders inside it at `top: 19502px`. So the sizer never outlived the filter. The stranded card is what holds the scroll range open, because an absolutely positioned child overflows the box it is placed in, and it is also the card the query did not match.

The fix is that the column draws each anchor index once — the guard `IssueList.tsx` has carried since it was written. Covered in `Board.test.tsx` by three tests, all red on main.

perf:board over 5,000 tickets: ArrowDown p95 15ms, scroll p95 19ms, filter p95 28ms, external write → paint p95 15ms. Every p95 is inside the 50ms budget and every median within 4ms of the 600-ticket floor.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_a81d1ffd
kind: comment
occurred_at: 2026-08-07T16:26:37.558Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

The code review found the checklist only half-pinned, and the tests now close that.

Item 2 asks that a filtered column reserve the height of its matching cards and no more. The assertion for it was `.board-sizer`'s height, which is green on main too — the sizer was never the wrong part. So the test now reads the height the column reserves and checks that every card it drew sits inside it, which is what "no empty region below the last match" actually means and what a card at `top: 19502px` in a 392px box breaks.

Item 4 asks that the header's count and the cards reachable by scrolling agree. The assertion for it scrolled to one position, and `windowFor` clamps a scroll past the end back to the same window, so it re-read the same four cards rather than traversing anything. It now sweeps the scroll range the column used to have and unions what each position draws.

Four tests, all red against `origin/main`'s `Board.tsx` and green with the fix. `npm run verify` passes, 772 frontend tests. The review also raised a duplicated test helper: `columnKeys` existed twice already and is now one copy at module scope.

Not claimed: the reproduction is jsdom against main's code, not the running build the recording came from, and it uses `LC-200` rather than the recording's `LC-170`.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_77efd73e
kind: update
occurred_at: 2026-08-11T11:30:05.882Z
actor:
  type: human
  id: local
changes:
  - field: status
    from: in_review
    to: done
-->
### You updated this ticket
<!-- /longclaw:event -->
