---
format: longclaw.ticket/v1
id: 367328d3-58c2-4f84-8750-4764279b116b
key: LC-174
title: Drag and drop does nothing in List view, though the board works and the list passes in WebKit
status: in_progress
priority: p1
rank: Zy
labels:
  - frontend
created_at: 2026-08-07T11:01:04.566Z
updated_at: 2026-08-09T00:47:13.686Z
---

Reported after LC-60 landed: a card drags between columns on the board, and nothing happens when a row is dragged in the list.

## What is already known

**The list is not obviously broken.** `perf/drag-probe.mjs` drives a real drag with real mouse input in Playwright's WebKit — the same engine as the app's WKWebView — over the perf build of the real `App`. Both surfaces pass:

```
$ node perf/drag-probe.mjs --surface=list
surface=list order=priority row=PF-6
draggable=true
dragstart=true dragover=6 accepted=3 drop=true
while hanging over the target: {"lit":1,"line":0}
the page accepted the drop
```

So in the engine the row is draggable, the group under the pointer lights up, and the drop is accepted. Whatever stops it in the app is something the harness does not have.

**It is not the window flag.** That was LC-60's second cause and it is fixed for the whole webview: `dragDropEnabled: false` is on the main window and `release-audit` fails the build if it is flipped back. The board proves the flag works, and the list is in the same webview.

## Cheapest things to rule out first

1. **The build under test.** The list drag landed after the board fix. Confirm the running app has it: a `.list-row` should have `draggable="true"` and show a grab cursor. If it does not, the app is running older frontend code and there is no bug here.
2. **A drop inside the row's own group while the board is in Priority.** That writes nothing *by design* (ADR 0003 — a place inside a group is Manual's alone), and it is the most natural thing to try first. Dropping into a **different** group is the case that must work in both orders.
3. **Where the pointer let go.** The list refuses, on purpose: the **Archived** group, the **Unreadable** group, and the row's own group in Priority.

## Where to look after that

- `IssueList.tsx` `spotUnder`/`onDragOver` — the pointer is converted to the scroller's own content coordinates (`clientY - box.top + scrollTop`). Anything the app puts above the list that the perf harness does not — the dev-only trace strip, a different window height, a scrolled page rather than a scrolled list — changes that arithmetic. The probe runs at 1440x900 with the trace strip present, so it is close but not identical.
- `listGeometry.dropAt` — group and gap from a content offset.
- `ticketMove.takesDrop` — whether the group would write anything.

## How to see it

