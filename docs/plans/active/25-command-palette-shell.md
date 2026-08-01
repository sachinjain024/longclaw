---
title: "The ⌘K palette shell and the root command set"
product: LongClaw
status: active
backlog_id: V0-20
order: 25
owner_area: Frontend
release_blocking: false
written: 2026-08-01
applies_to: "wave-1-ticket-domain-and-surfaces @ eb54bac"
depends_on: "24 (the input-suspension helper and the S binding)"
blocks: "26 (sub-modes), 27 (search is a sub-mode), 29 (the palette is where shortcuts are discoverable)"
---

# The ⌘K palette shell and the root command set

The palette is the product's primary navigation claim and the only keyboard path
several Wave 1 features have. Archive, unarchive and board ordering were all
shipped without a single-key binding **on purpose** — `keyboard-focus-map.md:107-110`
names the palette as their keyboard path — so until this exists, those three are
reachable only by pointer or by Tab.

This plan builds the shell, the root command list, and the `⌘K` rung in the escape
ladder. Sub-modes are plan 26; search is plan 27. Build the shell so both drop in.

## Why this exists

> "The palette is the product's primary navigation claim and the cheapest path to
> every command once the commands exist." — `docs/backlog/v0-backlog.md:135`

## Must-pass

> Every root command in the screen spec runs against the correct project and
> focused ticket; the terminal row is visible, disabled, and tagged `PHASE 2`.

## The approved design

**`docs/design/prototype/screen-specs.md:218-230` is the authority.** Quoted whole,
because it is short and every clause is load-bearing:

> - 560px modal, radius `--lc-radius-modal`, `--lc-shadow-modal`, scrim. Input row
>   44px (15px type, `esc` chip). Result rows 36px: 16px glyph slot, 13px name,
>   right-aligned kbd hint. Active row `accent-human-soft`. Footer: mono legend
>   `↑↓ navigate · ↵ run · esc close/back`.
> - **Root commands:** create ticket · go to project… · change status… (`S`) · set
>   priority… (`P`) · search tickets… · star/unstar project · toggle appearance ·
>   change project theme… · archive/unarchive ticket (ADR 0004) · change board
>   ordering… (ADR 0003) · switch board/list view · **new terminal** — present,
>   disabled, tagged `PHASE 2`. This is D14 minus "assign…" (no assignee in v0,
>   ADR 0001) plus the four commands from Proposal P1, accepted on 2026-08-01.

Twelve rows. Keys — `keyboard-focus-map.md:96-110`:

| Key | Action |
|---|---|
| Typing | Filters the current mode's rows |
| `↑↓` | Move selection (wraps) |
| `Enter` | Run selection |
| `Esc` | Sub-mode → back to root; root → close |

> Focus enters the input on open and returns to the pre-palette focus on close.
> Disabled rows (no target ticket; `New terminal` until Phase 2) are skipped by
> `Enter` but remain visible with their reason.

Opens on `⌘K` (`keyboard-focus-map.md:29`), and `⌘K` is a chord, so it **stays live
while an input has focus** (`:13-15`). Focus return is pinned by the focus-return
table, `:148`: "Palette | Whatever held focus before `⌘K`". Motion: rises on
`--lc-motion-panel` 150ms (`screen-specs.md:286`), zeroed under
`prefers-reduced-motion` (`:291-293`). Disabled treatment is `components.md:32` —
text/glyphs `--lc-ink-disabled`, fills `--lc-wash`, no hover, `cursor: default`.

## Three spec conflicts. Two are settled; the third is yours

Conflict 2 was settled on 2026-08-01 when the founder accepted P1, and conflict 1
is real but is **plan 30's to fix, not yours to work around** — build from the
design docs and leave the stale document alone. Only conflict 3 needs a decision
from you. All three are recorded here so the reasoning survives.

**1. `mvp_plan_order.md` § Step 12 is stale — do not build from it, and do not
fix it here.**
`docs/mvp_plan_order.md:498-506` still lists `assign` as a palette command, and
`:507` says "Reserve but do not expose or implement the Phase 2 terminal command."
Both are contradicted by every later document: `decisions.md:209-213`,
`screen-specs.md:228-229`, `components.md:280-281`, `prototype/README.md:95-99`,
`adr/0001:3`, and the backlog must-pass itself, which requires the terminal row to
be **visible**. The step plan was never ADR-propagated. **Design docs + ADR + the
must-pass win.** No assign command; a visible, disabled, tagged terminal row.
Reconciling the document itself is [plan 30](30-reconcile-step-12-command-set.md),
which is documentation debt and can run independently of this one. If you touch
`mvp_plan_order.md` at all, you are in plan 30's territory.

