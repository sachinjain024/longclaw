---
format: longclaw.ticket/v1
id: 367328d3-58c2-4f84-8750-4764279b116b
key: LC-174
title: Drag and drop does nothing in List view, though the board works and the list passes in WebKit
status: todo
priority: p1
labels:
  - frontend
created_at: 2026-08-07T11:01:04.566Z
updated_at: 2026-08-07T11:01:14.545Z
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
