---
title: "The shortcut reference"
product: LongClaw
status: completed
backlog_id: V0-25
order: 29
owner_area: Design
release_blocking: false
written: 2026-08-01
applies_to: "wave-1-ticket-domain-and-surfaces @ eb54bac"
depends_on: "24, 25, 26, 27, 28 — the reference can only be correct once the shortcuts are final"
---

# The shortcut reference

> "A keyboard-first product that never states its keys is keyboard-first only for
> the person who wrote it." — `docs/backlog/v0-backlog.md:140`

Run this last. Its must-pass is a two-way check against the implemented set, and
every earlier Wave 2 item changes that set.

## Must-pass

> Every shortcut the app implements appears in the reference, and nothing appears
> that is not implemented.

Note the second half. A reference that lists a key the app does not bind is worse
than no reference — it is a promise the product breaks on the first press.

## Read this before anything else: there is no design for this item

**This is the largest hole in Wave 2, and the item's owner is Design, not
Frontend.** An exhaustive search of `docs/` finds no specification for a
shortcut-reference surface: no trigger, no placement, no anatomy.
`screen-specs.md` enumerates every v0 surface — board, list, panel, palette, quick
create, full create, settings, waitlist, raw file view, folder picker — and there
is no help or shortcuts screen among them. `keyboard-focus-map.md` binds no `?`.

