---
format: longclaw.ticket/v1
id: 490fa075-d1a5-474e-be9d-b1faa320cdb8
key: LC-158
title: "LC-70 follow-ups: dangling settings IDREF, a half-applied focus rule, and four nits"
status: todo
priority: p2
labels:
  - frontend
  - design
  - v0-backlog
created_at: 2026-08-06T10:08:09.554Z
updated_at: 2026-08-06T10:08:09.554Z
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

- [ ] aria-controls="project-settings" on the header gear is emitted unconditionally, but the section it names renders only while settingsOpen — a dangling IDREF when collapsed, which axe aria-valid-attr-value flags. App.test.tsx asserts the attribute in that collapsed state, pinning it into the suite. <!-- longclaw:item=ck_f0f4247f -->
- [ ] .path-chip sets border: none, so it can never carry the 1px accent-human border keyboard-focus-map.md:16-17 requires of every keyboard-focused control. It shares the focus rule with the gear but gets only the ring half. <!-- longclaw:item=ck_6d60f6a3 -->
- [ ] .path-chip:focus-visible sits ~35 lines from the rest of the .path-chip block, under a comment describing only the gear. Locality only, no behaviour change. <!-- longclaw:item=ck_dff2d465 -->
- [ ] The header gear fades colour on hover, but the prototype .settings-btn (prototype.css:322) carries no .btn class and so has no transition at all. Decide which is right and record it. <!-- longclaw:item=ck_3cc9e5d5 -->
- [ ] The LC-70 test is named "keeps starring in the sidebar and opens settings from a header gear" but asserts nothing about the sidebar; that half is covered separately. <!-- longclaw:item=ck_0c67e4eb -->
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
