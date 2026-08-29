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
updated_at: 2026-08-29T00:01:00.519Z
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

## Open questions

- Does a double-click on the handle reset to the specified 560px? Cheap, and the only way back to the default once dragged.
- Does the handle show at all on a window too narrow for `88vw` to leave any room to drag into?

## Checklist

- [ ] Decide device-level vs per-project, and whether create mode follows the same width <!-- longclaw:item=ck_5854b715 -->
- [ ] Add a left-edge drag handle to the panel, with min and max bounds that keep the workspace clickable <!-- longclaw:item=ck_46a69acc -->
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
