---
format: longclaw.ticket/v1
id: acdbfd5c-30f9-43ad-91e1-00a479cf4b8f
key: LC-164
title: "Board — a degraded card still wears the fresh treatment: pulse dot, ring, and the taller fresh stride"
status: todo
priority: p3
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-07T04:41:26.080Z
updated_at: 2026-08-07T04:41:26.080Z
---

**Prototype.** `degradedCardHTML` (`prototype.js:621-627`) draws the warn glyph, the mono path and `View raw file` and nothing else — a degraded card has no fresh dot, because there is no parsed content in it to be fresh about.

**App.** `Board.tsx` reads `const fresh = isFresh(mark, props.now)` with no regard for the row's state, so a degraded card gets the pulse dot beside its key, the fresh ring, and — via `cardStrides` (`boardGeometry.ts:55-63`) — the taller fresh stride.

This is D-37's finding on the other surface. LC-95 fixed the list on 2026-08-07 (`ListRow` reads `isFresh(…) && !row.degraded`) and deliberately stopped at the list, because D-37 is a § Issue list row and the board's half also moves geometry: the stride has to agree with the treatment or the column's offsets and what is drawn come apart. Fix both together, and put the rule in one place both surfaces read rather than a second `&&` in a second component.

## Checklist

- [ ] Suppress the fresh treatment on a degraded card, and make cardStrides agree so the column's offsets still match what is drawn. <!-- longclaw:item=ck_3854a0ec -->

## Activity

<!-- longclaw:event
id: evt_9b55a829
kind: create
occurred_at: 2026-08-07T04:41:26.080Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
