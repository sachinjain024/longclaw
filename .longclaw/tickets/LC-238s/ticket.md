---
format: longclaw.ticket/v1
id: ee362897-f304-4012-b365-bacaf4d83019
key: LC-238s
title: Make the ticket panel width adjustable, and remember it
status: todo
priority: none
labels:
  - frontend
  - design
created_at: 2026-08-29T00:01:00.519Z
updated_at: 2026-09-08T07:20:41.457Z
---

The ticket panel is a fixed 560px — `width: min(560px, 88vw)` at `styles.css:2136`, specified as **560px wide (max 88%)** at `screen-specs.md:213`. On a wide display that is a narrow column of description and timeline beside a lot of unused workspace; on a small window `88vw` is the only concession anyone gets. The width is not the reader's to choose, and a ticket with a long description or a full timeline is the case where it should be.

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

## Open questions

- Does a double-click on the handle reset to the specified 560px? Cheap, and the only way back to the default once dragged.
- Does the handle show at all on a window too narrow for `88vw` to leave any room to drag into?

## Checklist

- [ ] Decide whether create mode follows the same width (device-level vs per-project is settled: device-level, top-level in devicePreferences.ts) <!-- longclaw:item=ck_5854b715 -->
- [ ] Default width goes to 800 (or at least 660): under 660 LC-227's properties rail does not render at all <!-- longclaw:item=ck_16241882 -->
- [ ] Add a left-edge drag handle to the panel, with min and max bounds that keep the workspace clickable <!-- longclaw:item=ck_46a69acc -->
- [ ] Say whether the drag minimum may go under 660 and fold the rail away, and make the clamp on read not do it silently <!-- longclaw:item=ck_622f4eb7 -->
- [ ] Drive the width by CSS custom property during the drag; commit to state once on mouse-up <!-- longclaw:item=ck_1c028975 -->
- [ ] Persist through devicePreferences.ts, not localStorage; validate and clamp on read in adopt() <!-- longclaw:item=ck_0f3c1e05 -->
- [ ] Give the handle a keyboard path; update keyboard-focus-map.md in place and re-point citations <!-- longclaw:item=ck_95aa0ce5 -->
- [ ] Rewrite the 560px line in screen-specs.md in place; npm run citations:update <!-- longclaw:item=ck_4b2803f7 -->
- [ ] Explicit tabIndex on the handle; npm run check and npm run a11y:audit <!-- longclaw:item=ck_d3493478 -->
- [ ] npm run probe:checklist and npm run probe:drag; quote both runs <!-- longclaw:item=ck_e9d75525 -->
- [ ] npm run verify <!-- longclaw:item=ck_7257f897 -->

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
