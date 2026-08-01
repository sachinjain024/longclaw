---
title: "Palette sub-modes"
product: LongClaw
status: completed
backlog_id: V0-21
order: 26
owner_area: Frontend
release_blocking: false
written: 2026-08-01
applies_to: "wave-1-ticket-domain-and-surfaces @ eb54bac"
depends_on: "25 (the palette shell, the disabled-row mechanism, the Esc rung)"
blocks: "27 (search is the sixth sub-mode and builds on this shell)"
---

# Palette sub-modes

A flat command list cannot express "change status to…". Six commands need a second
screen, and `Esc` has to step *back* to root rather than out of the palette
entirely — which is a rung inside a rung, since the palette already took one from
the escape ladder.

Five of the six sub-modes are yours. The sixth, **search**, is plan 27: build the
sub-mode machinery so search drops into it, and leave the search rows to that plan.

## Why this exists

> "A flat command list cannot express 'change status to…' without a second
> surface, and `Esc` stepping back rather than out is the behaviour the spec
> defines." — `docs/backlog/v0-backlog.md:136`

## Must-pass

> Sub-modes show the crumb, `Esc` steps back to root, and a command with no target
> is disabled with an inline explanation rather than failing.

## The approved design

**`docs/design/prototype/screen-specs.md:231-237`, the whole sub-mode spec:**

> - **Sub-modes** (status, priority, ordering, theme, project, search) replace the
>   list and show a crumb chip in the input row; `Esc` steps back to root, not out.
>   Status/priority/archive target the open or focused ticket and are disabled with
>   an inline explanation when there is none. Theme rows carry miniature pair
>   swatches. Search rows: status dot + mono key + title (archived tickets tagged
>   `· archived`), Enter opens the panel.

Supporting lines:

- **The crumb** is "a crumb chip in the input row" (`:232`). Chip anatomy is
  `components.md:85` — mono 10px/500 on `wash`, radius 3px, 1px `line` border. The
  palette's own `esc` chip (`screen-specs.md:221`) is the same family.
- **`Esc` steps back**, restated at `keyboard-focus-map.md:103` ("Sub-mode → back
  to root; root → close") and in the global ladder at `:19-21`, which parenthesises
  it: "(palette sub-mode steps back to root first)".
- **Disabled rows** — `keyboard-focus-map.md:106-107`: "Disabled rows (no target
  ticket; `New terminal` until Phase 2) are skipped by `Enter` but remain visible
  with their reason."
- **Theme rows** carry miniature pair swatches (`:235`). Anatomy at
  `screen-specs.md:92-98` and `components.md:264-271`: 44×28px pair swatches
  (⅔ human / ⅓ agent), radius 5, four presets — Indigo (default) · Clay · Slate ·
  Plum. "Selection applies instantly — a 150ms crossfade of accent surfaces only;
  no layout movement."
- **Ordering** is ADR 0003, and its menu carries a footnote
  (`screen-specs.md:246-247`): "Ordering is a view preference on this board — it
  never rewrites files." The palette sub-mode should carry the same sentence; the
  claim it makes is the reason the mode is safe.
- **Project rows** need registry + reachability + theme (`data-requirements.md:100`).
  Note the spec describes unreachable-project rendering for the **sidebar**
  (`screen-specs.md:41-42`) and not for the palette, even though the data
  requirement asks for reachability. Decide the palette's treatment and say you
  decided it.

## What exists today

Verified at `eb54bac`. Plan 25 will have added the palette; everything below
predates it and is what the sub-modes reuse.

**The option lists already exist and must not be duplicated.**
`src/metaOptions.tsx` was extracted by V0-16 precisely so "the panel, the create
panel and quick create cannot disagree about what the options are" — it holds the
status and priority option lists with their glyphs. `PRIORITY_OPTIONS` is imported
by `Board.tsx` too, after a review found the board had its own copy. **Add the
palette as a consumer, not a third list.**

**The writes already exist.** Every sub-mode's action is a closure in `App()`:

- status and priority → `App.tsx`'s `editMutation` (`:677-720`) + `mutate`, the way
  `changePriority` (`:726-741`) does. Needs an `IndexedTicket`, not a `TicketRow`.
