---
title: "Priority end to end"
product: LongClaw
status: completed
backlog_id: V0-08
order: 14
owner_area: Domain
release_blocking: true
depends_on: "13 (the mutation seam)"
---

# Priority end to end

Priority exists on the wire and on disk, and nowhere else. `types.ts:76` has the
enum, `TicketEdit.priority` is already carried, and Rust already applies it
(`core/ticket.rs:595-603`). The frontend renders the raw slug as text inside a
card's meta line (`boardCard.ts:28`), has no priority row in the panel, has no
`P` menu, and orders no column by anything but the store's global key sort
(`Board.tsx:61-95`).

So a board's columns are arbitrary, which is the thing ADR 0003 exists to stop.

## Why this exists

[V0-08](../../backlog/v0-backlog.md) — *priority is the field that makes a board a
plan rather than a list.* Must-pass: **priority round-trips to disk, orders
columns per ADR 0003, and an agent-written priority is read without rewriting the
field.**

## The settled design

- **Order** — `docs/adr/0003-priority-default-ordering-manual-option.md:3`:
  Urgent → P1 → P2 → P3 → P4 → None within a column, and
  `screen-specs.md:111-112` adds *stable within a level*.
- **Glyphs** — `components.md:134-144`. Urgent is a 12×12 rx3 square with an
  exclamation; P1–P4 are bordered mono chips with no fill and never the theme
  accent; None is a 9×1.6 dash. D4 retired the old bar glyphs.
- **Menu** — `screen-specs.md:239-247`: one anchored popover shared by status,
  priority, ordering and labels. 30px rows, the current value carries a trailing
  human-accent check, arrows cycle, `Enter` picks, `Esc` returns focus to the
  trigger. `keyboard-focus-map.md:43`: `P` anchors it to the focused card.
- **Panel tab order** — `keyboard-focus-map.md:61`: status → priority → labels.

## Do this

1. **`src/ordering.ts`** — the priority comparator on its own, so V0-09 can sit a
   Manual comparator beside it rather than unpicking a sort inlined in
   `layOutColumns`. Do not build Manual mode, `rank`, or drag-and-drop.
2. **`src/Menu.tsx`** — the popover as a standalone primitive: rows, single or
   multi select, an anchor element, arrow/`j`/`k` cycling, `Enter`, `Esc`, focus
   return. Three later items reuse it (V0-09, V0-10, and status). Prove it against
   two callers now by moving the panel's status `<select>`
   (`TicketPanel.tsx:369-382`) onto it.
3. **`src/PriorityGlyph.tsx`** — the three glyph shapes, each with an accessible
   name, colours from `--lc-priority-*` only.
4. **The card** — `presentCard` stops rendering the slug as text and hands the
   card the priority to draw. Keep it one call per card render: `Board.test.tsx`
   asserts that.
5. **The panel** — a priority row in the meta grid, saving through
   `save(edit, SaveFeedback)`.
6. **The board** — `P` on a focused card opens the menu; the mutation goes out
   through `mutate()` from `App`, which is where the project id lives. Inert on a
   degraded card (`keyboard-focus-map.md:48`).
7. **Rust** — a fixture whose `priority:` line is written the way an agent writes
   it and not the way the app does, and a contract test proving the line survives
   every unrelated mutation byte for byte. Model it on
   `attachment_records_survive_every_mutation_byte_identically`
   (`tests/file_format_contract.rs:598`).

## Done when

- A column orders Urgent → P1 → P2 → P3 → P4 → None and is stable within a level.
- The card and the panel show the glyph, and the glyph has an accessible name.
- `P` on a focused card opens the menu, `Enter` writes, the toast offers Undo.
- The Rust contract test pins the untouched `priority:` line.
- `npm --prefix apps/desktop run check` is green.

## Watch out for

- **Card height is pinned** (`--lc-size-board-card`, asserted in
  `boardGeometry.test.ts:152-155`). A glyph that changes it means changing the
  token and the geometry together. Prefer one that fits.
- **One write path.** `mutate()` in `src/mutations.ts` and the panel's `save()`
  over it. Do not add a second, and do not add a second toast stack.
