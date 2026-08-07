---
format: longclaw.ticket/v1
id: 080bba9f-81d4-438c-a08c-1d5af56c9799
key: LC-111
title: Description editor — six text glyphs (B, I, backtick, bullet, square, arrow) where the design has 24×24 icons
status: done
priority: p2
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:01.280Z
updated_at: 2026-08-07T10:04:36.417Z
---

**Prototype.** Six 24×24 **icon** buttons

**App.** Six text glyphs: `B`, `I`, `` ` ``, `•`, a small square, `↗`

## Source

`docs/cc_screens_diff.md` — **D-45**, § Description editor, severity P2.

## Checklist

- [x] Replace with icons from the foundations set. The backtick-as-code and ↗-as-link substitutions are the weakest — neither reads as its action. <!-- longclaw:item=ck_175d1a0d -->

## Activity

<!-- longclaw:event
id: evt_f0be1920
kind: create
occurred_at: 2026-08-05T15:16:01.280Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_2b486c82
kind: update
occurred_at: 2026-08-07T10:04:36.417Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: done
  - field: checklist.ck_175d1a0d.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Implemented the six foundation-style formatting icons in the description editor; verified with the full repository gate.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_f42443b6
kind: comment
occurred_at: 2026-08-07T10:54:33.000Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Where the icons live, since "the foundations set" was the ask rather than "six icons".

The six `format-*` masters are in `docs/design/foundations/assets/glyphs.svg` on its 14×14 grid, drawn in a third preview row like every other symbol there, and `components.md` gained a section naming them and their strokes.

`FormattingIcon` copies that geometry rather than referencing the sheet, which its header allows — "components must consume the `<symbol>`s (or copy the geometry) with tokens" — and strokes it `currentColor` so the button keeps its hover and disabled states, as `WarnGlyph` and `FolderGlyph` already do. It draws 1:1 at 14px inside the 24px button, so the 1.6 the sheet specifies is the stroke that renders rather than a scaled-up one, and 13–14px is where the rest of the set sits.

Copying is not a preference here — an external `<use href="…#id">` renders nothing in WebKit, the only engine this ships in, so every glyph component in this repo redraws its master. What that leaves is files that must agree with no reason they will: a curve corrected on the sheet is a docs change, the same curve in the component is an app change, and neither review sees the other. These six now exist in three places, which is where it became worth a script. `scripts/glyph-drift-guard.mjs` compares each copy's shape list, geometry and resolved stroke weights against the master — resolved, because the sheet spells 1.6 on every path, the component once on the `<svg>`, and the specimen in a CSS rule. It ignores colour, which is the one thing each copy is supposed to decide for itself, and it is pinned to the sheet: a seventh `format-*` symbol that arrives without its copies registered fails the run rather than quietly going unchecked. All seven of its failure modes were provoked to confirm it goes red.

It now covers `status-*` and `priority-urgent` too. Registering them is what found the drift they had been carrying — `StatusDot` at r=4.4/4.6 against masters that say r=5, and the urgent mark's dot drawn as a circle where the sheet draws a rect — which is its own ticket, not this one. `priority-p1`–`p4` and `priority-none` are recorded in the guard's `NOT_COPIED` with their reasons instead: the sheet's own comment says P1–P4 must render as a span so the chip takes the app's mono face, and None is that same dash re-framed into the chip.
<!-- /longclaw:event -->
