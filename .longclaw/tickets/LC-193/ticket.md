---
format: longclaw.ticket/v1
id: f21662cb-3e0e-4dd6-8558-438b80e2dbfe
key: LC-193
title: Ticket Checklist - After entering one checklist item, the next input row isn’t focussed
status: in_review
priority: urgent
created_at: 2026-08-10T06:27:31.139Z
updated_at: 2026-08-10T22:48:59.919Z
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

## The second half, found by the review

Rapid entry is what that kept focus is *for*, and the second item of it did not
survive the first item's write. The panel refuses a second write while one is
out — one hash, one edit — and the refusal was silent: the submit handler had
already cleared the field, so the text was gone, no row appeared, and nothing
said so. A probe holding one write open for 1.2s loses both items typed through
it. To a human that is indistinguishable from a field that stopped taking input,
which is the other honest reading of this ticket's title.

## The fix

- `addRow.ts` — the add-row follows the list down, by `scrollIntoView({ block:
  "nearest" })` in a layout effect, and only when it holds focus, so an item an
  agent appends while the panel is merely open never moves the page under
  somebody reading the activity. Both add-rows use it: the panel's and the
  create surface's are the same object.
- `TicketPanel.tsx` — an item typed while a write is out is queued and sent as
  one edit the moment the disk is free, instead of being dropped. The in-flight
  flag is a ref now rather than render state, so two Enters in one frame cannot
  both find it false.

## What holds it

`npm run probe:checklist` — a WebKit probe, because jsdom lays nothing out and
the a11y audit cannot reach the position (only a scroll produces it, and there
is no pointer in that file). It types a checklist long enough to scroll, puts
the pane where the reporter had it, appends two items, and then types two more
through a single held-open write, at four window heights on both surfaces. It
skips a height it cannot drive into that position rather than passing on it, and
fails a run in which every height skipped.

    60/60 checks passed, 8/8 sizes measured

Neither claim is blind. `--self-test` takes the add-row's scroll away and goes
red at every size (8 checks); putting the old unqueued write back makes the
rapid-entry check go red at every measured panel size (4 checks).

## Also on the record

LC-200 — the root `package.json` passthroughs ate every flag, so four documented
`--self-test` commands were running as ordinary passes. Fixed here because this
ticket's own inversion could not otherwise be run as documented.

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

<!-- longclaw:event
id: evt_9fff4a47
kind: update
occurred_at: 2026-08-10T22:45:05.330Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: description
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_15373690
kind: update
occurred_at: 2026-08-10T22:48:59.919Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: in_progress
    to: in_review
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->
