---
format: longclaw.ticket/v1
id: 8f6f1462-edbe-4e77-bd50-03a90c750557
key: LC-255x
title: The open ticket panel wears WebKit's focus ring, not the app's
status: todo
priority: none
labels:
  - frontend
  - design
created_at: 2026-09-15T07:35:08.714Z
updated_at: 2026-09-15T07:35:08.714Z
---

The open ticket panel wears **WebKit's own focus ring**, not the app's. Every open draws a saturated system-blue band, 3px outside the panel's left edge and over the hairline, running the full height of the window.

It is a reset that does not reach. `styles.css:38-47` clears the UA outline and substitutes `--lc-focus-ring` for `button`, `input`, `select`, `textarea`, `[role="button"]` and `[tabindex="0"]`. The panel is `[tabindex="-1"]` — a programmatic focus target rather than a tab stop (`TicketPanel.tsx:1322`) — so it matches none of them and keeps `outline: auto`. `App` focuses it on open, so the ring is on screen from the first frame until focus moves into the panel's contents.

Measured on `main` in WebKit at 1440×900, sampling the column of pixels at the panel's left edge: `rgb(115, 167, 238)` at x = panel−3 … panel, from y = 0 to y = 900, in both appearances. It is not the design's ring — `--lc-accent-human-ring` is the app's, and this is the platform's blue.

Found while making LC-238s's resize handle visible: the grip lives on exactly these pixels, and a grip drawn in the line scale disappeared into the band. That is worked around there — the grip is a mid ink, which reads against the band as well as against the surfaces on either side — but the band itself is untouched and predates the handle.

Three things to settle:

- **Which surfaces the reset actually covers.** `[tabindex="-1"]` is a category the app uses deliberately — the panel takes focus on open so `Esc` and the panel's keys have somewhere to land — and every one of those is currently outside the reset. The panel is the one on screen most, but it should not be fixed alone.
- **Whether a focused panel should show anything at all.** A whole overlay taking a ring is not the same question as a control taking one: the panel is where focus *rests* between actions rather than a thing being operated, and `states.md` has no ring on it. If the answer is nothing, `outline: none` on the panel is the whole change; if the answer is something, it has to be a treatment the design owns.
- **Whether the raw-file view and the modals have the same hole.** `RawFileView` gives its `<pre>` `tabIndex={0}`, which the reset does cover, but anything else focused programmatically to hold a layer is worth checking in the same pass.

`matrix` will not catch it: its probes read declared tokens on named elements, and a UA outline is neither. A rendered check belongs with `a11y:audit`'s A3 row, which already asks whether focus paints something visible — the question it does not ask is whether what paints is *ours*.

## Checklist

- [ ] Decide what a focused overlay shows, if anything — states.md gives the panel no ring <!-- longclaw:item=ck_137a8157 -->
- [ ] Extend the outline reset to the [tabindex="-1"] surfaces, or reset the panel explicitly <!-- longclaw:item=ck_1682f91e -->
- [ ] Audit every programmatically focused surface for the same hole (panel, modals, raw-file view) <!-- longclaw:item=ck_a9844ec1 -->
- [ ] Add a rendered check: A3 asks whether focus paints something, not whether it is ours <!-- longclaw:item=ck_018dbd79 -->
- [ ] npm run verify, npm run matrix and npm run a11y:audit <!-- longclaw:item=ck_ae02dfa9 -->

## Activity

<!-- longclaw:event
id: evt_cb654bf9
kind: create
occurred_at: 2026-09-15T07:35:08.714Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
