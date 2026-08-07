---
format: longclaw.ticket/v1
id: 41efeb27-f393-4489-83cd-61d5742f2860
key: LC-87
title: Empty project — guide card carries a C kbd chip and no button — A New ticket button, no kbd chip
status: done
priority: p2
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:00.920Z
updated_at: 2026-08-07T08:07:12.517Z
---

**Prototype.** Guide card carries a `C` kbd chip and no button

**App.** A `New ticket` button, no kbd chip

## Source

`docs/cc_screens_diff.md` — **D-24**, § Empty project, severity P2.

## Checklist

- [x] Swap for the kbd chip (the button is already in the header two rows up). <!-- longclaw:item=ck_9c997ff4 -->

## Activity

<!-- longclaw:event
id: evt_6788650f
kind: create
occurred_at: 2026-08-05T15:16:00.920Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_7d03f350
kind: update
occurred_at: 2026-08-07T08:07:12.517Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: done
  - field: checklist.ck_9c997ff4.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Done. The whole card is the control, as it is in the prototype (`prototype.js:591`), and the `C` chip is what it wears — the header's `New ticket` two rows up keeps the one filled accent on screen (`components.md:51`). The chip is `aria-hidden` with `aria-keyshortcuts="C"` beside it, the same trade the header button makes (LC-71), and the card carries an `aria-label` so its name is what pressing it does rather than its two lines of copy read aloud.
<!-- /longclaw:event -->
