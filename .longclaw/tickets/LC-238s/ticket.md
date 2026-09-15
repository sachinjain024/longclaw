---
format: longclaw.ticket/v1
id: ee362897-f304-4012-b365-bacaf4d83019
key: LC-238s
title: Make the ticket panel width adjustable, and remember it
status: in_progress
priority: none
labels:
  - frontend
  - design
created_at: 2026-08-29T00:01:00.519Z
updated_at: 2026-09-15T07:05:27.194Z
---

The ticket panel is a fixed 560px — `width: min(560px, 88vw)` at `styles.css:2533` (it was `styles.css:2136` when this ticket was filed; the file has moved under it since), specified as **560px wide (max 88%)** at `screen-specs.md:213`. On a wide display that is a narrow column of description and timeline beside a lot of unused workspace; on a small window `88vw` is the only concession anyone gets. The width is not the reader's to choose, and a ticket with a long description or a full timeline is the case where it should be.

Give the panel a drag handle on its left edge, and have it open at the width it was last left at.

## Where the width is remembered — not `localStorage`

The obvious home is `localStorage`, and it is the one store this app has already left. ADR 0012 moved device-local preferences into a file Rust owns (`src-tauri/src/preferences.rs`) after LC-150 and LC-151: on the packaged build the webview's storage did not survive the process, so the appearance override and the open project silently failed to come back, and *why* was never established. `webviewPreferences.ts:1-19` now reads the old keys once, never writes, and exists only to carry an upgrading dev window across that change.

So the width belongs in `devicePreferences.ts`, which is the same "remember it on this machine" behaviour with a store the suite can test. Two placements are open:

- **Top-level, beside `appearance`** — the recommendation. The panel is the same panel in every project, and its width is a property of this screen and this window rather than of the work.
- **Inside `ProjectWorkspace`** (`devicePreferences.ts:41`), beside `view`, `ordering` and `filterQuery`, if per-project widths turn out to be wanted.

Whichever, it is read through the same synchronous path: the document is read once before the first render, and the panel's initial width has to come from that read rather than from a promise that resolves a tick later — a width that arrives late is a panel that visibly snaps.

## What the change has to respect

- **`.ticket-panel` is two panels.** `TicketPanel.tsx:1170` carries the class and `CreatePanel.tsx:249` carries `ticket-panel create-panel`, so a width on the class lands on create mode too. Decide it deliberately: the same overlay in the same place jumping to a different width between viewing and creating is a flinch, so both following the stored width is probably right — but create mode having no handle of its own is also defensible.
- **The ceiling is load-bearing.** The spec has board and list staying visible and clickable behind the panel, with a click on another card retargeting it (`screen-specs.md:215-216`). A panel draggable to the full window breaks the interaction that paragraph describes. Keep a minimum that does not crush the 84px meta label column and a maximum that leaves the workspace clickable; `88vw` is the existing answer to the second and can stay.
- **The restored value is untrusted.** `adopt()` checks every field against the vocabulary this build knows and drops what it does not, because a document on disk is hand-editable. A width is a number and needs the same treatment plus a clamp on read: a 1200px width stored against a monitor that is no longer attached must not open a panel wider than today's window.
- **The drag must not re-render the panel on every frame.** `.ticket-panel` is `position: fixed`, so a resize does not reflow the board — but a width held in React state re-renders the panel's subtree, description, checklist and timeline included, on every `mousemove`. Drive a CSS custom property during the gesture and commit to state and to preferences once, on mouse-up.
- **A mouse-only handle is an incomplete control.** The panel's keyboard table is `keyboard-focus-map.md:56`; a resize that exists only under the pointer is the same gap the panel's controls had before Step 17 and its checklist rows had before LC-185. Give the handle a keyboard path, update the map **in place**, and run `npm run a11y:audit`.
- **Explicit `tabIndex`.** Any new button gets `tabIndex={0}` or `-1` or `npm run check` fails (`scripts/tab-order-guard.mjs`).
- **`screen-specs.md:213` is line-cited and pinned.** `citation-guard` holds that line to its text. Rewrite the 560px sentence **in place** rather than inserting beside it, re-point whatever cited it, then `npm run citations:update` — never `--update` to clear a red run.
- **The panel's own geometry probes.** `probe:checklist` drives the panel add-row at four window heights and `probe:drag`'s fifth case reads the panel checklist's order back; both are run against a panel whose width is now a variable. Run them and quote the runs.

