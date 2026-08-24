---
format: longclaw.ticket/v1
id: 3e39bb56-ceaf-4410-82f9-3a03513e9439
key: LC-229
title: Is Ticket Title input following the right input style as per design system?
status: in_review
priority: urgent
labels:
  - release
created_at: 2026-08-22T06:46:07.140Z
updated_at: 2026-08-24T15:18:58.423Z
---

Filed by the founder in the app on 2026-08-22 at 06:12:40 UTC, originally allocated LC-226.

Re-filed under this key on 2026-08-22 because two sessions allocated LC-226 independently and could not see each other. The other claimant — an agent-filed ticket about single-key shortcuts firing under an open menu — reached origin/main first, so it kept the key and this one moved. Nothing of this ticket was lost but its number.

Original ticket id: b0d66537-3a79-4093-baa8-2abf432e8547

## Activity

<!-- longclaw:event
id: evt_95275614
kind: create
occurred_at: 2026-08-22T06:46:07.140Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_d351b674
kind: update
occurred_at: 2026-08-24T15:18:58.423Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: in_review
-->
### Claude Code updated this ticket

Answered by measurement, and the answer was no — in three ways, plus one that was never the title's own fault.

Driven in WebKit with the panel open, measuring the title against the meta grid beside it (light indigo, 1440x900):

  text left edge   910 where the grid starts at 901 — the title alone sat 9px in
  letter-spacing   normal, where --lc-type-title is -0.01em
  focused bg       wash, the colour of a row under the pointer
  box height       41px around a 23px line
  caret            ink

screen-specs.md:224-225 spec's the title as "borderless textarea, --lc-type-title, hover wash, focus = field treatment". Borderless is what let it drift: a box nobody can see at rest is a box nobody checks.

The indent is the one a person sees. The title is the largest text on the panel and the line the eye uses to find the left edge, and it was the only thing not on it — the meta grid, description and checklist all sit flush. The prototype cancels its padding with a negative inline margin; the app had copied the padding and not the margin.

The focus ring and accent border were already correct — an early reading that said otherwise was sampling mid-transition. Only the background was missing, and it lost to :hover because the two tie on specificity.

The caret is app-wide, not the title's: components.md:66 asks for an accent caret and no field in the product had one, so it went on the shared focus rule beside the ring and the border. CSS has no caret-width, so the spec's 1.5px is unreachable rather than skipped.

After: text at 902 (the 1px transparent border, as in the prototype), tracking -0.17px, focus on surface in both hovered and unhovered, box 33px, caret accent. Verified in both components that share the rule — the ticket panel and the create panel — and across all 8 theme x appearance axes.

field-guard grew four cascade assertions: the tracking, the padding/margin pair, the focus background and the source order that makes it beat hover, and the shared caret. Each was mutated to confirm it goes red. A first version of the padding check used a substring test and could not see a sign — it passed the LC-229 defect doubled — which review caught and the second commit fixes, along with three more blind spots of the same shape.

Gate: verify green (1072 frontend tests, Rust suite, every guard), a11y:audit A1-A5 pass, matrix 8 axes x 12 states clean, citation-guard 476 clean.

Left alone deliberately, and worth a decision rather than a fix:
- .quick-create-title stays borderless at 15px (D-47, screen-specs.md:256). Different field, different spec.
- components.md:70-71 asks for an invalid state (danger border + message, never colour-only). An empty title still reverts silently on blur. That is a behaviour change, not a style one.
- The title renders in the display face via --lc-type-title-font where the prototype used the UI face. Pre-existing and consistent with h1 and the settings headings.
<!-- /longclaw:event -->
