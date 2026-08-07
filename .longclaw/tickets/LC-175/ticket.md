---
format: longclaw.ticket/v1
id: 27723b31-9e26-4d11-a6d3-aa4f5eaee847
key: LC-175
title: Status dot and urgent priority mark drifted from their glyph masters
status: done
priority: none
labels:
  - frontend
created_at: 2026-08-07T13:46:26.245Z
updated_at: 2026-08-07T13:46:40.826Z
---

`StatusDot` drew r=4.4 for rings and r=4.6 for filled dots, with the filled ones carrying no stroke at all, where `assets/glyphs.svg` and `components.md` § Status both say r=5 with a 1.6 stroke — and say why: "r=5 fill + 1.6px same-color stroke, so the visual weight matches the ring". Without the stroke a filled dot rendered 9.2px against a 10.4px ring, so In Progress read lighter than the Todo beside it. Backlog's dash was retuned to `2.1 1.7` for the smaller radius against the sheet's `2.1 2.5`.

`PriorityGlyph`'s urgent mark drew the bar at 1.2 wide and the dot as a circle where the sheet draws both as rects, 1.5 wide.

Both predate this ticket — the radius arrived with `ce6599f` (Close V0-14) — and neither is recorded in `decisions.md` or `cc_screens_diff.md`, so they are drift rather than a decision. Found by `scripts/glyph-drift-guard.mjs` when `status-*` and `priority-*` were registered in it.

## Checklist

- [x] Draw StatusDot at the documented r=5 / 1.6 stroke, with the filled states keeping their stroke <!-- longclaw:item=ck_009526fa -->
- [x] Draw the urgent mark's bar and dot as the sheet's rects <!-- longclaw:item=ck_f0a2912a -->
- [x] Register status-* and priority-urgent in glyph-drift-guard.mjs so both stay put <!-- longclaw:item=ck_a57f77b3 -->

## Activity

<!-- longclaw:event
id: evt_53f43363
kind: create
occurred_at: 2026-08-07T13:46:26.245Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_9ec7c24a
kind: update
occurred_at: 2026-08-07T13:46:40.826Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: done
  - field: checklist.ck_009526fa.checked
    from: "false"
    to: "true"
  - field: checklist.ck_f0a2912a.checked
    from: "false"
    to: "true"
  - field: checklist.ck_a57f77b3.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Shipped with the LC-111 toolbar icons, because registering the six format-* marks in the new guard is what surfaced these.

**StatusDot.** One circle for all seven now: r=5, stroke 1.6, fill the only thing the state changes, and Backlog's dash back to the sheet's `2.1 2.5`. The filled states keep their stroke, which is what `components.md` § Status asks for and the reason it gives — a filled dot without it is 9.2px next to a 10.4px ring, so In Progress read lighter than the Todo beside it. Re-shot the board in WebKit to confirm the three read as one set now.

**PriorityGlyph.** The urgent mark's bar and dot are the sheet's rects. A 1.5 square at rx 0.75 is a circle drawn the same way as the bar above it rather than a second kind of shape.

**Guard.** `status-*` and `priority-urgent` are registered. Groups needed real support: one component draws seven masters, so the registry declares which attributes may vary, and the guard checks that the masters agree on everything else, that they genuinely differ on what is declared varying — a dead exemption is how a check quietly stops checking — and that the set of values the component's ternaries produce is exactly the set the masters hold. That last one is what caught the dash. Fills resolve through `styles.css` too, since `PriorityGlyph` paints from `.priority-glyph` and `.priority-glyph .mark` rather than from attributes. Nine failure modes provoked; all go red.

`priority-p1`-`p4` and `priority-none` are recorded in NOT_COPIED with their reasons rather than left unregistered — the sheet's own comment says P1-P4 must be a span, and None is the same dash re-framed into that chip.
<!-- /longclaw:event -->
