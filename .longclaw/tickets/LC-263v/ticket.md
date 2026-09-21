---
format: longclaw.ticket/v1
id: 40ada01d-b70f-4573-a93e-f9646eaa43a3
key: LC-263v
title: One useRowDrag hook, not three copies of the same five handlers
status: todo
priority: p3
labels:
  - frontend
created_at: 2026-09-21T12:47:45.909Z
updated_at: 2026-09-21T12:47:45.909Z
---

Three surfaces now wire a row drag by hand, with the same five handlers and the
same two pieces of state each time. Collapse them into one hook.

## Where the three copies are

- `TicketPanel.tsx` — the ticket's checklist, rows that are items on disk.
- `CreatePanel.tsx` — the create panel's checklist, rows that are strings not
  written yet.
- `App.tsx`, `ProjectSection` — the sidebar's project rows, added by LC-260j,
  which is where a pattern became a duplication and where the note naming this
  ticket sits.

Each holds `dragId` and `dropGap` in `useState` and defines the same five:
pick up, over, drop, end, and the index-of-the-row-under-the-pointer read. The
bodies differ only in a row selector, how an id is read off a row, how many
rows there are, and what a landing means.

## The shape

```ts
useRowDrag({ rowSelector, idAt, length, onMove })
```

returning the two pieces of state and the handlers to spread. The decision
stays outside it: `checklistOrder.ts` and `projectOrder.ts` already own what a
landing means, and a hook that knew would be a third authority. `landingFor`,
`gapUnder` and `dropEdge` are already shared and are the half of this that was
extracted first — this is the other half.

## Why it is worth doing

The duplication has already cost once. Writing LC-260j's cross-section probe
case, the patch landed in `probeChecklist` instead of `probeSidebar` because
the two carried an identical pair of checks; it referenced bindings that
function did not have and was caught only by running the case. That was the
harness, not the app, but it is the same shape: three near-identical blocks
where the eye cannot tell which one it is reading.

Any fix to a drag defect is currently three edits, and a fix applied to two of
three reads exactly like a fix applied to all of them.

## Out of scope

- Changing what any of the three gestures does. This is a refactor; the three
  surfaces must behave exactly as they do now.
- The pointer-to-landing arithmetic in `checklistOrder.ts`, which is already
  shared and already tested.

## Done when

- One hook, three callers, no `dragId`/`dropGap` `useState` left in the three
  components.
- `npm run verify` green, and `npm run probe:drag` quoted — it is the only
  thing that can say a row still lands where it was let go, and a refactor of
  drag wiring with no probe run is the LC-60 and LC-174 blind spot again.

## Checklist

- [ ] Extract useRowDrag with rowSelector / idAt / length / onMove <!-- longclaw:item=ck_e4e5164d -->
- [ ] Move TicketPanel's checklist drag onto it <!-- longclaw:item=ck_91b7d826 -->
- [ ] Move CreatePanel's checklist drag onto it <!-- longclaw:item=ck_cd848308 -->
- [ ] Move ProjectSection's sidebar drag onto it <!-- longclaw:item=ck_3288065b -->
- [ ] probe:drag green on all its checklist and sidebar rows; quote the run <!-- longclaw:item=ck_5e8409de -->

## Activity

<!-- longclaw:event
id: evt_3706db3d
kind: create
occurred_at: 2026-09-21T12:47:45.909Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
