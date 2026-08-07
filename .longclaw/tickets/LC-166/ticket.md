---
format: longclaw.ticket/v1
id: ee819039-9f7f-493b-bf34-5f2fffdd4bcd
key: LC-166
title: Board card — the title clamps to one line where the prototype shows two (optional, measure first)
status: todo
priority: p3
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-07T05:42:02.062Z
updated_at: 2026-08-07T05:42:02.062Z
---

**Prototype.** The board card's title clamps to **2 lines**, and card height varies with it.

**App.** The title is one 18px line, ellipsized; the card is pinned to 90px, 118px when fresh (`styles.css:840-849`, `boardGeometry.ts:29-46`).

This is a deliberate trade, not an oversight. Exact per-card offsets are what let a column render only its visible cards — 71ms → 21ms a frame at 5,000 tickets (`boardGeometry.ts:11-23`) — and `docs/cc_screens_diff.md` § 4 declined to file it for that reason. It is filed here as optional, measure-first work so the decision lives somewhere a person will look, rather than only in a deleted plan.

**Do not make card height content-dependent.** The safe shape is to clamp the title at 2 lines and raise the pinned heights to fit two lines *always* — ≈90 → 108px, fresh 118 → 136px — keeping one stride per state. The clamp guarantees the maximum, so offsets stay exact. The cost is ~18px of whitespace under a one-line title.

## Source

`docs/cc_ui_diffs.md` § C3 / Step 8 and `docs/cd_ui_diffs.md` § 5, both deleted 2026-08-07.

## Checklist

- [ ] Decide with numbers, not by eye: run npm run perf:board before and after, and quote both. <!-- longclaw:item=ck_d631ee87 -->
- [ ] If it lands: move CARD_HEIGHT, FRESH_CARD_HEIGHT and the tokens in one change, or the column jitters. <!-- longclaw:item=ck_d7cd6b31 -->

## Activity

<!-- longclaw:event
id: evt_acb6a9ae
kind: create
occurred_at: 2026-08-07T05:42:02.062Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
