---
format: longclaw.ticket/v1
id: e0cca025-f066-4f2c-88a1-c7ba40296d15
key: LC-246j
title: Improve the design of the panel's dropdown triggers (In Progress · Urgent · Feature) — needs the specific complaint
status: todo
priority: p3
labels:
  - frontend
  - design
created_at: 2026-09-08T06:28:21.798Z
updated_at: 2026-09-08T06:28:21.798Z
---

The dropdown triggers in the ticket panel — `● In Progress ›`, `❗ Urgent ›`,
and LC-227's `● Feature ›` — should be improved "as per prototype".

**The specific complaint is not captured yet and this ticket needs it.** Raised
in review of the LC-227 prototype on 2026-09-08; what reads wrong about the
trigger was not said, and it could not be derived:

- The app already matches the design prototype on this control. `cc_screens_diff.md`
  **D-3B** (the `>` chevron) and **D-49** (the bare quick-create treatment) are
  both struck as fixed, and `create-surface-guard.mjs` pins the second.
- The LC-227 prototype renders `.menu-trigger` — the app's own class, with no
  proposed rule touching its box — so there is no difference between the two to
  read off the screen.

So the design intent has to come from the reporter before this is actionable.
**Ask: what about `● In Progress ›` reads wrong, and against what.**

## Three gaps found while looking, which are real either way

These are not the reported issue — they were found looking for it — and each is
checkable today. Any of them may be what was actually seen.

1. **The specified hover state does not exist.** `screen-specs.md` § Ticket
   panel gives the meta grid "each value a 26px menu trigger (hover `wash`)".
   There is no `:hover` rule on `.menu-trigger` anywhere in `styles.css` — the
   only rules are the base at `:4815`, `.meta-grid .menu-trigger`
   (`justify-self` alone) and `.quick-create-meta .menu-trigger` (which strips
   the box). The trigger is inert under the pointer, which is the one state that
   would say it opens something.
2. **It is 30px where the spec says 26px.** The base rule takes
   `var(--lc-size-control)`, which is 30. Every other panel control is 30 too,
   so this may be the spec that is wrong rather than the CSS — but the two
   disagree and nothing records which won.
3. **There is no open state.** `Menu.tsx:215` sets `aria-expanded`, and no rule
   reads it: the trigger looks identical whether its menu is up or down. A
   control that has visibly opened something is the cheapest confirmation the
   press landed, and this one gives none.

## Not this ticket

- **The width of the menu that drops down** — that is its own ticket, filed
  alongside this one, with the measurements.
- **Where the properties rail puts these triggers** — that is LC-227, which owns
  the panel's rail.

## Source

Raised in review of the LC-227 prototype, 2026-09-08.

## Checklist

- [ ] Get the design intent from the reporter: what reads wrong about the trigger, and against what <!-- longclaw:item=ck_859a075f -->
- [ ] The specified hover wash does not exist on .menu-trigger — add it, or record why 26px/hover in screen-specs is superseded <!-- longclaw:item=ck_3fcf0490 -->
- [ ] Settle 30px vs the spec's 26px and write the answer down on whichever side loses <!-- longclaw:item=ck_60574312 -->
- [ ] Draw an open state off aria-expanded, which Menu.tsx already sets and nothing reads <!-- longclaw:item=ck_859de7fe -->

## Activity

<!-- longclaw:event
id: evt_2cd64925
kind: create
occurred_at: 2026-09-08T06:28:21.798Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
