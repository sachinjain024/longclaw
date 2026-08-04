---
title: "The accessibility audit against the packaged app"
product: LongClaw
status: active
backlog_id: "none — Step 16b work list, split out of plan 40 Task 5"
order: 41
owner_area: Design
release_blocking: partly — Part A blocks, Part B does not
written: 2026-08-04
applies_to: "implement/step-16b-release-hardening @ 37734c0"
depends_on: "a bundle from npm run build:app; nothing else"
---

# The accessibility audit against the packaged app

> Audit keyboard access, focus order, labels, screen-reader semantics, contrast,
> reduced motion, and zoom/text scaling.
> — `docs/mvp_plan_order.md` § Step 16b

> Accessibility and reduced-motion work is postponed to Step 16 and then
> compressed — Audit keyboard access, focus order, labels, screen-reader
> semantics, contrast, reduced motion, and zoom in Step 16 **against the criteria
> fixed in Step 1**.
> — `docs/release-risks.md:65`, the registered risk this plan exists to retire

Split out of [plan 40](40-step-16b-spec-gaps.md) Task 5 because it is the only
one of the eight that cannot be automated: it needs a human at a keyboard with
VoiceOver on. Everything else in Step 16b is closed.

## Can this wait until after the MVP?

**Partly, and the split is not a judgement call — the repo already made it.**
`docs/acceptance/release-candidate.md` § Known issues defines the release
blockers, and one of them is:

> an accessibility failure that prevents keyboard completion of the core ticket
> lifecycle

So the keyboard half blocks the MVP by the project's own rule. The screen-reader
half does not, and deferring it is defensible for a v0 local developer tool with
no users yet.

The good news is that the blocking half is the cheap half. It is not a hunt for
unknown defects — the semantics are built and partly covered (see § What exists
today), the keyboard map is normative and written, and Wave 2 closed the escape
and focus-return contract with regression tests. **Part A is verification, not
discovery**, and should take a sitting rather than a sprint.

Two conditions on deferring Part B, both cheap to honour and both there because
`release-risks.md:65` predicts exactly this compression:

1. **Give it a date and an owner**, not "after MVP". The registered risk is that
   this work gets postponed and then compressed; "later" with no date is how that
   risk lands.
2. **Anything Part B finds that prevents keyboard completion becomes Part A.**
   A screen-reader audit sometimes surfaces a focus trap rather than a naming
   problem, and a focus trap is blocking whichever pass found it.

## What exists today

Worth reading before assuming this is a blank field. The candidate record's eight
rows read "not run", but almost all of them say *"not run on the packaged app"* —
which is not the same as uncovered.

**Semantics are built.** The shipped source carries 59 `aria-label`, 24
`aria-hidden`, and `aria-expanded`, `aria-selected`, `aria-checked`,
`aria-activedescendant`, `aria-describedby`, `aria-controls`, `aria-labelledby`
and `aria-invalid` besides.

**Keyboard behaviour is specified and tested.**
[`keyboard-focus-map.md`](../../design/prototype/keyboard-focus-map.md) is
normative, including its § Focus-return table and its § Not bound in v0
(deliberate). Eleven of twelve component test files assert roles or focus, with
37 `toHaveFocus`/`activeElement` assertions between them.
[Plan 28](../completed/28-focus-and-the-escape-contract.md) closed the escape
contract with regression coverage.

**The board is not Tab-navigable, deliberately.**
[Plan 07](../completed/07-board-virtualization.md) gave the board roving
arrow/`j`-`k` focus because WebKit never put `<button>` cards in the Tab order.
Testing the board by pressing Tab therefore measures the wrong thing; the map
says what to press.

**Contrast passes, and is generated rather than eyeballed.**
[`accessibility.md`](../../design/foundations/accessibility.md) computes AA text
(≥ 4.5:1) and non-text (≥ 3:1) contrast with the same `color-mix(in oklab, …)`
math the shipped CSS uses, plus colour-vision-deficiency simulation. `npm run
matrix` fails the build on rendered contrast across 4 presets × 2 appearances ×
9 states, and carries a seven-probe interaction axis over hover, press and focus.

**Reduced motion cannot be escaped by a new token.** `src/tokens/build.mjs:292`
derives the `prefers-reduced-motion` block from the motion token group, and
`token-guard.mjs` fails the build on a literal duration outside `src/tokens/`.
Both were fixed in Step 16a after a token escaped the block.

**What none of that proves:** that any of it behaves as specified in the release
bundle, or that a screen reader makes sense of it. No row has been checked
against the packaged app, and VoiceOver has never been run.

## Preparation

```sh
npm run verify && npm run build:app
```

Then open `apps/desktop/src-tauri/target/release/bundle/macos/LongClaw.app` —
not `npm run dev`. Several rows are about the shipped bundle specifically.

