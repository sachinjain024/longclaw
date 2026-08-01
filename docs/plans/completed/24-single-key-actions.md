---
title: "Single-key actions on the focused ticket"
product: LongClaw
status: completed
backlog_id: V0-22
order: 24
owner_area: Frontend
release_blocking: false
written: 2026-08-01
applies_to: "wave-1-ticket-domain-and-surfaces @ eb54bac"
depends_on: "nothing open. Sits on 14 (Menu.tsx), 16 (IssueList), 13 (mutations.ts)"
blocks: "25 (the palette needs the input-suspension helper this builds)"
---

# Single-key actions on the focused ticket

Wave 1 shipped exactly one single-key action — `P` on a board card — and shipped
it scoped to `.board-grid`. The approved keyboard map specifies four, across two
surfaces. This plan closes the gap and, more importantly, builds the one rule
every later Wave 2 item depends on: **single-key shortcuts suspend while an input
has focus, and chords do not.**

Do this first. The palette (plan 25) is a chord that must stay live inside its own
text input, and it cannot be reasoned about until the suspension rule exists as a
tested seam rather than an ad-hoc `closest()` call in one component.

## Why this exists

> "The speed claim is about the keys a user presses most, not the palette they
> open occasionally." — `docs/backlog/v0-backlog.md:137`

## Must-pass

> Every single-key action in the keyboard map acts on the focused ticket and on
> nothing else.

**Read that clause carefully before you start, because taken literally it cannot
be met.** The map's single-key set includes `C` (`keyboard-focus-map.md:32`,
`:44`), which acts on the project and the column, not on a focused ticket, and
`Esc`, which acts on the layer stack. The gate is about `S`, `P` and `Enter` — the
actions that *take a ticket* — and the property it is protecting is that they
never act on a ticket other than the focused one, and never fire when no ticket is
focused. Say so in your Outcome so the next reader does not think the gate was
dodged.

## The approved design

`docs/design/prototype/keyboard-focus-map.md` is the normative document. The
decisive lines:

**The rule that makes the rest safe** — `:13-15`:

