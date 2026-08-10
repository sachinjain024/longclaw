---
format: longclaw.ticket/v1
id: f21662cb-3e0e-4dd6-8558-438b80e2dbfe
key: LC-193
title: Ticket Checklist - After entering one checklist item, the next input row isn’t focussed
status: in_progress
priority: urgent
created_at: 2026-08-10T06:27:31.139Z
updated_at: 2026-08-10T22:32:03.099Z
---

## What it is

Focus is not lost. `TicketPanel.test.tsx` has asserted `document.activeElement`
on that field since LC-106 and it passes, and a WebKit run says the same. What
the field loses is the screen.

The add-row is the checklist's next row, so the appended item lands exactly
where the field was standing and the field moves one row down inside a pane
that does not follow it. From a panel scrolled so the field is the last thing
in it — where anyone who has just scrolled the checklist into view is typing
from — one Enter puts it under the bottom edge. The caret is still in it and
what the human is looking at is the row they just made.

Only the frame after Enter is wrong: WebKit follows the caret on the next
keystroke, so by the time the next item is typed the field is back. That is why
it reads as a focus fault rather than as scrolling.

## The fix

`addRow.ts` — the add-row follows the list down, by `scrollIntoView({ block:
"nearest" })` in a layout effect, and only when it holds focus, so an item an
external write appends never moves the page under somebody reading it. Both
add-rows use it: the panel's and the create surface's are the same object.

## What holds it

`npm run probe:checklist` — a WebKit probe, because jsdom lays nothing out and
the a11y audit cannot reach the position (only a scroll produces it, and there
is no pointer in that file). It types a checklist long enough to scroll, puts
the pane where the reporter had it, and appends two items, at four window
heights on both surfaces; it skips a height it cannot drive into that position
rather than passing on it. 56/56 checks, 8/8 sizes measured. Its `--self-test`
takes the scroll away and goes red at every size.

## Activity

<!-- longclaw:event
id: evt_2880f893
kind: create
occurred_at: 2026-08-10T06:27:31.139Z
actor:
  type: human
  id: local
-->
### You created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_68728391
kind: update
occurred_at: 2026-08-10T22:31:49.122Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: in_progress
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_28eaada2
kind: update
occurred_at: 2026-08-10T22:32:03.099Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: description
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->
