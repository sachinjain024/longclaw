---
format: longclaw.ticket/v1
id: 490fa075-d1a5-474e-be9d-b1faa320cdb8
key: LC-158
title: "LC-70 follow-ups: dangling settings IDREF, a half-applied focus rule, and four nits"
status: done
priority: p2
labels:
  - frontend
  - design
  - v0-backlog
created_at: 2026-08-06T10:08:09.554Z
updated_at: 2026-08-09T09:38:35.519Z
---

Six items the two-axis review of LC-70 surfaced and that branch deliberately
left alone. LC-70 was scoped to the two headline findings (the gear's colour
fade landing on the shared button foundation, and a test scoping itself with a
`banner` role the DOM does not have); both shipped in `ea4782f`.

Items 1 and 6 are real defects. Items 2-5 are nits, listed so they are not
rediscovered by the next review of this surface.

## Source

The `/code-review` passes over `feat/lc-70-settings-gear`, merged as `ea4782f`.

## Notes

Item 6 is repo-wide and predates LC-70; it wants its own decision rather than a
drive-by fix, because both halves touch every button in the app.

Item 4 is a genuine question, not a defect: the app's gear is a `.ghost`, so its
background already cross-fades and a snapping glyph colour would look out of
sync with it — which is why the fade was kept. The prototype has no transition
because its gear carries no shared button class at all. Pick one and record it.

## Checklist

- [x] aria-controls="project-settings" on the header gear is emitted unconditionally, but the section it names renders only while settingsOpen — a dangling IDREF when collapsed, which axe aria-valid-attr-value flags. App.test.tsx asserts the attribute in that collapsed state, pinning it into the suite. <!-- longclaw:item=ck_f0f4247f -->
- [x] .path-chip sets border: none, so it can never carry the 1px accent-human border keyboard-focus-map.md:16-17 requires of every keyboard-focused control. It shares the focus rule with the gear but gets only the ring half. <!-- longclaw:item=ck_6d60f6a3 -->
- [x] .path-chip:focus-visible sits ~35 lines from the rest of the .path-chip block, under a comment describing only the gear. Locality only, no behaviour change. <!-- longclaw:item=ck_dff2d465 -->
- [x] The header gear fades colour on hover, but the prototype .settings-btn (prototype.css:322) carries no .btn class and so has no transition at all. Decide which is right and record it. <!-- longclaw:item=ck_3cc9e5d5 -->
- [x] The LC-70 test is named "keeps starring in the sidebar and opens settings from a header gear" but asserts nothing about the sidebar; that half is covered separately. <!-- longclaw:item=ck_0c67e4eb -->
- [ ] Repo-wide, pre-existing: global button:focus-visible uses outline/outline-offset: 2px against keyboard-focus-map.md:16-17, and button:disabled fades background and border-color where components.md:32 gives that state no motion. <!-- longclaw:item=ck_c8a30d24 -->

## Activity

<!-- longclaw:event
id: evt_eea9751c
kind: create
occurred_at: 2026-08-06T10:08:09.554Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_208df28e
kind: update
occurred_at: 2026-08-09T09:31:07.671Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: done
  - field: checklist.ck_f0f4247f.checked
    from: "false"
    to: "true"
  - field: checklist.ck_6d60f6a3.checked
    from: "false"
    to: "true"
  - field: checklist.ck_dff2d465.checked
    from: "false"
    to: "true"
  - field: checklist.ck_3cc9e5d5.checked
    from: "false"
    to: "true"
  - field: checklist.ck_0c67e4eb.checked
    from: "false"
    to: "true"
  - field: checklist.ck_c8a30d24.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Five of the six were fixed here; item 6 split.

**Item 1 was already gone.** LC-125 turned settings from an inline section into
a modal, and with it the gear's `aria-controls` became `aria-haspopup="dialog"`
— there is no `aria-controls` on it to dangle, and the test that pinned the old
attribute now asserts `aria-haspopup` and a null `aria-expanded`. Checked as
resolved rather than fixed; nothing was changed for it.

**Item 2** gave `.path-chip` the border half of `components.md:32`. The 1px is
reserved transparent and paid for out of the padding — `1px 3px` where it was
`2px 4px` — so the border box is the size it was, the hover wash paints the same
(background clips to border-box, and the border is transparent), and nothing
moves 1px when the chip takes focus. That last part matters in this header
specifically: LC-149 made it a row that must not break.

