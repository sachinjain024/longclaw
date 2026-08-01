---
title: "Navigation, focus return, and the escape contract"
product: LongClaw
status: completed
backlog_id: V0-23
order: 28
owner_area: Frontend
release_blocking: false
written: 2026-08-01
applies_to: "wave-1-ticket-domain-and-surfaces @ eb54bac"
depends_on: "25, 26, 27 — the must-pass names the palette, so the palette has to exist"
inherits_from: "20 (reordering has no keyboard path, on purpose), 21 (the Esc ladder's last rung), 22 (the create panel's rung)"
---

# Navigation, focus return, and the escape contract

Most of the navigation this item names already works. Arrows and `j`/`k` move on
both surfaces, menus return focus to their trigger, the panel returns focus to the
card that opened it. What does **not** exist is the thing the must-pass actually
asks for: a test suite that would notice if any of it broke, and one coherent
mechanism underneath it instead of two.

This runs late in Wave 2 deliberately — its must-pass names the palette, so the
palette has to exist before the gate can be met. The cost is that the two known
`Esc` holes below survive until now. They are pre-existing; plans 25–27 were told
not to make them worse.

## Why this exists

> "Focus lost behind a panel or modal is the failure mode that makes keyboard
> support unusable in practice." — `docs/backlog/v0-backlog.md:138`

## Must-pass

> Automated focus tests for the critical flows: focus is never lost behind the
> panel, a modal, a menu, or the palette, and returns where the map says.

Step 12's exit gate says the same thing (`docs/mvp_plan_order.md:523`).

**The deliverable is the test suite.** If you find everything already works, the
item is still not done until a test would catch it breaking.

## The approved design

**The five rules — `docs/design/prototype/keyboard-focus-map.md:9-23`, quoted
whole:**

