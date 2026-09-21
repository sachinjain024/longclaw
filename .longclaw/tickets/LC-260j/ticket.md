---
format: longclaw.ticket/v1
id: b4815e57-dec4-4eb5-88bc-6f6d1a1e46f0
key: LC-260j
title: Drag to reorder projects in the sidebar, and the chords follow
status: done
priority: none
labels:
  - frontend
  - platform
  - design
type: feature
created_at: 2026-09-17T00:43:00.866Z
updated_at: 2026-09-21T10:23:47.079Z
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

## What a drop inside Starred means

Settled before the handler was written, because it is the question this ticket
said it was most likely to get wrong.

**A gesture inside a section is a statement about that section's rows, and the
row lands beside the neighbour it was let go beside — in Local as well.**
Starred draws some of Local, so the two are one list read twice: dropping
`Zebra` under `Acme` in Starred puts `Zebra` immediately under `Acme` in Local,
which may lift it over unstarred rows that were sitting between them. It has to
— the two rows a drop is let go between may have others between them, and the
gesture asked for one of the two, not for both.

What it must not do is cross a row it was **not** asked to cross, and that is
the case a section drawing a subset gets wrong. The gaps touching a row are its
own place: `Zebra` let go under the row already above it in Starred reads as
where `Zebra` already is, and honouring that as "immediately after that row"
would move it over every unstarred row in between and renumber them all. So a
landing equal to the row's own place in the section is not a move and writes
nothing — the same rule a drag that starts and changes its mind has always had,
stated in terms of the section rather than of Local.

Three consequences, all deliberate:

- **The number is the row's place in Local, either way.** A drop in Starred
  changes it, because the place in Local is what a drop in Starred decides. That
  is not a second authority over the order; it is the one authority being
  written to from a second surface.
- **A drop at the top of Starred goes above the first starred row, not above
  the whole list.** The unstarred rows above it are not rows the gesture went
  past, so `⌘1` can stay with a project the drag never touched.
- **A drag from one section into the other is refused**, by construction rather
  than by a rule: each section holds its own drag and neither accepts a row it
  did not pick up, so the row goes back where it was. Starring is a control, not
  a gesture (§ Out of scope).

## Copy deck

Settled. Every user-facing string this adds, including the ones no screen shows.
`{name}` is the project, `{n}` its new place in **Local**, `{total}` the number
of projects. Every row is new.

| Id | Kind | Where | Text |
|---|---|---|---|
| `sidebar.move.toast` | write feedback · live region | the toast stack, after a move that landed | Moved {name} to {n} of {total} · ⌘{n} |
| `sidebar.move.toast.unbound` | write feedback · live region | the same, when {n} is past the ninth place | Moved {name} to {n} of {total} · no shortcut |
| `sidebar.move.undo` | button | on that toast, as every write's is | Undo ⌘Z |
| `sidebar.row.keys` | aria-keyshortcuts | every project row that can be moved | Meta+{n} Alt+ArrowUp Alt+ArrowDown |
| `settings.shortcuts.project` | shortcut row | Settings → Shortcuts (**changed**) | Switch to the nth project in the sidebar's Local list |

Four rows need their reasoning kept:

- The toast **is** the announcement. `ToastStack` is `role="status"
  aria-live="polite"`, so the live region this ticket asks for is the one the
  app already has — a second one would announce the move twice.
- It names the **number**, not the neighbour, because the number is what the row
  now advertises and what `⌘n` will open. `no shortcut` is the tenth place said
  out loud: a row that crosses it loses its badge, and a sentence that only said
  *moved* would leave that to be discovered by pressing a key.
- `sidebar.row.keys` is the only place the reorder is advertised. It has no
  glyph, no menu row and no label — the row is its own drag handle, at 28px
  inside a 216px panel with nowhere to put a grip — so without this the only way
  to learn a focused row can be moved is to press `⌥↓` and watch.
- `settings.shortcuts.project` was *"in the sidebar"*, which was true of a list
  nobody could rearrange. The number counts **Local**, and Starred is the same
  rows pinned above it, so a reader counting from the top of the panel was
  already counting some projects twice.

## What shipped

