---
format: longclaw.ticket/v1
id: 4bed8be8-7c94-4bd8-a8dc-9f9e2e24c88c
key: LC-189
title: "Global focus treatment: an offset outline where components.md:30 asks for a ring plus a 1px accent-human border"
status: todo
priority: p2
labels:
  - frontend
  - design
  - v0-backlog
created_at: 2026-08-09T09:27:44.916Z
updated_at: 2026-08-09T09:38:13.192Z
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

- [ ] Decide between moving the global rule to the spec's ring + 1px border, and amending components.md:32 / keyboard-focus-map.md:16-17 to accept the outline. Record it in decisions.md either way. <!-- longclaw:item=ck_c48f2445 -->
- [ ] If the rule moves: audit every border:none focusable control for the 1px reserve, and every overflow:hidden ancestor for a clipped ring. <!-- longclaw:item=ck_ba5fe64f -->
- [ ] Run a11y:audit (A3 especially) and matrix against the change, and quote both. <!-- longclaw:item=ck_4a8232ec -->
- [ ] Reconcile the two local overrides - .content-header .settings-button:focus-visible and .path-chip:focus-visible - with whatever the global rule becomes. <!-- longclaw:item=ck_1a0966e2 -->

## Activity

<!-- longclaw:event
id: evt_6763287e
kind: create
occurred_at: 2026-08-09T09:27:44.916Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_bcf70a85
kind: update
occurred_at: 2026-08-09T09:38:13.192Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: title
    from: "Global focus treatment: an offset outline where components.md:32 asks for a ring plus a 1px accent-human border"
    to: "Global focus treatment: an offset outline where components.md:30 asks for a ring plus a 1px accent-human border"
  - field: description
-->
### Claude Code updated this ticket

Correcting a citation this ticket was filed with. The Focus (keyboard) row of `docs/design/foundations/components.md` is line **30**; line 32 is the Disabled row. The title and description said 32 for the focus contract and now say 30 — the `components.md:32` still in the Source section is the disabled half of LC-158's item 6 and is correct where it stands.

The first checklist item carries the same wrong number in its text ("amending components.md:32 / keyboard-focus-map.md:16-17"). The CLI can change a checklist item's state but not its wording, and the item's `longclaw:item` marker has to survive, so it is corrected here rather than rewritten there: **read that item as components.md:30**. Its `keyboard-focus-map.md:16-17` was right all along.

Found by the standards pass of /code-review over the branch that filed this.
<!-- /longclaw:event -->