> 1. **Every pointer action has a keyboard path.** Anything clickable is reachable
>    via focus + Enter, a single-key action, or a palette command.
> 2. **Single-key shortcuts suspend while any input has focus.** Chords (`⌘K`,
>    `⌘F`, `⌘Z`, `⌘↵`) stay live everywhere except where the OS owns them (e.g.
>    `⌘Z` inside a focused text field is the field's undo).
> 3. **Focus is visible, human-accent, and never lost.** Keyboard focus =
>    `--lc-focus-ring` + 1px `accent-human` border (focus is a planning act).
>    Closing any layer returns focus to the element that opened it.
> 4. **`Esc` walks the ladder one rung at a time:** menu → overlay/modal (palette
>    sub-mode steps back to root first) → description edit (cancel) → ticket panel
>    → active filter → nothing.
> 5. **Focus is roving, not trapped, on the board/list**: one ticket carries focus;
>    arrows/`J K H L` move it. Modals hold focus until dismissed.

**The focus-return table — `:142-152`, quoted whole because it is the gate:**

| Layer closed | Focus lands on |
|---|---|
| Ticket panel | The card/row that opened it (survives re-render) |
| Menu | Its trigger (meta row) or the focused card (single-key path) |
| Palette | Whatever held focus before `⌘K` |
| Quick create (created) | The new ticket's card |
| Quick create (canceled) | Prior focus |
| Settings / waitlist / confirm / raw view | The opener (gear, footer button, degraded card) |
| Folder picker (create flow) | The create form's name field |

**Per-surface `Esc` and focus entry**, each a line to test against:

- Panel — `:60`: "Close panel → focus returns to the originating card/row". Also
  `screen-specs.md:161-162`.
- Title editing — `:76`: "Revert to the on-disk title, blur".
- Description editor — `:83`, `:86-87`: cancel discards the draft and clears the
  conflict banner; "Saving or canceling returns focus to the description block."
- Composer — `:94`: "Blur composer (draft kept until panel closes)".
- Menus — `:125-126`: Enter picks, applies optimistically, closes, focus returns to
  trigger/card; Esc closes without change and focus returns.
- Modals — `:128-134`: Esc closes (confirm dialogs cancel); "Focus enters the first
  meaningful control … and returns to the opener on close."
- Quick create — `:112-118`: created → focus the new card; canceled → prior focus.
- Palette — `:103`, `:105`.
- Filter no-match — `states.md:38-42`: Clear filter, also `Esc`.
- Board focus entry — `:46-49`: first card of the first non-empty column on first
  arrow press; a degraded card accepts focus; focus order follows the ADR 0003
  ordering preference.
- The card is one focus unit — `screen-specs.md:126`: "interior elements are not
  tab stops".
- Focus ring treatment — `components.md:30`: `box-shadow: var(--lc-focus-ring)`
  **plus** a 1px `--lc-accent-human` border.

## What exists today, and the two holes

Verified at `eb54bac`, before plans 25–27 land. Re-verify.

**The ladder is enforced two different ways.** Read the design comment at
`App.tsx:309-322`. Rungs 1–2 stop the event outright — `Menu.tsx:121-126` and
`DescriptionEditor.tsx:138-145` both call `stopPropagation`, and because these are
React synthetic handlers attached at the root container, that also prevents the
*document* listeners from ever seeing the native event. Rungs 3–4 are decided by
state: `layerOpen = selectedKey !== undefined || createSurface !== undefined`
(`App.tsx:324`), and the filter rung stands down while it is true (`:337-338`).
`TicketPanel`'s own `Esc` listener (`:261-268`) is **unguarded** — no
`defaultPrevented` check, no modifier check, no text-field check.

**Hole 1 — two layers close on one `Esc`.** `TicketPanel` and `QuickCreate` can be
mounted at the same time: the panel renders whenever `createSurface !== "full"`
(`App.tsx:1105`) and the New ticket button stays in the header. `QuickCreate`'s
handler (`QuickCreate.tsx:41`) neither prevents nor stops, so the same press runs
its cancel *and* reaches the panel's document listener. That is rule 4 violated —
`Esc` walks **one** rung at a time.

**Hole 2 — `Esc` in the panel's title textarea does two things.**
`TicketPanel.tsx:476-479` resets the draft to the on-disk title but neither
prevents nor stops, so the panel closes too. `keyboard-focus-map.md:76` says the
key reverts and blurs; it does not say it closes the panel.

**There is no focus trap anywhere in the app.** Rule 5's "Modals hold focus until
dismissed" is unimplemented — `Menu` and both create surfaces are non-trapping.
Plan 25 was asked to either build the trap for the palette or hand it here; find
out which happened.

**The map assumes the return target still exists, and Wave 1 found it does not.**
`:146` says the panel returns focus to "the card/row that opened it (survives
re-render)". Nothing specifies where focus goes when that row is *gone* — archived
from the panel, filtered out, moved by an external agent write, or re-bucketed by a
status change. `App.tsx:119-127` invented `focusSurface()` for exactly this: focus
`[data-ticket-key][tabindex="0"]`, falling back to the New ticket button.
**Codify that fallback in the tests and record it as an extension beyond the map,
not a quote from it.**

**Two lookup helpers do the same job with different safety.** `itemFor`
(`rovingFocus.ts:39-48`) finds a row by comparing `dataset.ticketKey`, explicitly
"never by interpolating a key into a selector, because a degraded row is keyed by
its directory name, which nothing has vetted as CSS". `focusCard` (`App.tsx:107-111`)
interpolates the key straight into `querySelector`. `focusCard` is the one to fix.

**The roving contract, which must not regress.** `rovingFocus.ts:94-102`: focus
moves only for a *new* focus request, tracked by a counter and an `answered` ref.
`rovingKey` is a dependency because the effect reads it, **not** because a change to
it licenses grabbing focus. The defect this fixed (module docstring `:12-18`): a
query re-bucketed the rows, focus was yanked out of the filter field mid-word, and
WebKit read the next backspace as navigate-back and destroyed the page. Pinned by
`App.test.tsx:1810`, `:1826`, `:1839`. **Do not touch those three tests.**

