---
format: longclaw.ticket/v1
id: 9a9ebdb4-5c27-4833-90e5-1f0234b5ed38
key: LC-245k
title: Menus open at a fixed 220px whatever is in them — size a dropdown to its own items
status: todo
priority: p2
labels:
  - frontend
  - design
created_at: 2026-09-08T06:28:13.136Z
updated_at: 2026-09-08T06:28:13.136Z
---

Every menu in the app opens at exactly **220px**, whatever is in it, because
`.menu-popover` sets `min-width: 220px` (`styles.css:4624-4636`). Measured in
WebKit against what the rows actually need:

| Menu | Rendered | Content needs | Air |
|---|---|---|---|
| Status | 220px | 136px | 84px |
| Priority | 220px | 109px | **111px** |
| Type (LC-227) | 220px | 115px | 105px |
| Labels | 220px | 166px | 54px |

The Priority menu is **more than half empty**: six rows whose longest label is
`Urgent`, in a box wide enough for a sentence. The ask is that a menu take the
width its own items need.

## The 220px is deliberate, and that is the point

It is not an accident to delete. `docs/cc_screens_diff.md` **D-4I** records the
design prototype's own value — *"Ordering menu is min 220px"* — and
[LC-124](../LC-124/ticket.md) is that row's open ticket. So this is a decision
**against** a recorded prototype value rather than a drift back towards it, and
it needs to be taken as one.

The case for taking it: 220px is a floor that was set by the one menu that
needed it. The ordering menu carries a `.menu-footnote`, and the label menu
carries the longest names a project can define; Status and Priority carry six
short words each and pay the same rent. A floor sized for the widest member of a
family is what makes the other four look unfinished.

The case against, recorded because it is real: a common width is a calmer board.
Four menus that open at four different widths off four triggers in one meta grid
is more motion than one width, and `S` and `P` on a focused card open two menus
from the same anchor — a person pressing both in sequence sees the box change
size under the pointer. A **shared** width is also what makes the popover's left
edge predictable.

A middle answer worth trying first: keep a floor, but a smaller one — wide
enough that Status and Priority differ by nothing, and let only Labels and the
ordering menu exceed it.

## This has to land with LC-124, not before it

[LC-124](../LC-124/ticket.md) is the other half of the same property: the
ordering menu renders **~466px** wide because its footnote sets the width, and
its plan is "cap the menu width and wrap the footnote". A cap and a floor are
one decision about one rule — fixing the floor without the cap leaves a menu
family whose widths range from 220 to 466, which is worse than the uniform 220
it replaces. Land them together or fold LC-124 into this.

## Constraints

- **`Menu` measures once.** LC-104 moved the labels menu's anchor to the end of
  a row that grows, and the measure-once behaviour is what covers it. A width
  that depends on content is measured at the same moment; it must not become a
  second measurement pass that reflows the popover after it is on screen.
- **Placement reads the width.** `popover.ts`'s `belowAnchor(anchor, width)`
  right-aligns a popover on its trigger for a trigger at the window's far edge,
  and the caller states the width because "measured after render would move it a
  frame late". A content-driven width has to be known before the popover is
  placed, or the gear menu walks a frame after it opens.
- **The submenu.** `fitsBeside(parentRight, width, viewportWidth)` decides
  whether a submenu hangs right or flips left, off the parent's width. A parent
  that is narrower than 220 flips later, not sooner, so this is safe — but it is
  a behaviour that changes.
- **A11y.** Nothing here may cost a row its hit area: `.menu-row` is
  `width: 100%` deliberately (LC-208 — the settings menus wrap each row, which
  took it out of the flex context and left the hover fill ending after the
  label).

## Source

Raised in review of the LC-227 prototype, 2026-09-08, alongside the trigger's
own design. Widths measured in WebKit over `styles.css` as it stands.

## Checklist

- [ ] Decide: content-driven width, a smaller shared floor, or one width for the family — against D-4I's recorded 220px <!-- longclaw:item=ck_0fb91ed2 -->
- [ ] Land with LC-124's cap and footnote wrap; a floor without a cap leaves widths ranging 220-466 <!-- longclaw:item=ck_714034cf -->
- [ ] Width is known before placement, so belowAnchor and fitsBeside still read it — no second measurement pass after paint <!-- longclaw:item=ck_99e136f0 -->
- [ ] Keep .menu-row at width 100%: LC-208 was the hover fill ending after the label <!-- longclaw:item=ck_e1075581 -->

## Activity

<!-- longclaw:event
id: evt_9e6b24cd
kind: create
occurred_at: 2026-09-08T06:28:13.136Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