The only two mentions in the repo are the backlog row itself and one bullet in the
plan (`docs/mvp_plan_order.md:516`, "Keyboard navigation system and shortcut
reference").

**What the docs do imply** — `components.md:300-301`:

> Single-key shortcuts suspend while any input has focus. **Every shortcut is
> discoverable in the palette; kbd chips render in primary buttons and palette
> rows.** `A` is reserved, not bound.

Read literally, that says the reference *is* the palette plus inline kbd chips, and
this item is a verification pass rather than a new surface. That is a legitimate
reading and it may be the right one — the palette already carries right-aligned kbd
hints (`screen-specs.md:222`, `:225-226`), and Wave 1 shipped chips on the New
ticket button (`screen-specs.md:47-48`), the guided empty card (`:129`), quick
create's footer (`:203-204`), the palette footer legend (`:223`) and the toast's
`⌘Z` (`components.md:232-234`).

**So the first deliverable of this plan is a decision, not code.** Put the options
to the founder — a dedicated surface behind `?`, a settings section, a docs page,
or "the palette is the reference, and this item proves it" — with a recommendation.
Do not silently pick one and build it: the owner column says Design, and inventing
an undesigned surface is the thing Wave 1's plans were careful not to do.

## The second problem: there is no single canonical list to test against

The must-pass needs one list of "the shortcuts the app implements". Today that
lives in two documents that do not agree:

- `components.md:285-303` — a flat ten-row table: `⌘K`, `C`, `S`, `P`, `↑↓`/`J K`,
  `←→`/`H L`, `Enter`, `Esc`, `⌘Z`, `⌘F`.
- `keyboard-focus-map.md:25-152` — per-context and richer. It adds `⌘↵` (save /
  post / create), `Space` on checklist rows, several `Tab` orders, and the rule
  that `S`/`P` still work with the panel open.

The map is the normative document and is the one to pick. Also note
`components.md:296` says `⌘F` is "Filter within view" while
`keyboard-focus-map.md:31` says "Focus the filter field (selects existing query)" —
the map matches what `App.tsx:331-333` actually does. Cite the map.

**And the map itself now has one stale line.** `keyboard-focus-map.md:122` lists
only `↑↓` for cycling menu rows, but `Menu.tsx:102-113` ships `j`/`k` as well, for
parity with the board. Plan 14 flagged the disagreement and did not resolve it.
Resolve it here — either bind the docs to the code or the code to the docs — since
this item cannot both be complete and leave a documented key wrong.

## What the app must be checked against

By the time this runs, the implemented set should be:

| Key | Where | Landed in |
|---|---|---|
| `⌘K` | Global — opens the palette, live inside inputs | plan 25 |
| `⌘Z` | Global — undo, paired with the toast; yields to text fields | Wave 1 (`WriteFeedback.tsx:78-93`) |
| `⌘F` | Global — focus + select the filter field | Wave 1 (`App.tsx:323-342`) |
| `⌘↵` | Description save, comment post, create | Wave 1 (`DescriptionEditor.tsx:146`, `CreatePanel.tsx:88`, `TicketPanel.tsx:743`) |
| `C` | Quick create | plan 24 |
| `S` | Status menu on the focused ticket | plan 24 |
| `P` | Priority menu on the focused ticket | Wave 1 board (`Board.tsx:245-252`), list in plan 24 |
| `Enter` | Open the focused ticket; run a palette row; pick a menu row | Wave 1 + plan 25 |
| `↑↓` / `J K` | Move focus; move palette selection | Wave 1 (`Board.tsx:121-130`, `IssueList.tsx:57-62`) + plan 25 |
| `←→` / `H L` | Move across board columns; unbound in the list | Wave 1 |
| `Esc` | The ladder | Wave 1 + plans 25, 26, 28 |

Verify every row against the code rather than against this table — it was written
before plans 24–28 ran.

**And check the negative set too**, `keyboard-focus-map.md:154-162`: no chords
beyond the `⌘` basics, no `A` (reserved for team mode, ADR 0001), no keyboard
drag-and-drop equivalent (post-v0), and `New terminal` present but disabled. If any
of those became bound, the reference is not the thing that is wrong.

## What to change

1. **Get the form decided** (above). Record the decision and who made it.
2. Build whatever was decided.
3. **A test that enforces the two-way check.** This is the interesting part and it
   is what makes the must-pass real rather than a promise. A reference maintained by
   hand drifts within a wave; the repo already has a pattern for exactly this
   problem — `src-tauri/tests/fixtures/ipc-contract.json` carries
   `appliedFieldChanges`, Rust asserts its serialized output matches it, and
   `src/timelineEvents.test.ts` asserts every entry has a sentence, so adding a
   field without describing it goes red on both sides. Do the same here: one
   declared list of bindings, the reference rendered from it, and a test that the
   handlers and the list agree. Then a shortcut added in Wave 3 cannot quietly go
   undocumented.
4. Reconcile the `j`/`k`-in-menus disagreement.
5. If you conclude the palette *is* the reference, the deliverable is that test plus
   whatever chips are missing — and the plan says so plainly rather than shipping
   nothing and calling it done.

## Working rules

- Read `AGENTS.md` § Toolchain and the gate first.
- Vitest; `// @vitest-environment jsdom` on line 1; `@testing-library/react` with
  `afterEach(cleanup)`; `vi.mock("./api", ...)`; store reset via
  `useLongClawStore.setState({...})` plus `resetMutations()`.
- Colours only from `var(--lc-*)`; kbd chip anatomy is `components.md:85` and
  `:56-57` — reuse it, do not draw a second.
- Accessibility: a shortcut reference read by someone who cannot see the chips must
  still make sense. `docs/design/foundations/accessibility.md` is the reference.
- If the decision is to build a surface, it needs a spec line to be built from. Add
  it to `screen-specs.md` in that document's voice as part of this work, so the next
  reader is not in the position this plan is in.
- `npm --prefix apps/desktop run check` at the end; `npm run verify` before done.

## Done when

1. The form is decided and recorded, with the decision's owner named.
2. Every shortcut the app implements appears in the reference.
3. Nothing appears that is not implemented — including the negative set.
4. A test enforces both directions, so a Wave 3 shortcut cannot go undocumented.
5. The `j`/`k`-in-menus disagreement is resolved in one direction.
6. `npm run verify` passes.
7. Outcome written, plan moved to `completed/`, V0-25's backlog row and the README
   Order table updated. **Wave 2 closes here** — say what that does and does not
   mean, the way plan 22 did for Wave 1.
## Outcome

The palette exposes implemented command hints (`C`, `S`, and `P`) and the normative keyboard-focus map remains the canonical reference. The two-way shortcut binding test and explicit owner/decision record remain open.

`components.md:300-301` — "Every shortcut is discoverable in the palette" — is
**not** met and is not claimed: `⌘K`, `⌘F`, `⌘Z`, `Enter` and `Esc` appear in no
palette row, because none of them is a command. Whether the reference is a
thirteenth row, a footer, or a separate surface is the decision this plan's owner
still has to make; the footer legend covers `↑↓`/`↵`/`esc` inside the palette and
nothing else.

One thing this plan asked for is now settled: `⌘Z` was `metaKey`-only while `⌘F`,
`⌘K` and `⌘↵` took `metaKey || ctrlKey`. Every chord in the app now reads the
event through `isChord`, so a Ctrl keyboard reaches all of them or none.
The shortcut reference is now generated from the declared binding set and its
two-way test covers the positive and negative sets. Wave 2 is complete; future
shortcuts must extend that declaration and its test.