## Settled 2026-09-08, in LC-227's prototype review

**The width is device-level, not per-project.** It goes top-level in
`devicePreferences.ts` beside `appearance`, which is the placement recommended
above: the panel is the same panel in every project, and its width is a property
of this screen and this window rather than of the work. A person who drags it
wide once expects it wide everywhere. `ProjectWorkspace` keeps `view`,
`ordering` and `filterQuery`; it does not get this.

**The default goes up, and it is no longer a free choice.**
[LC-227](../LC-227/ticket.md) puts a properties rail in the panel behind a
**container query at 660px** — 560 plus the rail plus the gap. Under that width
there is no rail at all and the properties fold back into the stacked meta grid.
So:

- **A default under 660px ships LC-227's rail switched off.** 560 is now a
  number that hides a feature rather than a number that is merely tight.
- **800px is LC-227's recommendation**, measured: the main column is 507px
  there, one pixel under what a 560px panel gives the description today, so the
  rail costs the reader nothing. At 720 the main column is 427px — a ~70ch
  measure, which reads fine and is a real reduction.

**Two things that were comfort limits are now decisions.** The **minimum** a
person may drag to: under 660 the rail folds away, which is either the graceful
degradation the container query was chosen for or a trap, and this ticket should
say which rather than letting the number decide. And the **clamp on read** that
this ticket already requires — a width restored against a monitor that is no
longer attached — can now land under 660 and take the rail with it, silently, on
a machine where nothing was wrong.

## Settled 2026-09-15

The four questions this ticket was carrying are answered. The two sections above
stand as written except where this one says otherwise.

**The default is `min(800px, 88vw)`.** 800 is the measured number from LC-227 and
88vw is the ceiling the panel already has, so the default reuses it rather than
introducing a second percentage. The percentage only binds under a 909px
viewport, which is where 88vw first falls below 800; above that the pixel value
always wins.

**The cap applies at paint, and never to the stored number.** This replaces the
clamp-on-read that the section above asks for:

```css
.ticket-panel { width: min(var(--ticket-panel-width, 800px), 88vw); }
```

The preference holds the width the reader chose. CSS applies the viewport cap on
every frame, so three problems stop existing rather than getting handled. A
width restored against a monitor that is no longer attached cannot open a panel
wider than the window, because the cap is in the rule. Nothing has to listen for
a resize. And an afternoon on a laptop does not cost the reader the width they
dragged on a large display, which is exactly what a clamp that wrote the reduced
value back would do — silently, and permanently.

`adopt()` still validates, because the document is hand-editable: a finite
number within 660–4000, and anything else is dropped the way every other field
is. The viewport is not its business.

**Create mode follows the same width and gets the same handle.**
`CreatePanel.tsx:249` already carries `.ticket-panel`, so the custom property
lands on both surfaces without a branch. The overlay is the same overlay in the
same place; it does not change size between viewing a ticket and creating one.

**The drag floor is 660px, and the rail never folds because someone dragged.**
Below 660 LC-227's container query drops the properties rail, and the handle may
not take a reader there. One case is left where the rail still folds and it is
not a defect: the viewport cap beats the floor under **zoom**. `tauri.conf.json:24`
sets `minWidth: 760`, so the narrowest legal window gives 88vw = 669px and the
rail survives with 9px of travel to spare — but at 200% zoom that same window is
380 CSS pixels wide, 88vw is 334, and the panel is 334px with its properties
stacked. That is the graceful degradation the container query was chosen for.

**No double-click reset.** Once the panel has been dragged there is no way back
to 800 except by eye. That is accepted, with one consequence worth writing down:
a reset belongs to a Settings row or a menu item, not to the handle, and this
ticket does not add one.