`node apps/desktop/perf/drag-probe.mjs --surface=list [--order=manual]`. Reading it: `dragover=0` means something between the page and the engine took the drag (that was LC-60's window flag); `accepted=0` with dragovers means the page refused every position it was asked about, which is the page's own logic; `drop=true` means the page took it.

The probe cannot drive the real Tauri window. Closing this needs someone at the machine, or a way to attach to the WKWebView.

## Not this ticket

The board is working and verified. This is the list surface only.


## Checklist

- [x] User should be able to drag and drop between columns in Grid View <!-- longclaw:item=ck_6058cae3 -->
- [x] (Grid View + Manual Ordering) User should be able to move items within columns and put cards at specific place <!-- longclaw:item=ck_81244346 -->
- [x] (List View + Any Order) User should be able to move items within Lists <!-- longclaw:item=ck_28916630 -->
- [x] (List View + Manual Order) User should be able to rearrange cards within List as well and create order by putting cards at specific places <!-- longclaw:item=ck_c50daced -->
## Activity

<!-- longclaw:event
id: evt_b61b0075
kind: create
occurred_at: 2026-08-07T11:01:04.566Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_f1c96150
kind: update
occurred_at: 2026-08-07T11:01:14.545Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: priority
    from: none
    to: p1
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_d37ebba3
kind: comment
occurred_at: 2026-08-07T14:45:50.609Z
actor:
  type: human
  id: local
-->
### You commented

In the List view, actually the drag isn’t working
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_b3419521
kind: comment
occurred_at: 2026-08-08T04:35:22.763Z
actor:
  type: human
  id: local
-->
### You commented

I can see now the drag/drop is also working in List View.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_be6913bb
kind: update
occurred_at: 2026-08-08T23:54:59.540Z
actor:
  type: human
  id: local
changes:
  - field: status
    from: todo
    to: in_progress
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_3d0a8ea9
kind: update
occurred_at: 2026-08-08T23:55:02.836Z
actor:
  type: human
  id: local
changes:
  - field: status
    from: in_progress
    to: todo
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_c7c6a139
kind: update
occurred_at: 2026-08-08T23:55:10.357Z
actor:
  type: human
  id: local
changes:
  - field: status
    from: todo
    to: in_progress
  - field: rank
    to: a0
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_3fd9e499
kind: update
occurred_at: 2026-08-08T23:55:15.009Z
actor:
  type: human
  id: local
changes:
  - field: status
    from: in_progress
    to: todo
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_4eb6c65d
kind: update
occurred_at: 2026-08-08T23:55:30.821Z
actor:
  type: human
  id: local
changes:
  - field: status
    from: todo
    to: in_progress
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_8214618e
kind: update
occurred_at: 2026-08-08T23:55:56.715Z
actor:
  type: human
  id: local
changes:
  - field: rank
    from: a0
    to: Zy
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_f57accef
kind: update
occurred_at: 2026-08-08T23:57:36.097Z
actor:
  type: human
  id: local
changes:
  - field: checklist.ck_6058cae3.added
    to: User should be able to drag and drop between columns in Grid View
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_fa9627ec
kind: update
occurred_at: 2026-08-08T23:58:25.921Z
actor:
  type: human
  id: local
changes:
  - field: checklist.ck_81244346.added
    to: (Grid View + Manual Ordering) User should be able to move items within columns and put cards at specific place
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_1f118215
kind: update
occurred_at: 2026-08-08T23:58:54.213Z
actor:
  type: human
  id: local
changes:
  - field: checklist.ck_28916630.added
    to: (List View + Any Order) User should be able to move items within Lists
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_71b59835
kind: update
occurred_at: 2026-08-08T23:59:36.181Z
actor:
  type: human
  id: local
changes:
  - field: checklist.ck_c50daced.added
    to: (List View + Manual Order) User should be able to rearrange cards within List as well and create order by putting cards at specific places
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_199845fd
kind: update
occurred_at: 2026-08-09T00:47:13.686Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_6058cae3.checked
    from: "false"
    to: "true"
  - field: checklist.ck_81244346.checked
    from: "false"
    to: "true"
  - field: checklist.ck_28916630.checked
    from: "false"
    to: "true"
  - field: checklist.ck_c50daced.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

All four rows now pass end to end in WebKit, and there is a run that says so: `npm run probe:drag` (new) drives real mouse input over the real `App` with the write commands served and reads the order back — 38/38 checks, and `--self-test` (a swallowed `dragstart`, LC-60's symptom) fails 22 of them, so it is not blind.

**Rows 1 and 3 were already working.** The board and the list both take a ticket into another column/group in either order. The original report's WebKit probe was right as far as it went; what it could not see is that accepting a drop is not the same as landing.

**Rows 2 and 4 were broken, on both surfaces, for one reason.** The pointer was never at fault — the drop line was drawn in the right gap to the pixel and `drop` fired. The *write* could not express the position: `rankForInsert` allocates a fractional index between two ranked neighbours, and ADR 0003 allocates no rank until something is dragged, so in a group where nothing has one it returned the first rank and the ticket sorted above every unranked row. A row let go three places down did not move at all; let go at the bottom of the group it jumped to the top. That is what "drag and drop does nothing" was.

**The fix, and the ADR revision it needed.** A drop now gives the tickets *above* the gap a place too — in the order they already had — and takes the one after them; everything below the gap is left unranked, because it is already where the drop says it should be. One gesture, one mutation, one Undo: the companions go out first and a failure part-way through puts back what it already wrote. ADR 0003 carries a third revision recording why the boundary case it accepted on 2026-08-07 could not stand.

Cost: bounded by where the drop is, and paid once per group. Dropping at the top writes one file, as before; dropping at the bottom of a fresh group writes the group; every later drop in it writes one file.

`npm run verify` green. `perf:board` p95 16/19/30/15ms and `perf:list` p95 16/24/24/15ms, both within budget.
<!-- /longclaw:event -->