**2. `components.md` and `screen-specs.md` disagree on the command set.**
`components.md` previously listed the original eight-command D14 set while
`screen-specs.md` listed twelve. The component foundation now includes all twelve;
`screen-specs.md` remains the detailed authority for the root set and explains its
derivation.

**P1 is now ratified.** The four extra commands come from Proposal P1
(`prototype/README.md:79`), which the founder accepted on 2026-08-01. The remaining
P2–P10 proposals and the broader M0 experience gate remain open.

Minor, pick one and be consistent: glyph 14px (`components.md:276`) vs a 16px glyph
slot (`screen-specs.md:221`); "Selected row" vs "Active row".

**3. Two root commands are underspecified.**

- **"toggle appearance"** (`screen-specs.md:226`) against a *three*-state control:
  `screen-specs.md:253` specifies a System / Light / Dark segment, and Wave 1
  persists all three (`App.tsx:343-351`, `APPEARANCE_KEY`). "Toggle" over three
  states is undefined. Decide — cycling System → Light → Dark is the reading that
  loses nothing — and record it.
- **"star/unstar project"** never says which project. The active one is the only
  sensible reading; the star affordance itself is `screen-specs.md:39-41`.

## What exists today

Verified at `eb54bac`.

**Where it mounts.** `App.tsx` is 1515 lines. The three overlays — `TicketPanel`
(`:1101`), `QuickCreate` (`:1125`), `CreatePanel` (`:1138`) — are siblings under
`<main className="app-shell">`, with `<ToastStack />` at `:1149`. The palette is a
fourth sibling there.

**Every command it needs is already a closure inside `App()`:** `openTicket`
(`:260`), `changePriority` (`:726`), `setArchived` (`:779`), `setCreateSurface`
(`:180`), `setView` (`:191`), `setBoardOrdering`, `clearFilter` (`:255`),
`updateProjectTheme` / `setProjectStarred` via `api.ts`. Nothing needs lifting out,
but a `commands` object has to be threaded down as a prop — or the palette has to
be rendered inside `App()` with them in scope. Choose deliberately; `App.tsx` is
already the largest file in the frontend and this is the moment to decide whether
the command registry lives in its own module.

**The `⌘K` binding belongs in the existing global keydown effect at
`App.tsx:323-342`**, which already owns `⌘F` and the `Esc` filter rung and already
depends on `createSurface` and `selectedKey`.

**The `Esc` ladder as actually implemented** — read `App.tsx:309-322` for the
design comment. Two mechanisms, not one:

- Rungs 1–2 stop the event: `Menu.tsx:121-126` and `DescriptionEditor.tsx:138-145`
  both call `stopPropagation`, so the native event never reaches the document
  listeners.
- Rungs 3–4 are decided by state: `layerOpen = selectedKey !== undefined ||
  createSurface !== undefined` (`App.tsx:324`), and the filter rung stands down
  while it is true (`:337-338`). `TicketPanel`'s own `Esc` listener
  (`:261-268`) is **unguarded** — no `defaultPrevented` check, no modifier check.

**So the palette must do both**: take its own rung by `stopPropagation` *and* join
`layerOpen`. Belt and braces, because the panel's listener will otherwise fire
underneath it.

**One live hazard:** `⌘F` currently focuses the header filter unconditionally when
a project is open (`App.tsx:328-330` only stands down for `createSurface`). With
the palette open it will yank focus out from under the palette input. Make `⌘F`
stand down for the palette too.

**Two pre-existing `Esc` holes.** Plan 28 (V0-23) owns fixing them; you must not
make them worse:

1. `TicketPanel` and `QuickCreate` can be mounted at once (the panel renders
   whenever `createSurface !== "full"`, `App.tsx:1105`), so `Esc` in quick create
   closes both.
2. `Esc` in the panel's title textarea (`TicketPanel.tsx:476-479`) resets the draft
   *and* closes the panel, because it neither prevents nor stops.

**Can you reuse `Menu.tsx`?** Partly, and probably not as a component. It gives you
row rendering, wrapping `↑↓`/`j`/`k`, `Enter`/`Space` activation, `Esc` with
`stopPropagation`, and correct focus return via `returnTo` captured before the menu
takes focus (`Menu.tsx:54-68`). It does **not** give you: a text input, row
filtering, a crumb, disabled rows, centred modal layout, scroll containment, or
focus trapping — and its positioning is `position: fixed` off an anchor rect with
no flip and no width constraint (`:74-79`). The realistic reuse is `MenuOption` and
the key-handling shape, not the component. Decide and justify.

**Note the app has no focus trap anywhere.** `keyboard-focus-map.md:23` says
"Modals hold focus until dismissed" and nothing implements it. The palette is a
modal. Either build the trap here or hand it to plan 28 explicitly — do not leave
it unsaid.

