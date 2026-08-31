---
format: longclaw.ticket/v1
id: 78898c9d-b123-47bb-970d-86f761c0a54b
key: LC-230
title: ⌘1…⌘9 switches to the nth project
status: in_review
priority: none
labels:
  - frontend
  - design
created_at: 2026-08-24T23:01:51.163Z
updated_at: 2026-08-31T23:14:29.474Z
---

Switching projects is pointer-only today: the sidebar row, or the palette. Give
the first nine projects a chord.

## What

`⌘1`…`⌘9` make the nth project active, counting the sidebar's **Local** section
in the order it already draws — `sortedProjects(projects)` (`App.tsx:550`),
which is the whole registry. A starred project appears twice in the sidebar but
carries one number and only one: its Local row's. The Starred section shows no
badges.

Past nine there is no shortcut and no badge — the tenth row and everything under
it are plain. `⌘0` does nothing.

Each of the first nine Local rows shows its number beside the project name, so
the chord is discoverable where it is used and not only in settings.

## Notes

- Switch through `loadProject(id)` (`App.tsx:554`), the same path the row's
  click takes, so a panel open on another project's key closes across the
  switch rather than re-aiming at a ticket that was never there (LC-188).
- `⌘` chords stay live everywhere except where the OS owns them
  (`keyboard-focus-map.md:14-15`), including while a field has focus — unlike
  the single-key shortcuts, which stand down through `keyContext.ts`. Nothing
  in a text field claims `⌘digit`, so these stay live too.
- There is no existing `⌘`+digit handler; the only `metaKey` read in `App.tsx`
  is at `App.tsx:651`.
- `keyboard-focus-map.md:171` reads "No chords beyond the `⌘` basics (D8: 'no
  chords in v0')". `⌘digit` joins `⌘K` `⌘Z` `⌘F` `⌘,` `⌘↵` as a basic; re-word
  that line rather than leaving it contradicting the table above it.
- **Two shortcut lists, and they have drifted before.** `SHORTCUTS` in
  `ProjectSettings.tsx:543` and the global-chords table at
  `keyboard-focus-map.md:29-33`. The comment above `SHORTCUTS` records that it
  once shipped missing `⌘↵` and half of board movement. Edit both in one pass.
- `keyboard-focus-map.md` is line-cited and pinned by `citation-guard`. A new
  table row *inserts* lines and shifts every citation below it — re-point
  whatever cited them, then `npm run citations:update`. Do not run `--update`
  to clear a red run; that records the drift as the new truth.
- The badge belongs in `ProjectSection`'s row (`App.tsx` ≈2470-2520), inside the
  row's `<button>` with the name. Keep it out of the accessible name or make it
  real text — LC-208 is the precedent for a glyph leaking into a row's name and
  making it announce itself twice. `aria-keyshortcuts="Meta+1"` on the row
  button is how the key itself gets announced (`GuideCard.tsx:45`, LC-71).
- The sidebar is 240px and the badge takes width from the name. Check the
  name's truncation still behaves at the longest project name the list allows.

## Checklist

- [x] ⌘1…⌘9 make the 1st–9th project of the sidebar's Local list active, through the same loadProject path a row click takes; ⌘0 and a tenth-or-later project do nothing <!-- longclaw:item=ck_0e18345a -->
- [x] The chords stay live while a text field has focus, and are refused where ⌘K and ⌘F are refused — same keyContext rule, no separate one <!-- longclaw:item=ck_49de5a7f -->
- [x] Each of the first nine Local rows shows its ⌘n badge; rows ten and up show none, Starred rows show none, and the badge does not leak into the row's accessible name <!-- longclaw:item=ck_44d5f508 -->
- [x] SHORTCUTS in ProjectSettings.tsx and the global-chords table in keyboard-focus-map.md both name it, line 171's no-chords sentence is re-worded to match, and npm run citations:check is green after re-pinning <!-- longclaw:item=ck_ef6949f7 -->
- [x] Vitest covers the handler — ⌘1, ⌘9, ⌘0, a ten-project registry, a starred project numbered once — and the badge's presence and absence <!-- longclaw:item=ck_919b6e62 -->
- [x] npm run a11y:audit and npm run verify pass, with the audit run quoted on the ticket <!-- longclaw:item=ck_3be1ccf3 -->