> **Single-key shortcuts suspend while any input has focus.** Chords (`⌘K`, `⌘F`,
> `⌘Z`, `⌘↵`) stay live everywhere except where the OS owns them (e.g. `⌘Z` inside
> a focused text field is the field's undo).

Restated at `components.md:300`.

**Global** — `:29-33`: `⌘K` palette · `⌘Z` undo · `⌘F` filter · **`C` quick create
in the current project** · `Esc` ladder.

**Board** — `:39-49`:

| Key | Action |
|---|---|
| `↑`/`K`, `↓`/`J` | Move focus within the column |
| `←`/`H`, `→`/`L` | Move focus across columns (row index clamps) |
| `Enter` | Open focused ticket in the panel |
| `S` | Status menu, anchored to the focused card |
| `P` | Priority menu, anchored to the focused card |
| `C` | Quick create (column `+` buttons preseed that column's status) |

Plus, verbatim at `:46-49`: "Focus entry: the first card of the first non-empty
column on first arrow press. A degraded card accepts focus; `Enter` opens the raw
file view; the `S`/`P` actions are inert on it. Focus order always matches the
visual order, including the board-ordering preference (ADR 0003)."

**Issue list** — `:51-54`: "Same as board, but `↑↓`/`J K` traverse the flat visual
order across groups; `←→`/`H L` are unbound. Group headers are not focus stops."
So `S`, `P`, `Enter` and `C` **do** apply in the list.

**Panel** — `:66-69`: "The panel does not steal `↑↓` from the page scroll. `S`/`P`
still work (they target the open ticket) because the panel's ticket is the focused
ticket. There is no `A` shortcut in v0 — assignment does not exist in local mode
(ADR 0001)."

**Not bound in v0, deliberately** — `:154-162`, quoted in full because it is as
much of the spec as the table is:

> - No chords beyond the `⌘` basics (D8: "no chords in v0").
> - No `A` (assign) — D8 listed it, but v0 local mode has no assignee (ADR 0001);
>   the binding is reserved for team mode.
> - No drag-and-drop keyboard equivalent — reordering within a column is post-v0
>   (LC-136 canceled); status moves *are* the keyboard path across columns (`S`).
> - `New terminal` command exists but is disabled until Phase 2.

And `:107-110`: archive/unarchive and board ordering have no single-key binding —
the palette is their keyboard path. **Do not invent one.**

D8's source table, with its ADR correction, is `decisions.md:131-140`.

## What exists today

Verified at `eb54bac`. Do not trust these line numbers blindly — re-read before
editing.

**Bound now:**

- `P`, board only — `Board.tsx:245-252`, inside the `onKeyDown` React handler on
  `div.board-grid` (`Board.tsx:232`, attached `:298`). It is inert on a degraded
  row and returns *without* `preventDefault` (`:248`).
- Arrows and `j`/`k`/`h`/`l`, board — `MOVES` at `Board.tsx:121-130`, matched by
  `moveFor` (`rovingFocus.ts:31-36`), which also accepts the uppercase form.
- Arrows and `j`/`k`, list — `IssueList.tsx:57-62`, handler `:172-188` on
  `div.issue-list`. `h`/`l` deliberately absent.
- `Enter` on a card or row is **implicit**: both are native `<button>`s
  (`Board.tsx:541`, `IssueList.tsx:323`) with `onClick`. There is no `Enter`
  handler anywhere.
- `⌘F` — `App.tsx:323-342`. `⌘Z` — `WriteFeedback.tsx:78-93`. `⌘↵` —
  `DescriptionEditor.tsx:146`, `CreatePanel.tsx:88`, `TicketPanel.tsx:743`.

**Not bound anywhere: `S`, `C`, `⌘K`.**

**Two guards already established in the board handler, both worth keeping:**

- `Board.tsx:233` — `if (event.metaKey || event.ctrlKey || event.altKey) return;`
  A modified combo belongs to the window. Pinned by `Board.test.tsx:476`.
- `Board.tsx:236` — `if (event.defaultPrevented) return;` An open `Menu` owns its
  own keys.

**The one text-field guard in the codebase** is `WriteFeedback.tsx:83-86`:

```ts
target.closest("input, textarea, select, [contenteditable=true]")
```

That is the thing to lift into a shared helper. Nothing else checks.

**Two inconsistencies to resolve rather than propagate:** `⌘Z` is `metaKey`-only
(`WriteFeedback.tsx:81`) while `⌘F` and `⌘↵` accept `metaKey || ctrlKey`. Pick one
convention for the whole app and say which in your Outcome; plan 25 will follow it
for `⌘K`.

## What to change

1. **A shared key-context helper.** One module that answers "is a single-key
   shortcut allowed right now?" — i.e. no input, textarea, select or
   contenteditable has focus — and that the chord bindings do *not* consult. Give
   it unit tests. `WriteFeedback.tsx` should adopt it rather than keeping its own
   copy.

2. **`S` on the board**, anchored to the focused card, opening the shared `Menu`
   with the status options. The priority path at `Board.tsx:245-252` and
   `App.tsx`'s `changePriority` (`:726-741`) are the exact model: the board raises
   an intent, `App.tsx` owns the write through `editMutation` + `mutate`. Status
   is already a menu in the panel (`metaOptions.tsx` holds the option lists — use
   it, do not build a second).

3. **`P` and `S` on the list.** `IssueList.tsx:172-188` handles navigation only,
   which contradicts `keyboard-focus-map.md:53-54`. Note the list's handler reads
   its key from `closest(".list-row")` with **no `rovingKey` fallback**
   (`IssueList.tsx:179-182`), deliberately, because the Archived toggle is its own
   tab stop and is not a row — preserve that reasoning when you add the actions.
   The two surfaces now want the same three actions over different geometry; look
   hard at whether the action layer belongs beside `rovingFocus.ts` rather than
   copied into both handlers. Plan 28 will inherit whatever you decide.

4. **`Enter` explicitly**, if and only if you find a case the native button does
   not cover. If native activation is sufficient, write the test and say so —
   "already works" is a fine outcome, silently untested is not.

5. **`C` for quick create**, globally when a project is open and no input has
   focus. On the board, `keyboard-focus-map.md:44` says the column `+` buttons
   preseed that column's status; check whether those buttons exist yet and do not
   invent them if they do not — bind `C` to the quick create surface that exists
   (`App.tsx:1125`) and note any gap.

6. **`S`/`P` while the panel is open**, per `:66-69`. The panel's ticket is the
   focused ticket. Be careful: the panel mounts a document-level `Esc` listener
   (`TicketPanel.tsx:261-268`) and contains several text fields, so this is the
   first real test of the suspension rule.

## What must not regress

- The `Menu` popover's keys (`Menu.tsx:99-127`) — it takes `Enter`, `Space`,
  arrows, `j`/`k`, and `Esc` with `stopPropagation`. A surface-level `S` must not
  fire while a menu is open; the `defaultPrevented` guard is what stops it.
- The roving-focus contract (`rovingFocus.ts:94-102`): focus moves only for a *new*
  focus request, never merely because `rovingKey` changed. A query re-buckets rows
  while a human is typing, and the old behaviour yanked focus into the board
  mid-word — WebKit then read the next backspace as navigate-back. Pinned by
  `App.test.tsx:1810`, `:1826`, `:1839`. Do not touch those tests.
- `TicketDocument::apply` refuses an edit that changes nothing, so picking the
  status a ticket already has must write nothing. Both existing menu callers guard
  this.

## Working rules

- Read `AGENTS.md` § Toolchain and the gate first. `export
  PATH="/opt/homebrew/opt/rustup/bin:$PATH"` before any Rust work.
- TDD at the seams. Confirm each behavioural test fails against current code
  before making it pass, and record which in the Outcome.
- Vitest; component test files open with `// @vitest-environment jsdom` on line 1;
  `@testing-library/react` with `afterEach(cleanup)`; IPC mocked via
  `vi.mock("./api", ...)`; store reset with `useLongClawStore.setState({...})` plus
  `resetMutations()` from `mutations.ts`. `Board.test.tsx` and `IssueList.test.tsx`
  are the models.
- Colours come only from `var(--lc-*)` in `src/styles.css`. Zero hardcoded colours
  today; keep it that way.
- `npm --prefix apps/desktop run check` at the end. `npm run verify` before the
  plan is called done.
- Every mutation goes through `mutate()` in `src/mutations.ts`. Do not add a second
  write path or a second toast.

## Done when

1. `S`, `P`, `Enter` and `C` behave as the map specifies on the board, in the list,
   and (for `S`/`P`) with the panel open, each with a test.
2. A test proves each of `S`/`P`/`Enter` acts on the focused ticket and on no
   other, and does nothing when no ticket is focused.
3. A test proves single-key actions suspend while an input has focus and that
   chords do not.
4. `npm run verify` passes; `npm run perf:board` and `npm run perf:list` are still
   within budget (a document-level key listener is cheap, but say the numbers).
5. Outcome written, plan moved to `docs/plans/completed/`, the V0-22 row updated in
   the backlog, and the Order table in `docs/plans/active/README.md` updated.
## Outcome

Implemented shared input suspension, board `S` status menus, global `C` quick-create, and retained native Enter activation. Focused board tests and the existing board/list/App suites pass.