## The gap you will hit: the palette has no empty state

There is **no designed empty state and no no-result state for the palette**
anywhere in `screen-specs.md`, `states.md` or `components.md`. The only specified
no-match state is the header filter's, `states.md:38-42`:

> **Trigger:** active filter query matches nothing. **Surface:** centered panel "No
> matches" + the echoed query + secondary **Clear filter** (also `Esc`).

For the root list filtered to zero rows, derive from that anatomy and say you
derived it. Do not invent a richer state. The search sub-mode's empty and
no-result states are plan 27's problem, and it inherits the same gap.

## What to change

1. A palette overlay: 560px modal, scrim, the geometry above, mounted as a fourth
   overlay sibling in `App.tsx`.
2. `⌘K` in the global keydown effect, live even while an input has focus, standing
   down for nothing except perhaps an already-open palette (make it a toggle or a
   no-op — decide).
3. The twelve root commands, each running against the correct project and the
   focused ticket. **The five that take a ticket** (change status, set priority,
   archive/unarchive) must be disabled with an inline reason when there is no
   focused or open ticket — that behaviour is specified at `screen-specs.md:233-235`
   and is plan 26's must-pass, but the disabled-row *mechanism* is yours.
4. The terminal row: visible, disabled, tagged `PHASE 2`, skipped by `Enter`,
   showing its reason.
5. Typing filters the current mode's rows; `↑↓` wraps; `Enter` runs; `Esc` closes.
6. Focus enters the input on open, returns to the pre-`⌘K` element on close.
7. The `Esc` rung and the `layerOpen` join, plus the `⌘F` stand-down.
8. Rows that map to a single-key action carry that key as a right-aligned kbd hint
   (`screen-specs.md:222`, `:225-226` show `S` and `P`). `components.md:298-299`
   makes the palette the place shortcuts are discoverable, which plan 29 depends on.

## What must not regress

- The roving-focus contract (`rovingFocus.ts:94-102`) — focus moves only for a new
  request. Opening and closing the palette must not shove focus into a surface.
- `mutate()` is the only write path. A palette command that changes status,
  priority or archived state goes through `App.tsx`'s `editMutation` (`:677-720`) +
  `mutate`, and inherits its toast and `⌘Z` undo. Note `editMutation` needs an
  `IndexedTicket`, not a `TicketRow` — a degraded row has no status to change.
- The palette's `create ticket` command routes through `submitNewTicket`
  (`App.tsx:615-661`) and therefore inherits two recorded divergences: undo of a
  create archives rather than deletes (ADR 0004 vs `screen-specs.md:204-207`), and
  a failed write reverts rather than staying marked unsaved
  (`states.md:64-67` vs V0-17's must-pass). Do not re-decide either.
- `⌘Z` is `metaKey`-only today (`WriteFeedback.tsx:81`) while `⌘F` and `⌘↵` take
  `metaKey || ctrlKey`. Plan 24 picks a convention; follow it for `⌘K`.

## Working rules

- Read `AGENTS.md` § Toolchain and the gate first.
- TDD at the seams; confirm each behavioural test red-first and record which.
- Vitest; `// @vitest-environment jsdom` on line 1; `@testing-library/react` with
  `afterEach(cleanup)`; `vi.mock("./api", ...)`; store reset via
  `useLongClawStore.setState({...})` plus `resetMutations()`.
- Colours only from `var(--lc-*)`. If a token you need is missing, add it to
  `src/tokens/design-tokens.json` and regenerate — `npm run check` runs a token
  check. `--lc-radius-modal` and `--lc-shadow-modal` are named by the spec; verify
  they exist before assuming.
- Accessibility: a command palette is a combobox-over-listbox pattern, not a menu.
  Pick roles deliberately and justify them. Disabled rows must announce *why* they
  are disabled, not just that they are.
- `npm --prefix apps/desktop run check` at the end; `npm run verify` before done.

## Done when

1. All twelve root commands run, each with a test proving it acts on the correct
   project and the focused ticket.
2. The terminal row is visible, disabled, tagged `PHASE 2`, and skipped by `Enter`,
   with a test.
3. `⌘K` opens from anywhere including inside a text field; `Esc` closes; focus
   returns to the pre-palette element. All three tested.
4. Opening the palette does not close the ticket panel, and `Esc` with the palette
   open does not reach the panel or the filter.
5. `npm run verify` passes and the perf traces are still within budget.
6. Outcome written naming the appearance-toggle and star-target decisions (conflict
   3) and confirming `mvp_plan_order.md` was left to plan 30, plan moved to
   `completed/`, V0-20's backlog row and the README Order table updated.