- **`rank.ts` and `ordering.ts` were deliberately not used**, against the
  checklist item that names them. Fractional ranks exist to allocate a value
  *between* two others without rewriting the list; the registry holds a dense
  integer `order` and rewrites the list on every write anyway, so a rank here
  would allocate against nothing — and it would be a second authority over the
  order, which is the thing LC-259y's field exists to end. The vocabulary that
  was reused is `checklistOrder.ts`'s (`gapUnder`, `landingFor`, `dropEdge`),
  which the ticket body itself names as the closest analogue.
- `projectOrder.ts` decides a landing for both gestures and both sections, and
  builds the way back with it. `registry.rs` gains `move_after`, which states a
  move as a neighbour rather than an index and renumbers; it is reached by
  `move_project_after` and answers with the whole list, because a move renumbers
  everything between its two ends.
- The write goes out through `writeProjectFile`, which is the vocabulary the
  app's other project writes already use: the order is applied before the write,
  taken back if it is refused, and offered back through `⌘Z`.
- `probe:drag` gains `sidebar-local` and `sidebar-starred`, which read the
  **badges** back with the order — on this surface they are the same fact —
  and `sidebar-cross-section`, the control: a row dragged out of Starred and
  into Local must be refused, and the sidebar must be exactly as it was.
  `a11y:audit` gains **A8**, the keyboard path with no pointer in it, including
  the row that crosses the ninth place.
- `keyboard-focus-map.md` gains § The sidebar's project rows; its § Not bound in
  v0 now says which lists the unbound reorder is about.

## Checklist

- [x] Blocked on LC-259y: the stored order must exist first <!-- longclaw:item=ck_1c9c151a -->
- [x] Decide and write down what dropping inside the Starred section means <!-- longclaw:item=ck_76cae5cb -->
- [x] Drag handler on sidebar rows, reusing rank.ts / ordering.ts vocabulary <!-- longclaw:item=ck_c575e757 -->
- [x] Rebuild the chord map from the order so badge and chord move together <!-- longclaw:item=ck_bcabca2c -->
- [x] Handle crossing the ninth place: a badge is lost or gained, visibly <!-- longclaw:item=ck_d70ad1e4 -->
- [x] Keyboard path to move the focused row up and down <!-- longclaw:item=ck_d38e2908 -->
- [x] Add the rows to keyboard-focus-map.md in place; re-pin citations <!-- longclaw:item=ck_e9b6c863 -->
- [x] Explicit tabIndex on any new control (tab-order-guard) <!-- longclaw:item=ck_42afa225 -->
- [x] Persist through LC-259y's single authority; handle a write that does not land <!-- longclaw:item=ck_c32b1d7b -->
- [x] Announce the move in a live region; put the string in the copy deck <!-- longclaw:item=ck_28f96914 -->
- [x] Add a sidebar row to probe:drag and quote the run <!-- longclaw:item=ck_483b3585 -->
- [x] Run a11y:audit and quote the run <!-- longclaw:item=ck_aebaa077 -->

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

<!-- longclaw:event
id: evt_5309f26b
kind: update
occurred_at: 2026-09-21T10:23:39.533Z
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
id: evt_7632f56e
kind: update
occurred_at: 2026-09-21T10:23:46.862Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_1c9c151a.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_41f2c484
kind: update
occurred_at: 2026-09-21T10:23:46.885Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_76cae5cb.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_8a28ada8
kind: update
occurred_at: 2026-09-21T10:23:46.905Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_c575e757.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_5a7f7ea0
kind: update
occurred_at: 2026-09-21T10:23:46.922Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_bcabca2c.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_7e958f46
kind: update
occurred_at: 2026-09-21T10:23:46.939Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_d70ad1e4.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_5f05f313
kind: update
occurred_at: 2026-09-21T10:23:46.962Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_d38e2908.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_7f570804
kind: update
occurred_at: 2026-09-21T10:23:46.980Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_e9b6c863.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_10dc1768
kind: update
occurred_at: 2026-09-21T10:23:46.996Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_42afa225.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_02ba3f53
kind: update
occurred_at: 2026-09-21T10:23:47.013Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_c32b1d7b.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_0196f134
kind: update
occurred_at: 2026-09-21T10:23:47.030Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_28f96914.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_4e9707d3
kind: update
occurred_at: 2026-09-21T10:23:47.047Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_483b3585.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_569aee4e
kind: update
occurred_at: 2026-09-21T10:23:47.063Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_aebaa077.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_19a197c5
kind: update
occurred_at: 2026-09-21T10:23:47.079Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: done
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_1cbc7f97
kind: comment
occurred_at: 2026-09-21T10:24:03.180Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Built. The harness runs, quoted:

