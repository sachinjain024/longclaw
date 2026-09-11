# LongClaw v0 — keyboard & focus map

> Phase 0, Step 2 deliverable. The complete keyboard surface of v0 and the
> focus rules that make it predictable. The shortcut set is D8
> (`../foundations/decisions.md`); this document maps it onto every context
> and specifies entry/exit focus for each surface. Live reference:
> `prototype.html`.

## Rules

1. **Every pointer action has a keyboard path.** Anything clickable is
   reachable via focus + Enter, a single-key action, or a palette command. The shell's order follows the DOM: the side panel's gear, its project rows, its footer pair, then the header's controls (LC-239w).
2. **Single-key shortcuts suspend while any input has focus.** Chords
   (`⌘K`, `⌘F`, `⌘Z`, `⌘↵`, `⌘1`…`⌘9`) stay live everywhere except where the
   OS owns them (e.g. `⌘Z` in a focused text field is the field's undo).
3. **Focus is visible, human-accent, and never lost.** Keyboard focus =
   `--lc-focus-ring` + 1px `accent-human` border (focus is a planning act).
   Closing any layer returns focus to the element that opened it.
4. **`Esc` walks the ladder one rung at a time:** menu → overlay/modal
   (palette sub-mode steps back to root first) → description or comment edit (cancel)
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
| `⌘,` | Open project settings on General; a no-op while it is already open |
| `⌘1`…`⌘9` | Switch to the nth project of the sidebar's Local list |
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
order, including the board-ordering preference (ADR 0003). `⇧F10` or `ContextMenu` opens the focused card's own menu (LC-222).

## Issue list

Same as board, but `↑↓`/`J K` traverse the flat visual order across
groups; `←→`/`H L` are unbound. Group headers are not focus stops.

## Ticket panel (view mode)

| Key | Action |
|---|---|
| `Esc` | Close panel → focus returns to the originating card/row |
| `Tab` | Natural order: ID chip → archive → close → title → status → priority → the opt-in properties the project enabled (type → estimate → start → due, LC-227) → labels → description → checklist rows (box → edit → remove, LC-215) → add-item → record tabs (one stop, `←`/`→` between Activity and Comments, LC-211) → under Comments, each of your own comments (edit → delete, LC-241q) → composer → comment¹ |
| `Enter` / `Space` · `⌥↑` / `⌥↓` on a checklist row | Toggle the item · move it one place (LC-185) |
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

## Comment composer, and a comment being rewritten

| Key | Action |
|---|---|
| `⌘↵` | Post the composer's comment (optimistic) · save a comment being rewritten in place (LC-241q) |
| `Esc` | Blur composer (draft kept until panel closes) · cancel a rewrite, leaving the words as the file has them |

The field names `⌘↵` in its own placeholder, because the `Comment` button that
would otherwise stand for the action is not on screen until there is text. A comment being rewritten names both ways out as buttons instead — **Save** and **Cancel** — because `Enter` in it has to make a newline.

## Command palette

| Key | Action |
|---|---|
| Typing | Filters the current mode's rows |
| Typing a key at the root | Offers that ticket as the first row |
| `↑↓` | Move selection (wraps) |
| `Enter` | Run selection |
| `Esc` | Sub-mode → back to root; root → close |

A root query shaped like a ticket key — `LC-60`, or the bare `60`, in any
case — names that ticket in the project's own rows and offers it above the
commands, opening on the path a search-mode row opens on (LC-171). A prefix
that is not this project's is not a key here, because no ticket of this
project carries one, so it filters commands as any other text does.

Focus enters the input on open and returns to the pre-palette focus on
close. Disabled rows (no target ticket; `New terminal` until Phase 2) are
skipped by `Enter` but remain visible with their reason. Archive/
unarchive and board ordering have no single-key binding — the palette is
their keyboard path (per the "every pointer action has a keyboard path"
rule; the list's Archived show/hide toggle is a focusable header button).

## Quick create

| Key | Action |
|---|---|
| `Enter` · `⌘↵` | Create ticket → toast + Undo; focus moves to the new card. `Enter` from the title, `⌘↵` from anywhere (a description needs its newlines) |
| `Esc` | Cancel, focus returns — as does the `esc` control at the top right, which is a button but never a tab stop |
| `Tab` | Title → description → status → priority → labels → the opt-in properties the project enabled, in the panel's order → Open full editor → Create more → Create |

## Menus (status / priority / ordering / labels / settings / project row)
| Key | Action |
|---|---|
| `↑↓` | Cycle rows, and the define row where a menu has one (wraps). Inside its name field they are the caret's, as are `j` and `k` |
| `→` `←` | Open a submenu; step back out to the row it hangs off |
| `Enter` | Pick → apply optimistically → close → focus returns to trigger/card. In the define row's field: define the label and tick it onto the draft |
| `Esc` | Close without change → focus returns. One rung a press where a define row is open: colour strip → row → menu |

## Modals (waitlist · confirm · raw file · folder picker) · settings panel

`Esc` closes (confirm dialogs cancel). `Enter` in the waitlist email field
submits. Focus enters the first meaningful control (email field, first
folder row, primary button, the asked-for settings section) and returns to
the opener on close. The settings panel sits beside a live board with no Tab
trap; the raw file view scrolls with page keys; `Retry parse` is default-focused.

## First launch

Welcome: `Tab` between the two buttons, `Enter` activates. Folder picker
rows: `Tab`/arrows + `Enter`. Create form: `Tab` order name → key → theme
swatches (radio group, arrows move, space selects) → Create → Back — `Cancel` in the side panel, whose form *is* the panel while it is open and has no step one behind it to go back to (LC-239w).

## Property controls (panel · both create surfaces)

The four opt-in properties (LC-227). `type` is a menu and answers § Menus;
`estimate` under a scale is the appearance row's segment, every cell a tab stop;
`estimate` under duration is a number field beside a unit menu, and the number
commits the way a date does.

| Key | Action |
|---|---|
| Typing | Nothing: the date grammar runs on commit and never per keystroke, so no date is refused mid-word |
| `Enter` | Commit. A refusal keeps the text, names the rule it broke, and writes nothing |
| `⌘↵` | Commit first and stop there; a second press creates. A date typed and not yet committed would otherwise be dropped by the gesture meant to keep everything |
| Blur | Commit, on the same terms |
| `↓` | Open the calendar — the trigger beside the field is a button but never a tab stop, so this is its keyboard path |

Committing hands `⌘Z` back to the toast the write raises. The caret does not
move and the text stays put, so rule 2 read alone would leave the field holding
a key the offer on screen needs (LC-220, `fieldUndo.ts`).

## The date picker (a calendar popover)

| Key | Action |
|---|---|
| `←` `→` | A day |
| `↑` `↓` | A **week** — the one thing here that no menu in the app does, and what makes this its first two-dimensional layer |
| `PageUp` `PageDown` | A month, without touching the value — and a **year** with `⇧`, clamped, so a step off 29 February lands on the 28th |
| `Home` `End` | The Monday and the Sunday of the row the cursor is on, from the same rule that lays the grid's rows out |
| `Enter` `Space` | Pick the day under the cursor → close → focus returns to the field or context-menu ticket |
| `Esc` | Close without writing → focus returns to the field or context-menu ticket. An open panel stays open |

Focus enters on the day the field resolves to, or today where it holds nothing,
and follows the cursor. The grid is 42 cells and one tab stop, roving the way a
board column does. The month steppers and **Clear** are tab stops, so the
context-menu calendar can be operated without a date field.

## Focus-return table

| Layer closed | Focus lands on |
|---|---|
| Ticket panel | The card/row that opened it (survives re-render) |
| Menu | Its trigger (meta row) or the focused card (single-key path); `Pick a date…` opens the calendar at the context menu (LC-227) |
| Date picker | The date field it hangs off, or the ticket that opened the context menu (LC-227) |
| Palette | Whatever held focus before `⌘K` |
| Quick create (created) | The new ticket's card — or, with **Create more** ticked, the emptied title field, and focus never follows the card even when the write returns (LC-201) |
| Quick create (canceled) | Prior focus |
| Settings / waitlist / confirm / raw view | The opener (the side panel's gear since LC-239w, footer button, degraded card) |
| Folder picker (create flow) | The create form's name field |

## Not bound in v0 (deliberate)

- No chords beyond the `⌘` basics in § Global (D8: "no chords in v0").
- No `A` (assign) — D8 listed it, but v0 local mode has no assignee
  (ADR 0001); the binding is reserved for team mode.
- No drag-and-drop keyboard equivalent — reordering within a column, and
  now within a list group (LC-60), is post-v0 (LC-136 canceled); status
  moves *are* the keyboard path between columns and between groups (`S`),
  on both surfaces. So the pointer reaches no *status* the keyboard
  cannot; what it reaches that the keyboard does not is a ticket's place
  inside one, which is the thing v0 deliberately left unbound.
- `New terminal` command exists but is disabled until Phase 2.
