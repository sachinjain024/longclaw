---
format: longclaw.ticket/v1
id: d967df78-e663-4d22-8991-c49ec134eb79
key: LC-222
title: Implement Right Click Context Menu on Tickets
status: done
priority: urgent
labels:
  - design
created_at: 2026-08-12T12:00:56.769Z
updated_at: 2026-08-21T13:47:47.005Z
---

Quick Actions like
- Move to and then Sub-Menu with List of Status
- Change Priority
- Copy File Path

What else?

## Activity

<!-- longclaw:event
id: evt_cad76452
kind: create
occurred_at: 2026-08-12T12:00:56.769Z
actor:
  type: human
  id: local
-->
### You created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_953373f7
kind: update
occurred_at: 2026-08-21T13:30:54.641Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: in_review
-->
### Claude Code updated this ticket

Right-click on a card or a row opens a menu, on both surfaces, from one builder.

**What it holds, and why that answers "What else?"** — the three the ticket asks
for, plus three the app already had and had no shortcut to. The rule for the
open half of the question was: only actions that exist somewhere else already,
so the menu is a shortcut rather than a second place where things get decided.

- `Open ticket` — what the card's own click does, named, with its `⏎`.
- `Move to ▸` — the six statuses, the current one ticked, the row's hint saying
  where the ticket is now so the answer is legible without opening it.
- `Priority ▸` — the same, over the priority levels.
- `Archive ticket` / `Unarchive ticket` — named for what pressing it does. It
  goes through `setArchived`, so it gets the same undo the palette's does.
- `Copy key` and `Copy file path`.

Labels were considered and left out: no surface but the panel can write them
today, so a labels submenu would be the first thing here that is not a shortcut
to something. Deleting is not offered because the app does not delete.

**A file that would not read gets two rows, not six** — `Open file` and
`Copy file path`. It has no status, no priority and no archived flag to turn
over, and its key is a directory name nothing has vetted; the path is the one
thing it does have, and most of the reason to right-click one.

**The path is the whole path.** A row carries `.longclaw/tickets/LC-1/ticket.md`,
which is the same string in every project there has ever been, so the row would
have copied something that names no file. `ticketPath()` joins the project
folder, and App raises it because neither surface holds one.

**Keyboard.** `Shift`+`F10` and `ContextMenu` open it on the focused card or
row, and Escape hands focus back to it. A pointer gesture whose contents are
only reachable with a pointer would have been a new keyboard hole in the one
part of this app that has none.

**What was shared rather than copied.** `MenuList` — the rows-of-mixed-kinds
popover with the recursive submenu — moved out of `SettingsMenu.tsx` into a file
of its own; the status and priority rows come from `metaOptions.tsx`, the same
list the panel offers; and `copyToClipboard` is now one function rather than the
three copies of `writeText`-then-toast that the path chip, the key chip and this
menu would have made.

**Two placement problems a menu with a trigger never has.** It opens where the
pointer is, so it can be asked to draw itself off the side or the bottom of the
window: `placeAtPoint` flips it back over the point, measured in a layout effect
rather than guessed from a row count. And its submenu, which CSS puts at
`left: 100%`, lands outside the window when the menu is against the right edge —
`MenuList` now measures on the way in and opens it on the other side. The gear's
own theme submenu had the same latent bug.

**Verified**: `npm run verify` green (1063 frontend tests, 43 files);
`npm run a11y:audit` green with a new A2 pair — Shift+F10 opens the menu
*focused*, and closing it returns focus to the card — and `--self-test` red on
the first of those, so the pair is not blind. Driven in WebKit by hand at the
window's right and bottom edges: both the menu and its submenu flip, and
nothing lands outside the window.

`keyboard-focus-map.md`'s § Board paragraph was rewritten **in place**, on the
same four lines, to name the two keys. The key table itself was left alone: a
seventh row would shift every pinned line under it, and ~120 source citations
name lines further down that file.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_7ce5faaf
kind: update
occurred_at: 2026-08-21T13:47:47.005Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: in_review
    to: done
-->
### Claude Code updated this ticket

The review round. Two axes ran against `main`; both found things, and one of
them was a bug the tests could not have caught.

**The board and the list had already drifted, one gesture in.** The board's
closing menu asked its roving focus for *whatever card the arrows last left
behind*; the list asked for the row that had been acted on. Same gesture, two
meanings — the drift `TicketMetaMenu` was extracted to prevent. The four pieces
each surface held (the open target, the press, the key, the anchor) are now one
`useTicketContextMenu` hook, so there is one `close()` and it asks by key.

**A second right-click drew the wrong menu.** Where the menu goes and what it
hands focus back to are both captured when it opens, and React was handing the
*same* component a new target rather than mounting a new one — so right-clicking
card B while card A's menu was up drew B's rows at A's point and would have
returned focus to A. The surfaces now key the component on the target. This one
has a test that fails without the fix (`Board.test.tsx`, `10px` vs `300px`), and
it was confirmed in WebKit: the second menu opens at 840, on the card pressed.

**The doc edit had deleted a claim four files cite.** Rewriting
`keyboard-focus-map.md`'s § Board paragraph in place cost the sentence "A
degraded card accepts focus", which `Board.tsx:383`, `Board.tsx:706`,
`IssueList.tsx:375` and two tests lean on at `:48` — and `citation-guard` was
green over it, because it pins text to a line and not a claim to a line. The
three cited lines are now restored byte for byte and the two keys are appended
to line 49, which nothing cites.

Also: `belowAnchor` in `popover.ts` is now the one piece of under-an-anchor
arithmetic, rather than `usePopoverPlacement` and the context menu each having
their own; App's archive toggle is named once instead of written twice; the
copy-path row takes the folder as an argument, so there is no branch that
quietly copies nothing; and `MenuList`'s `left` prop is `openLeft`, which says
what it holds.

**The one finding that did not hold.** The review expected WebKit to send
`contextmenu` before `mousedown`, which would have had the dismiss listener
close the menu the same press had just opened. It sends
`mousedown → contextmenu → mouseup`, driven and printed in WebKit; and even
were it the other way, the listener is attached by an effect that has not run
when the first press arrives. Checked in the same run: a press outside
dismisses, `Escape` returns focus to the card that was pressed, and the second
right-click re-places the menu.

`npm run verify` green (1064 frontend tests); `a11y:audit` green.
<!-- /longclaw:event -->