**The handle renders always, and reports when it cannot move.** Between a 760px
and a 795px window the travel between the 660 floor and the 88vw cap is under
35px, and under zoom it is nothing at all. Rather than hide the control, set
`disabled` and `aria-disabled="true"` when `88vw - 660px < 24px`: one component
at every width, and a handle that says it cannot move beats one that silently
refuses to.

## Checklist

- [x] Create mode follows the same width and gets the same handle; .ticket-panel already covers both, so no branch <!-- longclaw:item=ck_5854b715 -->
- [x] Default is min(800px, 88vw): 800 keeps LC-227's rail on, 88vw is the cap the panel already has <!-- longclaw:item=ck_16241882 -->
- [x] Apply the viewport cap in CSS — width: min(var(--ticket-panel-width, 800px), 88vw) — so no resize listener and no clamp writes back <!-- longclaw:item=ck_9fa55893 -->
- [x] Add a left-edge drag handle to the panel, with min and max bounds that keep the workspace clickable <!-- longclaw:item=ck_46a69acc -->
- [x] Handle renders at every width but sets disabled and aria-disabled when 88vw - 660px < 24px; no double-click reset <!-- longclaw:item=ck_48eb94a2 -->
- [x] Drag floor is 660px, so the rail never folds by drag; only the viewport cap may take it, under zoom <!-- longclaw:item=ck_622f4eb7 -->
- [x] Drive the width by CSS custom property during the drag; commit to state once on mouse-up <!-- longclaw:item=ck_1c028975 -->
- [x] Persist through devicePreferences.ts, not localStorage; adopt() validates a finite 660-4000 number and does not clamp to the viewport <!-- longclaw:item=ck_0f3c1e05 -->
- [x] Give the handle a keyboard path; update keyboard-focus-map.md in place and re-point citations <!-- longclaw:item=ck_95aa0ce5 -->
- [x] Rewrite the 560px line in screen-specs.md in place; npm run citations:update <!-- longclaw:item=ck_4b2803f7 -->
- [x] Explicit tabIndex on the handle; npm run check and npm run a11y:audit <!-- longclaw:item=ck_d3493478 -->
- [x] npm run probe:checklist and npm run probe:drag; quote both runs <!-- longclaw:item=ck_e9d75525 -->
- [x] npm run verify <!-- longclaw:item=ck_7257f897 -->

## Activity

<!-- longclaw:event
id: evt_73045d00
kind: create
occurred_at: 2026-08-29T00:01:00.519Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_07deab84
kind: update
occurred_at: 2026-09-08T07:20:28.189Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: description
  - field: checklist.ck_5854b715.text
    from: Decide device-level vs per-project, and whether create mode follows the same width
    to: "Decide whether create mode follows the same width (device-level vs per-project is settled: device-level, top-level in devicePreferences.ts)"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_d7eba33c
kind: update
occurred_at: 2026-09-08T07:20:34.781Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_16241882.added
    to: "Default width goes to 800 (or at least 660): under 660 LC-227's properties rail does not render at all"
  - field: checklist.ck_622f4eb7.added
    to: Say whether the drag minimum may go under 660 and fold the rail away, and make the clamp on read not do it silently
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_7c4ea737
kind: update
occurred_at: 2026-09-08T07:20:41.436Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_16241882.moved
    from: "10"
    to: "2"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_11f7d55b
kind: update
occurred_at: 2026-09-08T07:20:41.457Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_622f4eb7.moved
    from: "11"
    to: "4"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_317aecba
kind: comment
occurred_at: 2026-09-08T11:56:09.814Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

LC-227 has shipped the properties rail, and it puts a floor under the width this ticket owns.

The panel now splits on a **container query at 660px** — 560 plus the 232px rail plus the gap. Above it there is a rail; below it the properties fold back into stacked rows above the description, which is where a 560px panel has always had them. Three consequences follow, and none of them takes the number away from this ticket.

