---
format: longclaw.ticket/v1
id: 231dc311-6df0-48ab-9ad2-07d3534ab0ae
key: LC-243d
title: Fix the Inconsistencies with the Prototype
status: todo
priority: none
created_at: 2026-08-31T09:50:40.465Z
updated_at: 2026-09-15T15:44:35.478Z
---


## Checklist

- [x] Board and List View Switcher <!-- longclaw:item=ck_73bf8498 -->
- [x] Remove the Border around “-“ when there is no Priority. Simply Show as - <!-- longclaw:item=ck_1af0547b -->
- [ ] Ticket Panel Fields <!-- longclaw:item=ck_f9160e3b -->
- [ ] Date Field in Ticket Panel is too long. <!-- longclaw:item=ck_01be6641 -->
## Activity

<!-- longclaw:event
id: evt_af82df7b
kind: create
occurred_at: 2026-08-31T09:50:40.465Z
actor:
  type: human
  id: local
-->
### You created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_058d2a32
kind: update
occurred_at: 2026-09-15T12:18:28.269Z
actor:
  type: human
  id: local
changes:
  - field: checklist.ck_73bf8498.added
    to: Board and List View Switcher
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_dbc39ff6
kind: update
occurred_at: 2026-09-15T12:18:31.738Z
actor:
  type: human
  id: local
changes:
  - field: checklist.ck_f9160e3b.added
    to: Ticket Panel Fields
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_4fb940c4
kind: update
occurred_at: 2026-09-15T12:59:39.791Z
actor:
  type: human
  id: local
changes:
  - field: checklist.ck_1af0547b.added
    to: Remove the Border around “-“ when there is no Priority. Simply Show as -
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_4e410583
kind: update
occurred_at: 2026-09-15T13:00:10.953Z
actor:
  type: human
  id: local
changes:
  - field: checklist.ck_01be6641.added
    to: Date Field in Ticket Panel is too long.
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_415ebae9
kind: update
occurred_at: 2026-09-15T13:17:53.846Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_73bf8498.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_990d7a82
kind: comment
occurred_at: 2026-09-15T15:21:35.457Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Board and List View Switcher — shipped in PR #47: https://github.com/sachinjain024/longclaw/pull/47

The header's Board | List segment now draws the prototype's mark in front of each word and fills the pressed half with `--lc-accent-human` (`prototype.js:115-116`, `prototype.css:330-335`). The two marks are masters on `glyphs.svg` and registered with `glyph-drift-guard`, so the sheet and the component cannot drift apart.

Two decisions the review settled, recorded here because the prototype and the docs disagreed:

1. The settings dialog's Appearance and Estimate segments move with the header's. They share one rule and the prototype fills all three the same way, so scoping the change to `.view-segment` would have left the shared rule prescribing a treatment nothing used. `components.md:31` was amended in place to say so.
2. The pressed pill needed a focus ring of its own. `--lc-accent-human-ring` is the accent at 14%, and over `--lc-accent-human` it composites to exactly that fill — the ring painted an identical pixel and tabbing onto Board showed nothing. It is now drawn in `--lc-on-accent-human` at full opacity (5.6:1 at worst across the five themes × both appearances). `components.md:30` names the exception and `a11y:audit` A3 measures it.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_69ab7e78
kind: update
occurred_at: 2026-09-15T15:27:24.653Z
actor:
  type: human
  id: local
changes:
  - field: checklist.ck_1af0547b.moved
    from: "3"
    to: "2"
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_471c6976
kind: update
occurred_at: 2026-09-15T15:44:35.478Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_1af0547b.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->