`npm run probe:drag` — 91/91 checks passed, 18 cases, WebKit. The two new rows:
`sidebar-local` dragged the first project to the foot of a ten-project list —
dragstart=true, dragover=8, accepted=8, drop=true, one insertion line — and read
back `Fixture 02 … Fixture 10 Performance Fixture` with badges `⌘1…⌘9` and none
on the tenth. `sidebar-starred` dropped `Fixture 02` under `Fixture 05` inside
Starred and read **Local** back: `Performance Fixture, Fixture 03, Fixture 04,
Fixture 05, Fixture 02, Fixture 06…` — under the row it was let go under, over
the two rows the gesture asked it to cross and over nothing else. Both go red
under `--self-test` (4 of 6 checks each, a swallowed `dragstart`).

`npm run a11y:audit` — A1–A8 PASS. **A8** reaches a Local row in 7 Tab presses,
reads `aria-keyshortcuts="Meta+1 Alt+ArrowUp Alt+ArrowDown"` off it, moves it one
place with `⌥↓` with the badge following (`⌘1 Fixture 02, ⌘2 Performance
Fixture`) and focus staying on the row, and hears `Moved Performance Fixture to 2
of 10 · ⌘2`. Then it walks to the ninth row and steps it past the ninth place:
`⌘9 Fixture 10, (none) Fixture 09`, announced as `Moved Fixture 09 to 10 of 10 ·
no shortcut`. Under `--self-test` — `⌥`-keydowns swallowed — four of its nine
checks go red.

`npm run verify` passes, including `citations:check` (545 clean) after the focus
map gained § The sidebar's project rows: 25 citations were re-pointed and the
lock re-pinned. `panelWidth.ts` and `theme-matrix.mjs` cite `styles.css` by line
and were re-pointed too.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_c49cd378
kind: comment
occurred_at: 2026-09-21T10:36:06.564Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Review follow-ups, from /code-review's two axes.

**Standards, two hard findings, both fixed.** The `sidebar` surface had been
inserted *between* the `panel` surface's doc comment and `panel:` in
`drag-probe.mjs`, so a comment about a list with no scroller stood over the one
surface here that has one. And `checklistOrder.ts`'s header still said *what
letting go of a checklist row means* and *two surfaces* while three import it
and one draws no checklist; it now names the split — the pointer half is about
boxes, the `ChecklistMove` half stays a checklist's.

**Duplicated Code, judgement call, recorded rather than fixed.** The five drag
handlers on `ProjectSection` are a third copy of `TicketPanel`'s and
`CreatePanel`'s. A `useRowDrag` hook would collapse all three; the other two
surfaces are not this ticket's to move, so the note is at the third copy naming
the hook and the two files.

**A defect the review's own shape found.** Writing the control case, the patch
landed in `probeChecklist` rather than `probeSidebar` — the two functions have
an identical pair of checks, which is the same duplication one level up. It
referenced two bindings that function does not have. Caught by running the case.

**A control the ticket's § Out of scope earned.** A row dragged out of Starred
and into Local must be refused, and it is — by construction, each section
holding its own drag. Construction is what stops being true quietly, so
`sidebar-cross-section` now drives it in WebKit: `drop=false`, and the sidebar
exactly as it was. `probe:drag` is **94/94** with it.

**Spec.** One ticked item overstated itself: *reusing rank.ts / ordering.ts
vocabulary*. Neither is imported. § What shipped now says why — a fractional
rank allocates *between* two values without rewriting the list, and the registry
holds a dense integer `order` it rewrites on every write, so a rank would
allocate against nothing and be a second authority over the order. No finding
under (c): nothing implemented wrongly.

`npm run verify` exits 0 again; `a11y:audit` A1–A8 PASS.
<!-- /longclaw:event -->