- **Do not build the rest of the keyboard map.** V0-22 owns single-key actions;
  this item owns `P`.

## Outcome

Shipped as planned, in five new pieces and four changed ones.

**`src/ordering.ts`** is the ordering seam V0-09 inherits. `TicketOrdering` is
`(left, right) => number`; `byPriority` is the ADR 0003 comparator; `orderColumn`
copies and sorts, defaulting to `byPriority`. `layOutColumns` calls it once per
column (`Board.tsx:78`), so the seats the arrows read are the order the column
draws — `screen-specs.md:115` is satisfied by construction rather than by a second
sort. V0-09 adds `byRank` beside `byPriority` and threads the mode through
`orderColumn`'s second argument; nothing else has to move. Stability is
`Array.prototype.sort`'s, which has been guaranteed since ES2019, and there is a
test that would catch its loss.

**`src/Menu.tsx`** is the popover, and it is deliberately ignorant of the field it
edits: `{ label, options, selected, multiple?, footnote?, anchor, onPick, onClose }`.
Single-select picks and closes, multi-select ticks and stays open, `↑↓`/`j`/`k`
wrap, `Enter` and `Space` pick, `Esc` closes, a pointer anywhere else closes, and
focus returns to the anchor on unmount. `MenuButton` in the same file is the thin
trigger the panel's meta rows use. Two callers prove it today: the priority menu
and the status row, which is no longer a `<select>`.

**`src/PriorityGlyph.tsx`** draws the three shapes with the `--lc-priority-*`
tokens, which already existed. Every glyph carries `Priority: <label>` unless the
caller passes `decorative`, so the level is never shape and colour alone.

Three decisions and one gap worth naming:

- **The board does not write.** `P` raises `onChangePriority(ticket, next)` and
  `App.changePriority` runs the `mutate()`. The board holds no project id and
  should not learn one.
- **A no-op pick writes nothing**, in both surfaces. This is not politeness:
  `TicketDocument::apply` refuses an edit that changes nothing, so a menu that
  reported every pick would surface that refusal as an error. The Rust test
  asserts the refusal.
- **`j`/`k` cycle the menu** because this item's brief asked for it.
  `keyboard-focus-map.md:122` lists only `↑↓` for menus, so either the map or this
  is wrong. The board uses `j`/`k`, nothing in a menu takes typed text, and the
  cost of being wrong is a key that also works — but the map should be corrected
  one way or the other.
- **Status menu rows carry no glyph.** `screen-specs.md:240` wants each row to
  show the option's own glyph, and status's glyph is the coloured dot. The app has
  no status dot anywhere yet — not on the column headers either — so building one
  belongs with whichever item builds the headers, not here.

The Rust clause went where the plan said. `valid-agent-written-priority` writes
`priority: "p1"` — legal YAML the app never emits — and
`an_agent_written_priority_is_never_rewritten_by_an_unrelated_edit` runs nine
unrelated mutations plus a no-op priority edit against it, comparing the raw line
each time, then proves a real change *does* rewrite it so the test cannot pass by
the writer being broken.

### Confirmed red first

- `ordering.test.ts`, all four — no module.
- `Board.test.tsx`: the column order, the named glyph, `P` opening the menu, and
  focus surviving the close.
- `App.test.tsx`: the board's write and undo, and the optimistic-then-reverted
  glyph.
- `TicketPanel.test.tsx`: all four priority tests, re-confirmed by stashing
  `TicketPanel.tsx` alone.
- The Rust test, against an injected unconditional `set_scalar("priority", …)` in
  `TicketDocument::apply`: nine of the ten cases failed on the changed line.

### Validation

`npm --prefix apps/desktop run check`: green — tokens, prettier, eslint, clippy,
tsc, 164 frontend tests across 15 files, the Rust suite including the new contract
test, and `vite build`. `npm run verify` was not run, as instructed.

### What this leaves for the next item

Card height did not move: `.ticket-row` pins it, and the 13px card chip sits
inside the existing meta line, so `boardGeometry.test.ts:152-155` never came into
play. The panel's meta grid is now status → priority in document order, which is
where V0-10 hangs labels.