## Activity

<!-- longclaw:event
id: evt_51d5c8e8
kind: create
occurred_at: 2026-08-24T23:01:51.163Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_77bfd520
kind: update
occurred_at: 2026-08-31T13:49:16.022Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: in_review
  - field: checklist.ck_0e18345a.checked
    from: "false"
    to: "true"
  - field: checklist.ck_49de5a7f.checked
    from: "false"
    to: "true"
  - field: checklist.ck_44d5f508.checked
    from: "false"
    to: "true"
  - field: checklist.ck_ef6949f7.checked
    from: "false"
    to: "true"
  - field: checklist.ck_919b6e62.checked
    from: "false"
    to: "true"
  - field: checklist.ck_3be1ccf3.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_4cccaba6
kind: comment
occurred_at: 2026-08-31T13:49:38.379Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Landed on `lc-230-project-chords`.

`⌘1`…`⌘9` switch to the nth project of the sidebar's Local list, through
`loadProject` — the path a row's click takes, so a panel open on another
project's key closes across the switch (LC-188) rather than re-aiming.
`⌘0` and the tenth row and below are unbound. A starred project is numbered
once, on its Local row; the Starred section carries no badges.

`chordDigit` sits in `keyContext.ts` beside `isChord` and reads `⌘`/`Ctrl`
the same way, so being a chord it stays live inside a text field. It is
refused under `overlayOpen` — the palette, a menu, settings, quick create —
which is exactly where `⌘F` is refused. The ticket panel is deliberately not
in that set: `loadProject` closes it on the way through.

The badge is `aria-hidden` and `aria-keyshortcuts="Meta+n"` announces the key,
which is `GuideCard`'s shape (LC-71). The row still answers to just its
project's name — LC-208's trap. `PROJECT_CHORD_COUNT` is the one place the
nine lives, so the badges and the keys that answer them cannot disagree.

Both shortcut lists name it in one pass, and rule 2 and the "no chords in v0"
line no longer contradict the § Global table.

## The audit run

    npm run a11y:audit
    A1  PASS  Keyboard-only core ticket lifecycle
    A2  PASS  Focus order and focus return
    A3  PASS  Visible focus survives panels, overlays, and scroll containers
    A4  PASS  Reduced motion preserves state changes
    A5  PASS  200% zoom does not overlap or hide primary controls
    Part A passes.

`npm run verify` green: 1103 frontend tests over 43 files, 166 Rust, every
guard including `citation-guard` at 493 citations.

## The note about truncation

Measured in WebKit at `PROJECT_NAME_MAX_LENGTH` (120 characters), against the
real stylesheet at 240px: the row stays one 28px line, the name still
truncates rather than overflowing, the badge is fully inside the row, and the
name gives up exactly the badge's 13px plus its 8px flex gap.

## What the review caught, for the record

The new § Global row shifted every citation below it. The first pass matched
only the first number of each citation, so spans after a comma kept their old
values — the failure `citation-guard.mjs:92-97` documents — and `--update`
then pinned them as truth. Redone with the guard's own grammar against the
lock as it stood on `main`: 161 endpoints rather than 125, six spans repaired,
plus two bare-form references the guard cannot see at all. Also corrected a
rule-2 citation this branch had copied wrong from the `⌘,` branch.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_764593c6
kind: comment
occurred_at: 2026-08-31T14:09:15.870Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Two corrections to the entry above, and what the last review round changed.

**The truncation ceiling.** That entry named `PROJECT_NAME_MAX_LENGTH` (120) as
"the longest name the list allows". It is not the ceiling — it caps only the
create form. The real gate is Rust's `is_project_name` (`core/project.rs`),
which holds for `set_name` and for the CLI's `project init`, and `parse` checks
only that a name is non-empty, so a hand-edited `project.md` has no bound at
all. Re-measured on that basis at 120, 1,000 and 20,000 characters: byte-identical
geometry every time — row 28px, name 148px, truncated, badge inside. Once the
name overflows at all the layout stops depending on its length, because
`flex: 1` with `min-width: 0` takes its width from free space rather than from
content. The note's answer is unchanged; its stated ceiling was wrong.