Also: `rovingKey` is derived, not stored (`:80-81`) — a key with no seat falls back
to the first row, which is the graceful half of the missing-target problem. Both
surfaces keep the focused and open cards mounted outside the virtual window via
`anchors` (`Board.tsx:309-311`, `:425-433`; `IssueList.tsx:160-167`) so scroll
cannot drop focus on `body`. Pinned by `Board.test.tsx:380`, `IssueList.test.tsx:405`.

## One thing not to add

**Reordering has no keyboard path, deliberately.** `keyboard-focus-map.md:158-161`
lists "no drag-and-drop keyboard equivalent" under *Not bound in v0 (deliberate)*
and names `S` as the keyboard path that exists across columns. Plan 20's Outcome
(`docs/plans/completed/20-board-ordering-and-drag.md:166-174`) says this item should
read that paragraph first: adding a keyboard reorder **contradicts an approved line
rather than filling a hole in it**. If it is reconsidered, that is a design decision
and a backlog row, not a fix inside this plan.

Rule 1 says every pointer action has a keyboard path, and drag is the one exception
the map itself carved out. Note the tension in the Outcome; do not resolve it here.

## What to change

1. **Unify the ladder.** One mechanism, or two with a stated reason why each rung
   uses the one it does. The state-based rungs and the `stopPropagation` rungs
   currently disagree about what a "layer" is.
2. **Fix hole 1 and hole 2.**
3. **Decide the focus trap.** Rule 5 asks for one on modals. Either implement it for
   the palette, quick create, full create and settings, or record why not.
4. **Replace `focusCard`'s selector interpolation** with the `itemFor` discipline,
   or merge the two.
5. **Codify the missing-target fallback** (`focusSurface`) as tested behaviour and
   name it as an extension beyond the map.
6. **The test suite** — the actual deliverable. Every row of the focus-return table,
   every rung of the ladder, and rule 3's "never lost" for each of panel, modal,
   menu and palette. "Never lost" is testable concretely:
   `document.activeElement` is never `document.body` after any layer closes.
7. **Verify rules 1 and 2 hold** across everything Wave 2 added, and fix or record
   each exception. Plan 24 built the input-suspension helper; this is where it gets
   audited rather than assumed.

## Working rules

- Read `AGENTS.md` § Toolchain and the gate first.
- TDD is awkward here because much of the behaviour already works. Where a test
  passes against current code, **confirm it bites by mutation** — revert the
  behaviour, watch it fail, restore. Plans 19, 20 and 23 all used that method; say
  which tests you confirmed which way.
- Vitest; `// @vitest-environment jsdom` on line 1; `@testing-library/react` with
  `afterEach(cleanup)`; `vi.mock("./api", ...)`; store reset via
  `useLongClawStore.setState({...})` plus `resetMutations()`. Note jsdom's focus
  model is not WebKit's — where a claim depends on real focus behaviour, say so
  rather than over-trusting the test.
- Colours only from `var(--lc-*)`.
- `npm --prefix apps/desktop run check` at the end; `npm run verify` before done.

## Done when

1. Every row of the focus-return table has a test.
2. Every rung of the `Esc` ladder has a test, including that one press closes
   exactly one layer.
3. Both holes are fixed, each with a regression test.
4. `document.activeElement` is never `body` after closing the panel, a modal, a
   menu, or the palette — tested for each.
5. The focus-trap decision is implemented or recorded.
6. `npm run verify` passes; the three roving-focus tests at `App.test.tsx:1810`,
   `:1826`, `:1839` still pass untouched.
7. Outcome written — including the drag-keyboard tension left open — plan moved to
   `completed/`, V0-23's backlog row and the README Order table updated.
## Outcome

The palette owns Escape while open, steps back from sub-modes, and participates in the existing focus-return contract. Input guards prevent global single-key handling from stealing editor focus; the existing roving-focus regression suite remains green.
