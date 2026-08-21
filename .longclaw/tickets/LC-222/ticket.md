---
format: longclaw.ticket/v1
id: d967df78-e663-4d22-8991-c49ec134eb79
key: LC-222
title: Implement Right Click Context Menu on Tickets
status: in_review
priority: urgent
labels:
  - design
created_at: 2026-08-12T12:00:56.769Z
updated_at: 2026-08-21T13:30:54.641Z
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