Use a project with enough content to exercise scrolling and grouping;
`fixtures/representative-project` is too small. Generate one, or point the app at
a copy of a 1,000-ticket fixture as `perf:startup` does.

Record every result in a new dated candidate record, per plan 40's working rules.
**A row that is checked and fails is a finding with a severity, not a "not run".**

---

# Part A — before the MVP

Release-blocking. Each row is a pass against a written oracle, so a failure is a
defect with a spec line behind it rather than an opinion.

## A1. Keyboard-only core ticket lifecycle

Unplug the mouse, or commit to not touching it. Complete, without a pointer:
create, find, open, edit, move/reorder, search, archive, undo, and retry a failed
write.

The oracle is [`keyboard-focus-map.md`](../../design/prototype/keyboard-focus-map.md)
§ Global, § Board, § Issue list, § Ticket panel, § Command palette, § Quick
create and § Menus. Its § Not bound in v0 (deliberate) is as normative as the
tables: a key that does nothing on purpose is not a defect.

Remember the board takes arrows and `j`/`k`, not Tab.

**Blocking, by name:** a failure here is the release blocker
`release-candidate.md` § Known issues already defines.

## A2. Focus order and focus return

Check that focus order matches visible reading order in board, list, panel,
menus, palette, settings and toasts — and that focus *returns* correctly when a
surface closes.

§ Focus-return table in the keyboard map is the oracle, and it is the part most
likely to have drifted: it is a cross-surface contract, and plan 28 is the only
thing that has ever checked it end to end.

## A3. Visible focus survives panels, overlays, and scroll containers

The focus ring must be visible wherever focus can land — not clipped by a scroll
container, not painted under a panel or an overlay.

Component tests assert focus *placement*; none of them can see whether the ring
is on screen. This is the row where a jsdom suite is structurally blind, so treat
its coverage as zero.

## A4. Reduced motion

Turn on **System Settings → Accessibility → Display → Reduce motion**, then
exercise a write, a selection change, a freshness change, and a conflict.

The requirement is not "no animation": `mvp_plan_order.md` asks that meaningful
motion stay short and never be the only carrier of state. So the check is that
every state change is still legible with motion collapsed — a freshness flash
that was the *only* signal a ticket changed would fail here even though the token
block did its job.

## A5. Zoom and larger text

At 200%, primary controls must not overlap, clip, or disappear.

Establish and record which mechanism applies before testing: macOS scaled display
resolution, macOS larger text, or webview zoom if the app binds it. They stress
different things and the record should say which was used, because "200% zoom"
without a mechanism is not reproducible.

---

# Part B — deferrable past the MVP

Not release-blocking, subject to the two conditions in § Can this wait.

## B1. Accessible names with VoiceOver

Start VoiceOver (`⌘F5`) and walk buttons, menus, form fields, tabs, alerts and
status regions. Every control should announce something a user could act on.

59 `aria-label`s exist and are asserted by component tests, but a test asserts the
attribute is *present*, never that what it says is useful. This pass reads them
aloud, which is the only way that gets checked.

## B2. Screen-reader semantics for the product's own states

The states that carry LongClaw's meaning must be announced, not just visible:
the active row, ticket state, **write status**, **conflict state**, and
**degraded-file state**.

This is the row with the most product risk in it. Those four are the trust
states — they are how the app tells you a write failed, that the file changed
underneath you, or that a ticket will not parse. A user who cannot perceive them
is not told their work is at risk, which is a different order of problem from an
unlabelled button. Expect `role="status"`/`role="alert"` and live-region work
rather than labels.

## B3. Fix what B1 and B2 find

Anything that prevents keyboard completion of the lifecycle is promoted to Part A
and blocks the release.

---

## Must-pass checks

- All eight rows of `release-candidate.md` § Accessibility report carry a result
  and evidence, replacing "not run".
- Part A complete against the packaged bundle, with the project size recorded.
- The zoom mechanism named.
- `npm run verify` and `npm run matrix` green after any fix.
- Any component test written for a fix fails against the unfixed build first —
  the discipline plan 37 recorded when a theme-dot test passed against the broken
  version.
- `docs/release-risks.md:65` marked retired, or explicitly narrowed to Part B with
  a date and an owner.

## Out of scope

- **Contrast.** Already generated, already passing, already gated by
  `npm run matrix`. Re-checking it by eye is not evidence.
- **Windows and Linux assistive technology.** v0 is macOS-only.
- **WCAG conformance claims.** This audit is against the criteria fixed in Step 1
  and the keyboard map, not a certification.
- **The settings modal's shape.** `screen-specs.md:250` wants a centered modal
  and the build has an inline panel; that is recorded debt from plan 32 and is a
  structural change, not an accessibility fix. Audit what is there.

## Outcome

*To be filled when the audit runs.*
