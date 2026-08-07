---
format: longclaw.ticket/v1
id: bebaef85-66c9-416b-8929-5eac25510060
key: LC-86
title: Empty project — the whole board is replaced by one full-width dashed panel; no columns render at all
status: done
priority: p1
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:00.905Z
updated_at: 2026-08-07T08:06:49.709Z
---

**Prototype.** Board scaffold stays; guided card sits **inside the Todo column**

**App.** The whole board is replaced by one full-width dashed panel; no columns render at all

## Source

`docs/cc_screens_diff.md` — **D-20**, § Empty project, severity P1.

## Checklist

- [x] This is the state the spec is most explicit about — the app never hides the workspace. Keep <Board/> mounted when tickets.length === 0 and render the guide card as the Todo column's only child. Keep EmptyBoard's copy, move it into a 264px card. <!-- longclaw:item=ck_5a1a0bde -->

## Activity

<!-- longclaw:event
id: evt_60764e76
kind: create
occurred_at: 2026-08-05T15:16:00.905Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_b4e0317d
kind: update
occurred_at: 2026-08-07T08:06:49.709Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: done
  - field: checklist.ck_5a1a0bde.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Done. The board is never unmounted now: `App` draws the surface whatever the ticket count and hands the empty-project state down as `onCreateFirst`, which the Todo column renders as its only child (`GuideCard.tsx`, `Board.tsx`). Two things beyond the letter of the item. The scaffold's one stand-down had to move — it was `scaffold={!noMatches}`, so a query typed into an empty project still took every column away; it is `{!showNoMatches}` now, which is the filter's case alone. And `EmptyBoard`'s copy did not come with it: D-25/LC-88 replaces it. Measured in WebKit at 1180x748: six columns, the card 256px inside Todo's 264px.
<!-- /longclaw:event -->
