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

<!-- longclaw:event
id: evt_eb2f40e1
kind: comment
occurred_at: 2026-08-29T20:17:14.928Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

The parked item is answered, and the answer was again no — in two ways, on the other title.

The founder's report was that the field where a ticket title is entered does not match the design spec. Two fields carry that placeholder: `.panel-title`, which this ticket already fixed, and the quick create modal's `.quick-create-title`, which it left alone as "a decision rather than a fix". The second is the one that was still wrong.

The decision was put to the founder as a choice between matching the prototype and giving the field the boxed `components.md` § Inputs treatment. They chose the prototype: it stays borderless per `screen-specs.md:256`, because that modal is one field and two menus and a box around the field is a frame around nothing.

Borderless was never the whole spec, though, and both of its other halves had drifted. Measured in WebKit with the modal open (indigo light, 1440x900):

  font-weight    400, where `prototype.css:700` draws it at 500
  ::placeholder  no weight of its own
  box-shadow     0 0 0 3px, at border-radius 0
  caret          accent — correct, from the shared rule this ticket added
  text left edge 431, flush with the description — correct

The ring is the one a person sees, and it is the first thing the modal draws: the field `autoFocus`es, so opening quick create painted a hard-cornered 3px rectangle around a bare line of text with no box under it. The shared focus rule rings every field and control, which is right wherever there is a box to trace; this is the one field in the app without one, and it is now the one field that turns the ring off. Focus is carried by the accent caret instead, which is what `prototype.css:702` does and what the field foundation's third part is for (`components.md:66`). Specificity settles it — (0,2,0) against the shared rule's (0,1,1) — so unlike the panel title's focus background there is no source order to hold still.

The weight is a pair: a placeholder inherits the field's, so setting 500 without saying 400 below it would draw "Ticket title" in the medium a typed title gets — an empty modal wearing a filled one's type.

field-guard grew two cascade assertions, and a second commit made the ring's assertion state the premise it rests on: cancelling the ring is only correct while the field has no box, and a field that later grew a border under a cancelled ring would be the one field in the app with a visible edge and no focus indicator at all. The border is asked for first and the ring second, the way the title's padding and margin already are. Nine mutations, each confirmed red.

Gate: every guard, format, lint, typecheck, vite build, Rust suite and native watcher green; a11y:audit A1-A5 pass; matrix 8 axes x 12 states clean. `npm run test`'s jsdom suite is flaky in this environment independently of this change — with the change stashed it failed the same 2 of 333 on the same files, on different tests each run, all 5000ms timeouts. `styles.css` reaches that suite only through `main.tsx`, which no test renders.

Still parked, still a decision rather than a fix:
- `components.md:70-71`'s invalid state ("never colour-only (icon + text)"). Neither field states it, but they fail differently and an earlier draft of this entry got the modal wrong: the panel's title reverts silently on blur, while quick create has no `onBlur` at all and instead disables **Create** on an empty title (`QuickCreate.tsx:152,328`). Disabled-with-no-reason is the colour-only failure that line names. Behaviour, not style, in both.
- The panel title renders in the display face where the prototype used the UI face. Pre-existing and consistent with h1.

One thing this change decides rather than parks, and it should be on the record as an exception rather than left to be rediscovered as a defect:

`keyboard-focus-map.md:16-17` states the invariant as "Focus is visible, human-accent, and never lost. Keyboard focus = `--lc-focus-ring` + 1px `accent-human` border", and `components.md:65` says the same for a field. This field now has neither: the ring is cancelled here, and `border: none` makes the shared rule's `border-color: accent-human` inert. It keeps the third clause of that sentence alone — the accent caret (`components.md:66`).

That is the prototype's own behaviour (`prototype.css:702`) and it is what the founder chose, so it is not a defect; a blinking accent caret is a real focus indicator in a text field, and WCAG treats the text cursor as one. But it is the only `box-shadow: none` focus cancellation in the stylesheet, and `.panel-title` — the same ticket, also borderless — keeps its ring, so the two titles now answer the same question differently.

Two things follow. Neither doc records the carve-out, and no `a11y:audit` row asserts that a focused field paints a ring — A3 checks that focus "paints something" on a card and on a panel control, not here — so the A1-A5 pass quoted above is not evidence about this field either way. Worth a decision: either record the exception in `keyboard-focus-map.md` beside the invariant, or grow an A3 row that asserts the caret is the indicator here.
<!-- /longclaw:event -->
