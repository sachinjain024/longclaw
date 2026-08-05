---
format: longclaw.ticket/v1
id: b580cb1c-4776-4acd-af9b-241bb527395c
key: LC-15
title: Sort, filter, and grouping behaviour from the prototype
status: done
priority: p1
labels:
  - frontend
  - v0-backlog
created_at: 2026-08-05T14:22:58Z
updated_at: 2026-08-05T14:22:59Z
---

~~Sort, filter, and grouping behaviour from the prototype~~ **Done 2026-08-01** — **the item shipped the three controls the prototype specifies, and no filter axis beyond them was ever designed**: `docs/design/prototype/` has no label filter, no priority filter, no filter chips and no group-by control, so this row is not a narrowing. The three are the 190×28px filter field in the content header (`screen-specs.md:47`), the ordering control V0-09 already built and this only sat the filter beside, and grouping, which stays fixed to status in `src/grouping.ts` (ADR 0002). **Filtering lands before grouping, not inside it** (`src/filtering.ts`, called once in `App.tsx`): the archived exclusion V0-11 put in `groupByStatus` is a statement about status, and a filter is a statement about which rows were asked for — one narrowing, two projections, so the board and the list cannot disagree about what a query means. **The rule is client-side** over key, title and label slugs, lowercased and whitespace-collapsed: `TicketIndex::search`'s rule minus the description, which a `TicketRow` does not carry. It deliberately does not call `search_tickets`, and speed is the second reason — `SEARCH_LIMIT = 100` would drop the 101st match without saying so, which is right for a search and a lie for a filter. Per-row text is cached in a `WeakMap` keyed by the row, so a keystroke over 5,000 tickets builds no strings. **Unreadable files are exempt from the filter and always drawn**, diverging from Rust (which matches a degraded record on its key): a file this build cannot parse has no text to compare, so "the query does not match it" is a claim the app is not entitled to make. **`Esc` clears the filter last**, after menu → modal → description edit → ticket panel (`keyboard-focus-map.md:19-21`); the first two stop the event themselves and the last two are checked by state. `⌘F` focuses and selects, taking the chord from WebKit's own find, which would otherwise search only the windowed DOM. [Plan 21](../../../docs/plans/completed/21-filter-and-grouping.md)

## Must-pass

Passed both clauses. **The designed state, not an empty board:** a query matching nothing renders the centered `No matches` panel with the query echoed, a Clear filter button and `Esc`, on the board and on the list — and the board **drops its fixed scaffold** in that one case, because six empty columns beside the panel is the empty board the state exists to replace. **Sort, grouping and filtering never rewrite files:** typing a query, switching Priority↔Manual, and switching Board↔List in one test calls no `edit_ticket`, no `create_ticket` and no project write, and the query never reaches `localStorage` — it is session-only app state (`data-requirements.md:41`). Sixteen behavioural claims confirmed failing first in `App.test.tsx` § "the header filter (V0-15)", plus eight unit claims in `filtering.test.ts` (new-module coverage, not claimed red-first). **Perf** (`perf:board`/`perf:list`, WebKit, 5,000 tickets, p50/p95 against ≤50 ms p95): board 13/16 keyboard, 17/19 scroll, **14/30 filter**, 14/15 write in Priority and 13/15, 17/19, 14/31, 14/15 in Manual; list 13/15, 17/19, **14/19 filter**, 14/15 and 13/16, 17/18, 14/18, 15/16. The harness gained a **filter trace**, on by default, which types the query in a character at a time and deletes it again over a fixture whose leading characters match all 5,000 rows. The filter's p95 sits within a millisecond of its own 600-ticket floor, so the cost is the keystroke and not the project. **The harness found a defect no test did:** both surfaces re-focus their roving row in a layout effect that depends on `rovingKey`, and a query changes it — so typing in the header pulled focus onto a card mid-word, and WebKit read the next backspace as "navigate back". Both effects now answer a new focus request rather than any change to the key, which is what their comments always claimed; two tests cover it. **Three things worth a look:** the header filter cannot match a description and **search will**, so V0-24 should build on `search_tickets` and say on screen that it looks in more places — unifying them means putting a bounded description on every row in every snapshot, and that trade was not taken; the board drops ADR 0002's scaffold in the no-match state, which is one prop with one caller; and the query clears on a project switch, which nothing specifies

## Source

`docs/backlog/v0-backlog.md` — **V0-15**, Wave 1, step 11, owner Frontend.

## Checklist

- [x] Passed both clauses. The designed state, not an empty board: a query matching nothing renders the centered No matches panel with the query echoed, a Clear filter button and Esc, on the board and on the list — and the board drops its fixed scaffold in that one case, because six empty columns beside… <!-- longclaw:item=ck_fa546306 -->

## Activity

<!-- longclaw:event
id: evt_687536ab
kind: create
occurred_at: 2026-08-05T14:22:58Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_6df60432
kind: update
occurred_at: 2026-08-05T14:22:59Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_fa546306.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Imported from `docs/backlog/v0-backlog.md`. The must-pass verification for V0-15 is recorded there as passed.
<!-- /longclaw:event -->
