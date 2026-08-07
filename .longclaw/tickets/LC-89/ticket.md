---
format: longclaw.ticket/v1
id: 440dfa49-9a9a-4ea1-9f30-81fc548e9bd2
key: LC-89
title: Empty project — list view shows the identical full-width panel
status: done
priority: p3
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:00.956Z
updated_at: 2026-08-07T08:07:12.557Z
---

**Prototype.** List view shows a *centered equivalent*, sized to the list

**App.** List view shows the identical full-width panel

## Source

`docs/cc_screens_diff.md` — **D-26**, § Empty project, severity P3.

## Checklist

- [x] Acceptable, but the panel should sit inside the list's card frame rather than replacing it. <!-- longclaw:item=ck_d1352e59 -->

## Activity

<!-- longclaw:event
id: evt_2519c2ea
kind: create
occurred_at: 2026-08-05T15:16:00.956Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_2026d1d9
kind: update
occurred_at: 2026-08-07T08:07:12.557Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: done
  - field: checklist.ck_d1352e59.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Done. The guide sits in `.list-guide` — the `surface` card frame every group body wears — and the list stays mounted around it. The frame claims the height the list region has (`--lc-size-board-stack` less the padding the list reserves under it) and centres the invitation in it, so `states.md:34`'s "centered equivalent, sized to the list" is both words. Measured in WebKit at 1180x748: the frame is 844x368 at the top of the list region, with the invitation centred in 400px of it. One departure: the prototype's list branch (`prototype.js:640-643`) has copy of its own — "No tickets yet", the path, and a primary `New ticket` — and this reuses the board card's instead, because keeping a second wording, a second path echo and the button would have re-opened D-24 and D-25 on the surface nobody was looking at.
<!-- /longclaw:event -->
