# LongClaw v0 — keyboard & focus map

> Phase 0, Step 2 deliverable. The complete keyboard surface of v0 and the
> focus rules that make it predictable. The shortcut set is D8
> (`../foundations/decisions.md`); this document maps it onto every context
> and specifies entry/exit focus for each surface. Live reference:
> `prototype.html`.

## Rules

1. **Every pointer action has a keyboard path.** Anything clickable is
   reachable via focus + Enter, a single-key action, or a palette command.
2. **Single-key shortcuts suspend while any input has focus.** Chords
   (`⌘K`, `⌘F`, `⌘Z`, `⌘↵`) stay live everywhere except where the OS owns
   them (e.g. `⌘Z` inside a focused text field is the field's undo).
3. **Focus is visible, human-accent, and never lost.** Keyboard focus =
   `--lc-focus-ring` + 1px `accent-human` border (focus is a planning act).
   Closing any layer returns focus to the element that opened it.
4. **`Esc` walks the ladder one rung at a time:** menu → overlay/modal
   (palette sub-mode steps back to root first) → description edit (cancel)
   → ticket panel → active filter → nothing.
5. **Focus is roving, not trapped, on the board/list**: one ticket carries
   focus; arrows/`J K H L` move it. Modals hold focus until dismissed.

## Global (any context, no input focused)

| Key | Action |
|---|---|
| `⌘K` | Open command palette |
| `⌘Z` | Undo last mutation (paired with the toast) |
| `⌘F` | Focus the filter field (selects existing query) |
| `C` | Quick create (in the current project) |
| `Esc` | Ladder rule 4 |

## Board

| Key | Action |
|---|---|
| `↑` / `K`, `↓` / `J` | Move focus within the column |
| `←` / `H`, `→` / `L` | Move focus across columns (row index clamps) |
| `Enter` | Open focused ticket in the panel |
| `S` | Status menu, anchored to the focused card |
| `P` | Priority menu, anchored to the focused card |
| `C` | Quick create (column `+` buttons preseed that column's status) |

Focus entry: the first card of the first non-empty column on first arrow
press. A degraded card accepts focus; `Enter` opens the raw file view; the
`S`/`P` actions are inert on it. Focus order always matches the visual
order, including the board-ordering preference (ADR 0003).

## Issue list

Same as board, but `↑↓`/`J K` traverse the flat visual order across
groups; `←→`/`H L` are unbound. Group headers are not focus stops.

## Ticket panel (view mode)

| Key | Action |
|---|---|
| `Esc` | Close panel → focus returns to the originating card/row |
| `Tab` | Natural order: ID chip → archive → close → title → status → priority → labels → description → checklist rows → add-item → composer → comment¹ |
| `Enter` / `Space` on a checklist row | Toggle the item |
| `Enter` in add-item field | Append item, keep focus in the field |
| `Enter` on a meta trigger | Open that menu |

¹ The `comment` stop exists only once the composer has text (LC-107). While it
is empty there is nothing to post, so the last stop in the panel is the
composer itself and `⌘↵` is the whole of the action — a stop that could only
ever be tabbed to and not used is not a stop worth having.

The panel does not steal `↑↓` from the page scroll. `S`/`P` still work
(they target the open ticket) because the panel's ticket is the focused
ticket. There is no `A` shortcut in v0 — assignment does not exist in
local mode (ADR 0001); the key returns with team projects.

## Title editing (panel)

| Key | Action |
|---|---|
| `Enter` | Commit title (no newline) |
| `Esc` | Revert to the on-disk title, blur |

## Description editor

| Key | Action |
|---|---|
| `⌘↵` | Save → writes ticket.md, exits edit mode |
| `Esc` | Cancel edit (draft discarded; conflict banner cleared) |
| Toolbar buttons | Wrap/prefix selection (`**` `*` `` ` `` `- ` `- [ ] ` link) |

Entering edit focuses the textarea with the caret at the end. Saving or
canceling returns focus to the description block.

## Comment composer

| Key | Action |
|---|---|
| `⌘↵` | Post comment (optimistic) |
| `Esc` | Blur composer (draft kept until panel closes) |

The field names `⌘↵` in its own placeholder, because the `Comment` button that
would otherwise stand for the action is not on screen until there is text.

## Command palette

| Key | Action |
|---|---|
| Typing | Filters the current mode's rows |
| Typing a key at the root | Offers that ticket as the first row |
| `↑↓` | Move selection (wraps) |
| `Enter` | Run selection |
| `Esc` | Sub-mode → back to root; root → close |

A root query shaped like a ticket key — `LC-60`, or the bare `60`, in any
case — is looked up in the index and offered above the commands, opening
on the path a search-mode row opens on (LC-171). A prefix that is not
this project's is not a key here, because no ticket of this project
carries one, so it filters commands as any other text does.

Focus enters the input on open and returns to the pre-palette focus on
close. Disabled rows (no target ticket; `New terminal` until Phase 2) are
skipped by `Enter` but remain visible with their reason. Archive/
unarchive and board ordering have no single-key binding — the palette is
their keyboard path (per the "every pointer action has a keyboard path"
rule; the list's Archived show/hide toggle is a focusable header button).

## Quick create

| Key | Action |
|---|---|
| `Enter` | Create ticket → toast + Undo; focus moves to the new card |
| `Esc` | Cancel, focus returns |
| `Tab` | Title → status trigger → Open full editor → Create |

## Menus (status / priority / ordering / labels)

| Key | Action |
|---|---|
| `↑↓` | Cycle rows (wraps) |
| `Enter` | Pick → apply optimistically → close → focus returns to trigger/card |
| `Esc` | Close without change → focus returns |

## Modals (settings · waitlist · confirm · raw file · folder picker)

`Esc` closes (confirm dialogs cancel). `Enter` in the waitlist email field
submits. Focus enters the first meaningful control (email field, first
folder row, primary button) and returns to the opener on close. The raw
file view scrolls with the page keys; `Retry parse` is the default-focused
action.

## First launch

Welcome: `Tab` between the two buttons, `Enter` activates. Folder picker
rows: `Tab`/arrows + `Enter`. Create form: `Tab` order name → key → theme
swatches (radio group, arrows move, space selects) → Create → Back.

## Focus-return table

| Layer closed | Focus lands on |
|---|---|
| Ticket panel | The card/row that opened it (survives re-render) |
| Menu | Its trigger (meta row) or the focused card (single-key path) |
| Palette | Whatever held focus before `⌘K` |
| Quick create (created) | The new ticket's card |
| Quick create (canceled) | Prior focus |
| Settings / waitlist / confirm / raw view | The opener (gear, footer button, degraded card) |
| Folder picker (create flow) | The create form's name field |

## Not bound in v0 (deliberate)

- No chords beyond the `⌘` basics (D8: "no chords in v0").
- No `A` (assign) — D8 listed it, but v0 local mode has no assignee
  (ADR 0001); the binding is reserved for team mode.
- No drag-and-drop keyboard equivalent — reordering within a column, and
  now within a list group (LC-60), is post-v0 (LC-136 canceled); status
  moves *are* the keyboard path between columns and between groups (`S`),
  on both surfaces. So the pointer reaches no *status* the keyboard
  cannot; what it reaches that the keyboard does not is a ticket's place
  inside one, which is the thing v0 deliberately left unbound.
- `New terminal` command exists but is disabled until Phase 2.
