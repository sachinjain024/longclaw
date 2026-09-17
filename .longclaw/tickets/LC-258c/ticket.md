---
format: longclaw.ticket/v1
id: a9c8542b-32de-4866-a237-2dc090923f76
key: LC-258c
title: Zoom the app with ⌘+, ⌘- and ⌘0
status: todo
priority: none
labels:
  - frontend
  - platform
  - design
type: feature
created_at: 2026-09-17T00:35:29.146Z
updated_at: 2026-09-17T00:35:29.146Z
---

`⌘+` and `⌘-` zoom the app in and out, and `⌘0` returns it to 100%. The level
survives a relaunch.

## The app already assumes zoom exists; nothing makes it reachable

This is the part worth knowing before starting. LongClaw is already built and
tested for a zoomed viewport, and only the way in is missing:

- `a11y:audit`'s A5 row reaches 200% by halving a 1440px viewport, because that
  is the only way it can get there today.
- `styles.css` carries a `max-width: 759px` media query whose comment says in as
  many words that the width "is what zoom produces" — `tauri.conf.json` sets
  `minWidth: 760`, so no window can be dragged that narrow. It is the one place
  LC-149's indivisible control row is allowed to break, and it exists for a
  viewport only zoom can create.
- `probe:header` measures every width from 1440 down to 760, which is the whole
  range a window has and none of the range zoom adds.

So the layout work is largely done and was done deliberately. What is absent is
the keyboard shortcut, the persistence, and the menu items. A user who wants
larger text today has no way to ask for it.

## Bind it through the existing chord convention

`keyContext.ts` holds one convention for the whole app: `isChord` reads `⌘` and
`Ctrl` alike, so "a Ctrl keyboard reaches every one of them or none". These
three go through it, not around it.

Two details the binding has to get right:

- **`⌘+` is not a key.** On a US layout the `+` is `Shift`-`=`, so the zoom-in
  chord must accept `=` as well as `+`, and must not require Shift. Other
  layouts put them elsewhere again. Bind the unshifted key and accept both.
- **`⌘0` is free, and deliberately so.** `chordDigit` matches `[1-9]` and its
  comment says `0` is excluded because "there is no zeroth row" — the project
  chords stop at 9. Zoom reset can take `⌘0` without colliding with anything,
  which is also the macOS convention.

## Zoom is a device preference, not project data

It belongs to this machine and this screen, not to a project that may be on a
shared disk. Store it in device preferences alongside the appearance and the
last-open project (ADR 0012, Rust owns the file), and validate it on read the
way every other field there is validated: a level this build does not recognise
is dropped, not carried into the store.

Read it before first render. The appearance is stamped on the root pre-render
precisely so there is no flash of the wrong theme; a frame at 100% before
jumping to 150% is the same defect.

## Bound the range and step it sensibly

Pick a fixed ladder of levels rather than a free multiplier, so that every level
is one the layout has been looked at. Suggested range 50%–200%: 200% is what the
accessibility gate already tests and what WCAG asks for, and below 50% the text
stops being readable and the setting stops being useful. `⌘-` at the floor and
`⌘+` at the ceiling do nothing rather than wrapping.

Note that at 200% on a 1440px window the viewport is 720 CSS pixels, which is
below `minWidth: 760` and inside the media query described above. That regime is
reachable by a user for the first time once this ships, so it stops being
theoretical.

## Where the zoom is applied

Tauri's webview can be zoomed from Rust. Do it there rather than by scaling CSS:
the webview names an intent and Rust decides, which is the shape every other OS
touch in this app takes, and a CSS transform on the shell would fight every
layout rule the app has. No new capability or permission is needed for a
Rust-side call.

## Also

- **The shortcuts pane must list all three.** `ProjectSettings.tsx` holds the
  table, and its own comment records that it shipped missing `⌘↵` and half of
  board movement. A shortcut absent from that pane is a shortcut nobody finds.
- **Add the View menu items too.** `Zoom In`, `Zoom Out`, `Actual Size` are
  where a macOS user looks first, and the menu is also how someone discovers the
  shortcut exists.
- `keyboard-focus-map.md` is the keyboard contract and is cited by line number.
  Add these rows in place where possible; `citation-guard` holds the cited lines
  still.
- Run `a11y:audit` — this changes key handling, which is its subject. Consider
  whether A5 should drive real zoom now that it can, rather than simulating it
  by halving the viewport.
- Run `probe:header` at the levels the ladder allows, not just the widths a
  window has. Zoom reaches viewports the probe's 1440–760 sweep never visits.
- Text fields must keep their own zoom behaviour out of the way: `⌘-` while
  typing in the filter field is still zoom, not a character.

## Out of scope

- Per-project or per-window zoom. One level for the app.
- Pinch-to-zoom and `⌘`-scroll.
- A zoom percentage control in Settings. The shortcuts and the menu are the
  surface; a slider can follow if anyone asks for it.

## Checklist

- [ ] Rust-side webview zoom; the webview names an intent, not a scale factor <!-- longclaw:item=ck_206f0998 -->
- [ ] Bind the three chords through isChord; accept = as well as + and do not require Shift <!-- longclaw:item=ck_e6df9ce5 -->
- [ ] Fixed ladder of levels, 50%-200%, no-op at both ends <!-- longclaw:item=ck_2c12d498 -->
- [ ] Persist the level in device preferences; validate on read, drop an unknown value <!-- longclaw:item=ck_c50c189f -->
- [ ] Apply before first render, as the appearance already is <!-- longclaw:item=ck_13fc0cba -->
- [ ] Add Zoom In / Zoom Out / Actual Size to the View menu <!-- longclaw:item=ck_b72c2c2d -->
- [ ] List all three rows in the shortcuts pane in ProjectSettings.tsx <!-- longclaw:item=ck_123de52d -->
- [ ] Add the rows to keyboard-focus-map.md in place; re-pin citations <!-- longclaw:item=ck_6abcb5ee -->
- [ ] Zoom chords still work while a text field has focus <!-- longclaw:item=ck_b58c28c0 -->
- [ ] Run a11y:audit; decide whether A5 should drive real zoom instead of halving the viewport <!-- longclaw:item=ck_e49e6aa3 -->
- [ ] Run probe:header at the ladder's levels, not only at window widths <!-- longclaw:item=ck_a53d6a59 -->

## Activity

<!-- longclaw:event
id: evt_262ec9f3
kind: create
occurred_at: 2026-09-17T00:35:29.146Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