**Focus after the switch.** The chord is the first keyboard-only path into
`loadProject`'s LC-188 close, and that close takes no key, because the card it
would hand focus back to belongs to the project being left. A click keeps its
anchor on the row the pointer pressed; a chord has none, so pressing it with
focus inside the panel dropped focus on `<body>` — the loss rule 3 forbids
(`keyboard-focus-map.md:16-18`). Now rescued through `focusSurface`, on the
frame after the new board commits, and only when focus was actually lost, so a
chord pressed from the sidebar leaves focus where it was.

Neither was caught by `a11y:audit`, which passes A1-A5 on every run here: it
drives a fixture with one project, so no row of it can exercise a switch. Worth
knowing before the next chord lands.

Two behaviours this branch argued in comments are now asserted, and both are
mutation-checked rather than trusted — removing the LC-188 close fails the
first, removing the focus rescue fails the second, and both pass again once
restored.

Final state: `npm run verify` green with 1105 frontend tests over 43 files,
166 Rust, `citation-guard` at 496 citations. `npm run a11y:audit` green, A1-A5.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_f0e2c9e8
kind: update
occurred_at: 2026-08-31T23:10:42.632Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: in_review
    to: todo
-->
### Claude Code updated this ticket

## UX feedback after the merge

From Sachin, on the shipped behaviour (merged as #18, `8470048`):

1. **The `⌘n` badge belongs on the left**, immediately after the coloured theme
   dot, rather than at the right-hand end of the row.
2. **Starred rows should carry the same badge as their Local row.** If `⌘6`
   appears against Project P1 under Local, the Starred section should show `⌘6`
   against it too — a Starred entry is the same row pinned to the top, not a
   separate one.

**This reverses two decisions written into this ticket's own spec**, and is
recorded here so the two do not silently disagree. The spec says "Each of the
first nine Local rows shows its number beside the project name" and, above it,
"A starred project appears twice in the sidebar but carries one number and only
one: its Local row's. The Starred section shows no badges." Checklist item 3
states the same thing as an acceptance condition. That reading treated Starred
as a second list to be counted; the feedback's reading is that it is one row
drawn twice, which is also what `sortedProjects(projects.filter(starred))`
actually builds it from.

The number itself does not change under either reading — it stays the row's
place in the Local list, which is the whole registry in draw order — so the
chord, and `keyboard-focus-map.md:34`, are unaffected. What changes is which
rows are allowed to show it, and where on the row it sits.

Re-opened to `todo` for that work.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_1672a332
kind: update
occurred_at: 2026-08-31T23:14:29.474Z
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

Both points done, on `lc-230-badge-placement`.

**Badge beside the dot.** Row order is now dot, `⌘n`, name, star, `⋮`.
Re-measured after the move rather than assumed, because the badge changed
sides: at 120 and at 20,000 characters the geometry is unchanged — row 28px,
name 148px, truncating, badge fully inside, name giving up exactly the badge's
13px plus its 8px flex gap. `flex: none` beside a `flex: 1; min-width: 0` name
behaves the same either side of it.

**Starred carries its Local number.** Project 03 is third under Local and is
the starred one, so `⌘3` now appears in both sections. The thing that had to
change to allow it: the number could no longer be the row's index in whatever
section was drawing it — under Starred, Project 03 is first and would have
claimed `⌘1`. It is a `Map<projectId, number>` now, built once from the Local
list and handed to both sections, so a project shows one number wherever it is
drawn and no row can advertise a key that lands somewhere else.

The `numbered` flag is gone with it, which also answers a smell both earlier
review rounds raised.

The chord is untouched — the number is still the row's place in Local, the
whole registry in draw order — so `keyboard-focus-map.md:34` still reads true
and no citation moved.

Three tests replace the two that pinned the old behaviour: the same badge in
both sections, the badge's position between dot and name, and the tenth row
showing neither badge nor `aria-keyshortcuts`.

`npm run verify` green with 1107 frontend tests. `npm run a11y:audit` green,
A1-A5 — though as noted above it still cannot see this: its fixture has one
project, so no row of it draws a second section or a switch.
<!-- /longclaw:event -->