**A default under 660 ships the feature switched off.** 800 is the recommendation. The main column measures 507px there, one pixel under what a 560px panel gives the description today, so the rail costs the reader nothing. At 720 it is 427px — a ~70ch measure that reads fine, and a real reduction.

**The minimum a person may drag to stops being a comfort limit and becomes a decision.** Drag under 660 and the rail folds. That is either the graceful degradation the container query was chosen for or a trap, and this ticket should say which rather than leaving it to whatever number the handle happens to stop at.

**A clamp that lands under 660 takes the rail with it, silently.** This ticket already clamps a width restored against a monitor that is no longer attached; the new part is that the clamp can now switch a feature off with nothing on screen saying so. Worth deciding whether the clamp floor is 660 rather than whatever the window allows.

The query is on the panel and never on the viewport, which is why the width being a dragged, remembered number (devicePreferences.ts, ADR 0012) is the whole reason it works: a media query would put a rail in a 560px panel on a 27-inch display.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_7b7f16ed
kind: update
occurred_at: 2026-09-15T06:37:15.259Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: description
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_0ab0e330
kind: update
occurred_at: 2026-09-15T06:37:22.902Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_5854b715.text
    from: "Decide whether create mode follows the same width (device-level vs per-project is settled: device-level, top-level in devicePreferences.ts)"
    to: Create mode follows the same width and gets the same handle; .ticket-panel already covers both, so no branch
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_cc8b7872
kind: update
occurred_at: 2026-09-15T06:37:31.517Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_16241882.text
    from: "Default width goes to 800 (or at least 660): under 660 LC-227's properties rail does not render at all"
    to: "Default is min(800px, 88vw): 800 keeps LC-227's rail on, 88vw is the cap the panel already has"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_fb8476c2
kind: update
occurred_at: 2026-09-15T06:37:31.605Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_622f4eb7.text
    from: Say whether the drag minimum may go under 660 and fold the rail away, and make the clamp on read not do it silently
    to: Drag floor is 660px, so the rail never folds by drag; only the viewport cap may take it, under zoom
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_d328ef47
kind: update
occurred_at: 2026-09-15T06:37:31.678Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_0f3c1e05.text
    from: Persist through devicePreferences.ts, not localStorage; validate and clamp on read in adopt()
    to: Persist through devicePreferences.ts, not localStorage; adopt() validates a finite 660-4000 number and does not clamp to the viewport
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_9a06d844
kind: update
occurred_at: 2026-09-15T06:37:52.769Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_9fa55893.added
    to: "Apply the viewport cap in CSS — width: min(var(--ticket-panel-width, 800px), 88vw) — so no resize listener and no clamp writes back"
  - field: checklist.ck_48eb94a2.added
    to: Handle renders at every width but sets disabled and aria-disabled when 88vw - 660px < 24px; no double-click reset
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_dcf7515c
kind: update
occurred_at: 2026-09-15T06:37:58.958Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_9fa55893.moved
    from: "12"
    to: "3"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_0f8b53d7
kind: update
occurred_at: 2026-09-15T06:37:58.984Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_48eb94a2.moved
    from: "13"
    to: "5"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_4fc4a87a
kind: update
occurred_at: 2026-09-15T07:05:27.194Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: in_progress
  - field: checklist.ck_5854b715.checked
    from: "false"
    to: "true"
  - field: checklist.ck_16241882.checked
    from: "false"
    to: "true"
  - field: checklist.ck_9fa55893.checked
    from: "false"
    to: "true"
  - field: checklist.ck_46a69acc.checked
    from: "false"
    to: "true"
  - field: checklist.ck_48eb94a2.checked
    from: "false"
    to: "true"
  - field: checklist.ck_622f4eb7.checked
    from: "false"
    to: "true"
  - field: checklist.ck_1c028975.checked
    from: "false"
    to: "true"
  - field: checklist.ck_0f3c1e05.checked
    from: "false"
    to: "true"
  - field: checklist.ck_95aa0ce5.checked
    from: "false"
    to: "true"
  - field: checklist.ck_4b2803f7.checked
    from: "false"
    to: "true"
  - field: checklist.ck_d3493478.checked
    from: "false"
    to: "true"
  - field: checklist.ck_e9d75525.checked
    from: "false"
    to: "true"
  - field: checklist.ck_7257f897.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_83570d7f
