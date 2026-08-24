---
format: longclaw.ticket/v1
id: 78898c9d-b123-47bb-970d-86f761c0a54b
key: LC-230
title: ⌘1…⌘9 switches to the nth project
status: todo
priority: none
labels:
  - frontend
  - design
created_at: 2026-08-24T23:01:51.163Z
updated_at: 2026-08-24T23:01:51.163Z
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

- [ ] ⌘1…⌘9 make the 1st–9th project of the sidebar's Local list active, through the same loadProject path a row click takes; ⌘0 and a tenth-or-later project do nothing <!-- longclaw:item=ck_0e18345a -->
- [ ] The chords stay live while a text field has focus, and are refused where ⌘K and ⌘F are refused — same keyContext rule, no separate one <!-- longclaw:item=ck_49de5a7f -->
- [ ] Each of the first nine Local rows shows its ⌘n badge; rows ten and up show none, Starred rows show none, and the badge does not leak into the row's accessible name <!-- longclaw:item=ck_44d5f508 -->
- [ ] SHORTCUTS in ProjectSettings.tsx and the global-chords table in keyboard-focus-map.md both name it, line 171's no-chords sentence is re-worded to match, and npm run citations:check is green after re-pinning <!-- longclaw:item=ck_ef6949f7 -->
- [ ] Vitest covers the handler — ⌘1, ⌘9, ⌘0, a ten-project registry, a starred project numbered once — and the badge's presence and absence <!-- longclaw:item=ck_919b6e62 -->
- [ ] npm run a11y:audit and npm run verify pass, with the audit run quoted on the ticket <!-- longclaw:item=ck_3be1ccf3 -->

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
