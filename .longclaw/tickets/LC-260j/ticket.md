---
format: longclaw.ticket/v1
id: b4815e57-dec4-4eb5-88bc-6f6d1a1e46f0
key: LC-260j
title: Drag to reorder projects in the sidebar, and the chords follow
status: todo
priority: none
labels:
  - frontend
  - platform
  - design
type: feature
created_at: 2026-09-17T00:43:00.866Z
updated_at: 2026-09-17T00:43:00.866Z
---

Drag a project row in the sidebar to put it where you want it. The `⌘1`–`⌘9`
chords follow the new order, so the number a row advertises is always the number
that opens it.

## Depends on LC-259y

LC-259y replaces the sidebar's name sort with a stored order and makes
registration append. This ticket is the surface for changing that stored order
by hand, and it is the follow-on LC-259y names as out of its own scope.

Do not start this first. Without a stored order there is nothing for a drop to
write, and building the gesture against a derived order means building it twice.

## The numbers move, and that is the point

LC-259y exists because numbers moved when the user did not ask. Here the user
asks. Dragging a row to the top makes it `⌘1`, and every row it passed moves
down one.

The badge and the chord already read one map (`App.tsx:604`), which is what
keeps a row from advertising a key that lands somewhere else. Keep that. A drop
changes the order; the map is rebuilt from the order; the badge and the chord
follow together or not at all.

Two consequences to design for rather than discover:

- **A row can be dragged past the ninth place.** There are nine chords and there
  may be more projects. A row dropped tenth loses its badge, and a row dropped
  into the top nine gains one. Both are correct; both should be visible as they
  happen.
- **Starred rows are the same rows pinned to the top, not a second list.** So a
  drag inside Starred and a drag inside Local are moving the same thing, and the
  number is the row's place in Local either way. Decide explicitly what dropping
  inside the Starred section means — it is the question this ticket is most
  likely to get wrong — and say so in the ticket before writing the handler.

## This repo has been bitten by drag twice; use the harness

`npm run probe:drag` exists because jsdom drag tests answer the wrong question.
They ask whether the page accepted a drop. They cannot ask whether the row
landed where it was let go. Two defects hid behind a green `verify` here already
— LC-60, where the window flag meant the page never saw a `dragover` at all, and
LC-174, where every event was correct and the row still did not move.

So: **add a row to `probe:drag` for the sidebar** and quote the run. A new drag
surface with no probe row is a surface with the same blind spot the probe was
built to remove. The probe's own rule applies too — what it cannot reach it must
not report on, so a sidebar that scrolls needs its `visible` to mean inside the
scroller.

Reuse what is there. `rank.ts`, `ordering.ts` and `checklistOrder.ts` are the
existing vocabulary for "this thing is now between those two things", and the
checklist's order is already the order of lines in a file, which is the closest
analogue to a registry list.

## Keyboard, not only pointer

A reorder that only a mouse can perform is a feature half the contract does not
cover. `keyboard-focus-map.md` is the keyboard contract and `a11y:audit` drives
it with no pointer input anywhere in it.

Give the reorder a keyboard path — moving the focused row up and down within the
list — and add its rows to the focus map in place, re-pinning citations.
Otherwise `a11y:audit` has nothing to check and the feature is unreachable for
anyone who does not drag.

Row handles need an explicit `tabIndex`, or `npm run check` fails
(`scripts/tab-order-guard.mjs`).

## Persistence and failure

- The new order is written to the registry through the same path LC-259y
  establishes. One authority for the order, still.
- A drop that cannot be persisted must not leave the sidebar showing an order
  the file does not have. The app's write feedback already has a vocabulary for
  a write that did not land; use it rather than inventing one.
- An unreachable project is still a row and is still draggable. It has a place
  in the list whether or not its folder is plugged in.

## Also

- Announce the move. A row moving from third to first with no announcement is
  invisible to a screen reader, and the live region is copy nobody reviews
  unless it is written down. Put it in the copy deck.
- The shortcuts pane says `⌘1–9` switches to the nth project. Once the order is
  user-controlled, check that sentence still describes what happens.

## Out of scope

- Reordering by any rule other than the user's hand — no sort-by-name option, no
  most-recently-used.
- Dragging a project out of the sidebar to remove it. Removal has its own path.
- Reordering across the Starred and Local sections as a way to star or unstar.
  Starring is a control, not a gesture.

## Checklist

- [ ] Blocked on LC-259y: the stored order must exist first <!-- longclaw:item=ck_1c9c151a -->
- [ ] Decide and write down what dropping inside the Starred section means <!-- longclaw:item=ck_76cae5cb -->
- [ ] Drag handler on sidebar rows, reusing rank.ts / ordering.ts vocabulary <!-- longclaw:item=ck_c575e757 -->
- [ ] Rebuild the chord map from the order so badge and chord move together <!-- longclaw:item=ck_bcabca2c -->
- [ ] Handle crossing the ninth place: a badge is lost or gained, visibly <!-- longclaw:item=ck_d70ad1e4 -->
- [ ] Keyboard path to move the focused row up and down <!-- longclaw:item=ck_d38e2908 -->
- [ ] Add the rows to keyboard-focus-map.md in place; re-pin citations <!-- longclaw:item=ck_e9b6c863 -->
- [ ] Explicit tabIndex on any new control (tab-order-guard) <!-- longclaw:item=ck_42afa225 -->
- [ ] Persist through LC-259y's single authority; handle a write that does not land <!-- longclaw:item=ck_c32b1d7b -->
- [ ] Announce the move in a live region; put the string in the copy deck <!-- longclaw:item=ck_28f96914 -->
- [ ] Add a sidebar row to probe:drag and quote the run <!-- longclaw:item=ck_483b3585 -->
- [ ] Run a11y:audit and quote the run <!-- longclaw:item=ck_aebaa077 -->

## Activity

<!-- longclaw:event
id: evt_080efae6
kind: create
occurred_at: 2026-09-17T00:43:00.866Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
