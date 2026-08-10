---
format: longclaw.ticket/v1
id: a70e5ac9-19fc-4f10-955c-21a476571603
key: LC-191
title: "Global focus treatment: an offset outline where components.md:30 asks for a ring plus a 1px accent-human border"
status: todo
priority: p2
labels:
  - frontend
  - design
  - v0-backlog
created_at: 2026-08-10T04:58:18.540Z
updated_at: 2026-08-10T04:58:18.540Z
---

The global focus rule (the `button:focus-visible` block near the top of
`styles.css`) gives every button, field, and
`[tabindex="0"]` an `outline: var(--lc-border-focus) solid
var(--lc-accent-human-ring)` at `outline-offset: 2px`. `components.md:30` and
`keyboard-focus-map.md:16-17` both ask for something else: `box-shadow:
var(--lc-focus-ring)` **plus** a 1px `--lc-accent-human` border on the focused
control. So the app draws the ring 2px off the control and never draws the
border, everywhere except the two places that override it locally — the content
header's gear, and the path chip since LC-158.

## Source

Item 6 of LC-158, split out at the point of fixing that ticket because the
change is repo-wide and this half wants its own decision. LC-158's other half —
`button:disabled` animating where `components.md:32` gives that state no motion
— was a one-declaration fix and shipped there.

## Notes

Two things make this bigger than a find-and-replace, and both want deciding
before any code moves.

**An outline is never clipped; a box-shadow is.** `overflow: hidden` ancestors
cut a `box-shadow` ring off and leave an `outline` alone. There are ~20
`overflow: hidden` sites in `styles.css`. A blanket switch to the spec's
`box-shadow` form therefore risks exactly the failure the a11y audit's A3 row
exists to catch — "visible focus survives panels, overlays, and scroll
containers" — and A3 would be the thing that tells us, so it has to be run
against the change rather than after it.

**A 1px border added on focus moves text 1px.** Every control that sets `border:
none` needs the border reserved transparent and paid for out of its padding, the
way `.path-chip` now does, or the label shifts when it takes focus. That is a
per-control padding audit, not a global rule.

A third option worth costing before either: keep `outline` as the ring's
mechanism and amend `components.md:30` to say so, on the grounds that an
unclippable ring is the better a11y outcome and the spec was written before the
scroll containers existed. That would make the gear and the path chip the
divergences rather than the rule.

Whichever way it goes, `npm run a11y:audit` and `npm run matrix` are the oracles
— no jsdom suite can see any of it.

## Checklist

- [ ] Decide between moving the global rule to the spec's ring + 1px border, and amending components.md:30 / keyboard-focus-map.md:16-17 to accept the outline. Record it in decisions.md either way. <!-- longclaw:item=ck_3f6a4163 -->
- [ ] If the rule moves: audit every border:none focusable control for the 1px reserve, and every overflow:hidden ancestor for a clipped ring. <!-- longclaw:item=ck_0f88abf9 -->
- [ ] Run a11y:audit (A3 especially) and matrix against the change, and quote both. <!-- longclaw:item=ck_9a62acf6 -->
- [ ] Reconcile the two local overrides - .content-header .settings-button:focus-visible and .path-chip:focus-visible - with whatever the global rule becomes. <!-- longclaw:item=ck_9da5b319 -->

## Activity

<!-- longclaw:event
id: evt_d1016b7f
kind: create
occurred_at: 2026-08-10T04:58:18.540Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_dc3f4f23
kind: comment
occurred_at: 2026-08-10T04:59:05.557Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Re-keyed from LC-189, for the same collision described on LC-190: three branches allocated LC-189 independently, and the pushed `fix/lc-189-design-doc-citations` keeps it. Same description verbatim under a new key and a new id; the LC-189 that `LC-158` hands its focus half to is this ticket.

One thing is not verbatim, and deliberately. The first checklist item still said `components.md:32` where the Focus (keyboard) row is line **30** — the original ticket could only correct it in a comment, because the CLI can change an item state but not its wording and the `longclaw:item` marker had to survive. Re-filing allocates fresh markers anyway, so the item is written with **:30** and the correction is now in the item rather than beside it. Nothing else moved.
<!-- /longclaw:event -->