- ordering → `setBoardOrdering`; the mode is device-local `localStorage` state
  keyed by project, beside `appearance` (`App.tsx:343-351`). **Not** in
  `registry.rs`, deliberately — V0-31 is open on registry recovery.
- theme → `api.updateProjectTheme` (`api.ts`), already used by project settings.
- project → `openProject` / the project-switch path the sidebar uses.
- archive → `setArchived` (`App.tsx:779-810`).

**The glyph vocabulary exists**: `StatusDot.tsx`, the priority glyph from V0-08,
`LabelChip.tsx`'s `LabelDot`. Sub-mode rows use them. Do not describe a status or
a priority in words where a glyph is the app's established channel.

**`TicketDocument::apply` refuses an edit that changes nothing**, so picking the
value a ticket already has must write nothing. Both existing menu callers guard it;
so must these.

**A note on "the open or focused ticket."** The palette can be opened with the
panel open (a ticket is open), with a card focused on the board or list (a ticket
is focused), or with neither. `Board.tsx` and `IssueList.tsx` expose the roving key
through `rovingFocus.ts`; `App.tsx` holds `selectedKey` (`:174`) and `openRow`
(`:208`). Work out one answer to "which ticket does this command target?" and put
it in one place — three sub-modes and the root list's disabled state all ask it.

## What to change

1. **Sub-mode state in the palette shell**: root vs one of six, the crumb chip in
   the input row, and the input filtering the *current* mode's rows.
2. **`Esc` steps back to root when in a sub-mode**, and closes only from root. This
   sits above the rung plan 25 took; the palette handles it internally before
   anything else sees the event.
3. **Five sub-modes**: status, priority, ordering, theme, project. Search is plan
   27 — leave the seam, do not build the rows.
4. **The no-target rule**: status, priority and archive are disabled with an inline
   explanation when no ticket is open or focused. Disabled rows stay visible and
   `Enter` skips them. This is the must-pass's third clause and needs its own test.
5. **Theme rows carry the pair swatches**, and selection applies instantly with the
   150ms accent crossfade and no layout movement.
6. **The ordering sub-mode carries the view-preference footnote.**

## What must not regress

- A pick that changes nothing writes nothing.
- `mutate()` stays the only write path; each sub-mode action inherits its optimistic
  apply, disk-state indicator, toast and `⌘Z` undo for free. Do not add a second.
- The archive command inherits a known edge from plan 17: a conflict on a
  board-raised archive reverts and offers **Open ticket**, not the conflict banner,
  because `ConflictBanner` is `TicketPanel` state. Plan 23 settled that and V0-29
  owns the rest. Do not re-solve it here.
- Theme change must move no layout — that is the spec's own acceptance line and
  V0-36 will re-check it.

## Working rules

- Read `AGENTS.md` § Toolchain and the gate first.
- TDD at the seams; confirm each behavioural test red-first and record which.
- Vitest; `// @vitest-environment jsdom` on line 1; `@testing-library/react` with
  `afterEach(cleanup)`; `vi.mock("./api", ...)`; store reset via
  `useLongClawStore.setState({...})` plus `resetMutations()`. Note jsdom under
  vitest exposes no `localStorage` — the ordering and appearance preferences need
  an in-memory store installed in the test (V0-09 hit this).
- Colours only from `var(--lc-*)`; add tokens to `src/tokens/design-tokens.json`
  and regenerate rather than hardcoding.
- Accessibility: entering a sub-mode changes what the input filters, which a screen
  reader must be told. The crumb is not decoration. A disabled row's reason must be
  announced, not just rendered.
- `npm --prefix apps/desktop run check` at the end; `npm run verify` before done.

## Done when

1. All five sub-modes work, each with a test that it acts on the right target.
2. The crumb renders per sub-mode, tested.
3. `Esc` steps back to root from a sub-mode and closes from root — two tests, and
   one that `Esc` in a sub-mode does not reach the ticket panel or the filter.
4. A command with no target ticket is disabled, visible, explains itself, and is
   skipped by `Enter` — tested for each of status, priority and archive.
5. `npm run verify` passes.
6. Outcome written, plan moved to `completed/`, V0-21's backlog row and the README
   Order table updated.
## Outcome

Implemented shared status, priority, theme, project, ordering, and search modes with a crumb/back path and disabled target-dependent rows.