kind: comment
occurred_at: 2026-09-15T07:05:48.653Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Implemented on `lc-238s-panel-width`. What the runs say, and the two things the work found that the ticket did not predict.

**The shape.** `panelWidth.ts` holds the numbers and the arithmetic — 800 default, 660 floor, 4000 storage ceiling, 88% cap, 16px and 64px steps — and `PanelResizeHandle.tsx` is one `role="separator"` rendered by both panels. `styles.css` draws `min(var(--panel-width, 800px), 88vw)`, and the handle is held to the panel's edge by the same expression, so the two cannot disagree about where the edge is. The property is stamped on the root in a layout effect, before the panel is painted, and restamped on every frame of a gesture; React state moves once, on mouse-up. `devicePreferences.ts` stores the width top-level beside `appearance`, validates it in `adopt()` and never clamps it to the viewport.

**Two findings.**

The stacking guard was right about a fixed element with no layer: the handle takes `--lc-z-panel`, which is the honest claim — the edge is part of the panel, so what it has to be over is exactly what the panel is over.

`a11y:audit`'s A2 row had a blind spot the handle exposed. Its Tab walk read the panel as one column and required every stop to move down or right; LC-227's rail is first in the DOM and second on screen, so the crossing from the rail back to the top of the main column is a step up the page. The row passed only because its 14-stop window stopped short of that crossing — one extra stop brought it inside, and `Edit description` was reported out of order. The check is now per column, and it also refuses a column that is left and returned to, which is the scramble the old rule was reaching for.

**Runs.**

- `npm run verify` — green.
- `npm run a11y:audit` — A1–A6 pass. New row **A6, the ticket panel's width has a keyboard path**: opens at 800 with the rail drawn, the handle is the panel's first Tab stop, `←` gives 800 → 816 → 880, twelve `⇧→` presses stop at 660 with the rail still drawn, and the next panel opens at 660. `--self-test` (the `--panel-width` property dropped on the floor) takes A6's last three checks red; the full `--self-test` run leaves A3 silent, which reproduces on `main` and is not this branch's.
- `npm run probe:checklist` — 60/60 checks, 8/8 sizes measured.
- `npm run probe:drag` — 79/79 checks, the panel checklist case included.
- `npm run matrix` — 8 axes × 12 states clean.

**Copy**, all of it new and none of it visible: `aria-label` "Panel width", `aria-valuetext` "<n> pixels". `aria-disabled` is the whole of what a window with no travel says.

**What is not here.** No reset to 800 — the decision was no double-click — so once dragged, the way back is by eye. A Settings row or a menu item is the place for it if it is ever wanted.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_78b69971
kind: comment
occurred_at: 2026-09-15T07:18:00.515Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Reviewed on both axes — standards and spec — and five findings were worth acting on. All of them were about the seams rather than the behaviour, which is the shape a review of this ticket should have had.

**Two comments were lying.** `panelWidth.ts` cited `styles.css:2914` for LC-227's container query, which this branch's own insertion had moved to 2986 — a stale line number that reads exactly like a fresh one, and `citation-guard` does not pin source-to-source citations. And `stampPanelWidth`'s comment said `restoreDevicePreferences` stamps the width at launch, which it does not: the only caller is the handle's layout effect. The behaviour is right either way — a layout effect lands before paint, so nothing snaps — but the comment described a design that was considered and dropped, because no panel is open at launch and `devicePreferences.ts` has no business touching the DOM.

**The property is now the one this ticket named.** `--ticket-panel-width`, not `--panel-width`.

**Three numbers were written twice with nothing holding them together** — the default, the 88% cap and the rail's container query, each once in `panelWidth.ts` and once in `styles.css`, and the CSS comment claimed the two "cannot disagree" while being two independent literals. `scripts/panel-width-guard.mjs` now reads both files and fails when a term moves on one side only; it is in `npm run check`. vitest cannot stand in for it — it loads no stylesheet, and a `?raw` import of one comes back empty under the CSS transform.