**Item 3** moved `.path-chip:focus-visible` down to the rest of `.path-chip`,
which meant splitting the rule it shared with the gear. The gear and the chip
have the same treatment, not the same rule.

**Item 4** is recorded as **D16** in `docs/design/foundations/decisions.md`,
accepted as a reference divergence: the app fades the gear glyph, the prototype
does not. The prototype's gear carries no shared button class and so inherits no
transition — it never had one to keep — while the app's is a `.ghost` whose
background already cross-fades. A snapping glyph over a fading background is one
hover disagreeing with itself. The CSS comment now points at D16 from the other
side.

**Item 5** renamed the test to what it asserts: it drops the header Star button
and opens settings from a header gear. The sidebar half is covered where the
sidebar is, in § the side panel against its spec.

**Item 6 split.** Its disabled half was a one-declaration fix and is here:
`button:disabled` now carries `transition: none`, so a control becoming
unavailable stops animating its way there against the row of `components.md:32`
that gives it no motion. That declaration sits between two rules and beats
exactly one of them — the button foundation on specificity, (0,1,1) against
`.ghost`'s (0,1,0), and it ties `html.theme-transition *`, which is also (0,1,1)
because of its `html`, losing that tie to source order so a disabled control
still crossfades through a theme swap. Both halves of that are load-bearing and
the comment says so.

Its focus half is **LC-189**. It is not a find-and-replace: an outline is never
clipped and a box-shadow is, against ~20 `overflow: hidden` sites, which is the
failure the a11y audit A3 row exists to catch; and a 1px border added on focus
moves text 1px on every `border: none` control that has not reserved it. There
is also a third answer worth costing — amend the spec to accept the outline —
which would make the gear and the chip the divergences rather than the rule.

## Runs

- `npm run verify` — green.
- `npm run probe:header` — 98/98. Identity 24px, header 94px quiet and writing,
  which is the geometry-neutral claim for item 2 checked rather than asserted.
- `npm run a11y:audit` — A1-A5 pass, A3 included.
- `npm run matrix` — 8 axes × 9 states clean. The 8 AA exemptions it reports are
  the script's own WCAG 1.4.3 handling of disabled controls, and predate this.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_df3922e0
kind: update
occurred_at: 2026-08-09T09:38:35.519Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_c8a30d24.checked
    from: "true"
    to: "false"
-->
### Claude Code updated this ticket

Two corrections from /code-review over this branch.

**Item 6 is unchecked again.** The spec pass was right that the check was not earned. That item names two defects, and only one of them is fixed here: `button:disabled` no longer animates, but `button:focus-visible` still draws a 2px-offset outline where the focus contract asks for a ring plus a 1px border. LC-189 carries that half. A done ticket with one item openly handed to a successor is a truer record than a tick that says a live defect is closed, so the box goes back and this comment says why.

**`components.md:32` is the Disabled row, not Focus.** The Focus (keyboard) row is line **30**. My comment above says item 2 gave `.path-chip` "the border half of `components.md:32`" — read that as **:30**. The same error reached two CSS comments, D16 (which also had the Hover row as :29 where it is :28), and LC-189's title; all are fixed in the code and on that ticket. The `components.md:32` citations that refer to the *disabled* state — in this comment above, in `button:disabled`, and in D16 — were correct and are untouched.

Also recorded from that pass, in the `button:disabled` comment rather than here: the `transition: none` is one-directional. A transition reads the style it is going to, so arriving at disabled does not animate while leaving it still fades back through the foundation. Killing that second direction would need `:not(:disabled)` on the foundation, which out-specifies the theme crossfade and would cost 80ms swaps on every enabled button to save one fade — so it is documented, not done.

Same-file line citations in the new CSS comments were replaced with selector names after two of them rotted within this branch.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_f80327c1
kind: comment
occurred_at: 2026-08-10T04:59:15.764Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

The focus half of item 6 is **LC-191**, not LC-189. Merging this branch to `main` collided with two other tickets that had each allocated LC-189 off the same LC-188 high-water mark — the far-right-column drop filed while landing LC-166, and the design-doc citation drift on `fix/lc-189-design-doc-citations`. The pushed one keeps the key, per the rule the LC-184 collision set (`9b64629`); the focus ticket was re-filed verbatim as LC-191, with its first checklist item now carrying the `components.md:30` correction that the comment above could only make beside it. The two notes above are left as written and corrected here rather than rewritten.
<!-- /longclaw:event -->
