---
format: longclaw.ticket/v1
id: 81e5bd55-76ec-4bce-b8a3-7dbdafdf7dca
key: LC-159
title: Board skeleton for a project load, so the header stops saying `reading`
status: todo
priority: p2
labels:
  - frontend
  - design
created_at: 2026-08-06T11:47:17.438Z
updated_at: 2026-08-06T11:47:17.438Z
---

`states.md:45-52` answers a project open or switch with a board-shaped skeleton — column heads and card blocks in `wash` with a 1.2s shimmer, appearing only if the load exceeds ~100ms and resolving in one visual step. No spinner overlay, no blocked input.

The app has no skeleton. Until it does, the only thing that says a read is in flight is the word `reading` on the header disk-state line, which LC-69 kept for exactly that reason: LC-69's own plan reserves that line's visible text for `writing…` and `reconciling`, and `reading` is neither.

Build the skeleton, then drop `reading` from the `busy` prop in `App.tsx` — the `WriteIndicator` `busy` union already narrows to the two states the plan names.

## Checklist

- [ ] Board-shaped skeleton on load: column heads and card blocks, wash, 1.2s shimmer, ~100ms threshold, one visual step <!-- longclaw:item=ck_e91a8155 -->
- [ ] Drop `reading` from the header disk-state once the skeleton reports the load <!-- longclaw:item=ck_9d632966 -->

## Activity

<!-- longclaw:event
id: evt_8003639e
kind: create
occurred_at: 2026-08-06T11:47:17.438Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