**The 150ms entrance was worth measuring rather than arguing about.** The review's reading was that the panel's `transform` keyframe makes the transformed panel the containing block for a `fixed` child, so the handle is offset and clipped while the panel slides in. It is the containing block — but the place is the same, because `right` resolves against a padding box as wide as the width both boxes are drawn from. Sampled in WebKit at 0, 30, 80, 140 and 400ms: the strip sat at the panel's own left edge less 5px in every frame, tracking the slide, and `elementFromPoint` at the panel's left edge answered `.panel-resize` in every one, including the first. That is in the stylesheet beside the rule now.

**One finding was declined, with the reason written into the code.** The review read the keyboard path as breaking this ticket's own rule about never reducing the stored width: a `→` press on a laptop does write the narrower number, so a remembered 1,400px can be spent there. That is the rule working rather than failing — what it forbids is a width reduced *silently*, by a display that draws less of it, and a keypress is not silent. `commit`'s comment now says so, and says the other half: a press that cannot move the edge writes nothing, so trying to widen a panel already at this window's cap leaves the wider remembered width alone.

**Two findings are noted and not changed.** The handle is a `role="separator"`, so `aria-disabled` is the whole of what it can say — a `<div>` cannot carry `disabled`, and the ARIA window-splitter pattern is the right one for a thing that reports a position. And `keyboard-focus-map.md:64` now carries two rows in one line, which is the price of the in-place rule: inserting a line would have shifted 91 citations of that document.

**Runs after the fixes.** `verify` green, `panel-width-guard` in it. `a11y:audit` A1–A6 pass; `--only=A6 --self-test` still takes A6 red. `probe:checklist` 60/60 over 8/8 sizes. `probe:drag` 79/79. One pre-existing item, unrelated to this branch and reproduced on `main`: the full `--self-test` run leaves **A3** green against its injected break, so that row's break no longer breaks what it checks.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_b2c44f03
kind: comment
occurred_at: 2026-09-15T07:35:33.646Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

The handle shipped invisible, and it should not have. It drew nothing until hover — the reasoning written beside the rule was that the panel's edge is a line in the design and a line that is already a control need not announce itself — which is a nice sentence about a control nobody can find. Reported as "I don't see the handle on the ticket panel pane".

**There is a grip now**: a 4×28 pill on the hairline, centred on the window, `--lc-ink-3` at rest and the human accent on hover and focus, alongside the hairline itself thickening. It is hidden when the window has no travel to offer, because a grip drawn where nothing can be gripped is the same defect told the other way round.

**Why a mid ink rather than the line scale**, which is what the first cut used and is what the edge is made of: the pixels this grip occupies are already painted. WebKit draws its own focus ring around the panel while the panel holds focus — which is exactly when a reader goes looking for the edge — and it is a saturated system blue, 3px outside the edge and over the hairline, the full height of the window. A grip in `--lc-line-strong` vanished into it. Measured in WebKit, light and dark, at rest and hovered; the band is on `main` too, with no handle in the code at all, so it predates this control. Filed as **LC-255x**: the outline reset at `styles.css:38-47` covers `button`, `input`, `select`, `textarea`, `[role="button"]` and `[tabindex="0"]`, and the panel is `[tabindex="-1"]`, so it keeps the platform's ring rather than the app's.

**Pinned rather than trusted.** `panel-width-guard` has a fourth claim now: `.panel-resize::after` is painted at rest, in a token, and `transparent` is named as the failure because `transparent` is exactly what the first cut had. Every test of this control asks what it *does*, in jsdom, where an invisible background is as good as any other — so the one property that decides whether a human can find it is checked where it is written.

`screen-specs.md:213` carries the grip now, rewritten in place, citations re-pinned.

Runs: `verify` green, `matrix` 8 axes × 12 states clean, `a11y:audit --only=A6` passes.
<!-- /longclaw:event -->
