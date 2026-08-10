---
format: longclaw.ticket/v1
id: ee819039-9f7f-493b-bf34-5f2fffdd4bcd
key: LC-166
title: Board card — the title clamps to one line where the prototype shows two (optional, measure first)
status: done
priority: p3
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-07T05:42:02.062Z
updated_at: 2026-08-09T15:09:26.924Z
---

**Prototype.** The board card's title clamps to **2 lines**, and card height varies with it.

**App.** The title is one 18px line, ellipsized; the card is pinned to 90px, 118px when fresh (`styles.css:840-849`, `boardGeometry.ts:29-46`).

This is a deliberate trade, not an oversight. Exact per-card offsets are what let a column render only its visible cards — 71ms → 21ms a frame at 5,000 tickets (`boardGeometry.ts:11-23`) — and `docs/cc_screens_diff.md` § 4 declined to file it for that reason. It is filed here as optional, measure-first work so the decision lives somewhere a person will look, rather than only in a deleted plan.

**Do not make card height content-dependent.** The safe shape is to clamp the title at 2 lines and raise the pinned heights to fit two lines *always* — ≈90 → 108px, fresh 118 → 136px — keeping one stride per state. The clamp guarantees the maximum, so offsets stay exact. The cost is ~18px of whitespace under a one-line title.

## Source

`docs/cc_ui_diffs.md` § C3 / Step 8 and `docs/cd_ui_diffs.md` § 5, both deleted 2026-08-07.

## Checklist

- [x] Decide with numbers, not by eye: run npm run perf:board before and after, and quote both. <!-- longclaw:item=ck_d631ee87 -->
- [x] If it lands: move CARD_HEIGHT, FRESH_CARD_HEIGHT and the tokens in one change, or the column jitters. <!-- longclaw:item=ck_d7cd6b31 -->

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

<!-- longclaw:event
id: evt_269507d1
kind: update
occurred_at: 2026-08-09T15:09:26.924Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: done
  - field: checklist.ck_d631ee87.checked
    from: "false"
    to: "true"
  - field: checklist.ck_d7cd6b31.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Landed on `feat/lc-166-two-line-card-title`. The safe shape this ticket describes, taken as written: the title clamps at two 18px lines, the box reserves both whether or not the second is used, and the pinned heights moved with it — 90 → 108px, 118 → 136px — in one change with the tokens, so no column jittered.

**Decided with numbers, as item one asks.** `npm run perf:board`, same machine, before and after:

| interaction | before p50/p95 | after p50/p95 |
| --- | --- | --- |
| keyboard ArrowDown | 14 / 15 | 14 / 15 |
| scroll | 18 / 19 | 17 / 18 |
| filter | 16 / 29 | 15 / 29 |
| external write → paint | 14 / 15 | 14 / 15 |

Both runs `within budget`. Scroll came out a millisecond *better*, and it is not noise in the direction it sounds: a taller card narrows the window, 12 cards a column to 11, so the surface holds fewer nodes than it did. The cost this ticket was weighing — content-dependent height — was never paid, because the clamp keeps the maximum exact. `perf:list` is unchanged and within budget; the list has no cards.

**The sum is now checked.** `CARD_HEIGHT` is an arithmetic claim about a stylesheet the module never reads, and nothing held it: the tokens agree with the constants whatever they hold, and jsdom lays nothing out. `scripts/card-height-guard.mjs` adds the rows up — border, padding, key row, title, foot, and the acknowledgement footer for the second height — and fails the build when the total stops matching. It also checks the clamp against the title's stated height, because after this change the line count is the most movable number on the card. Proved red against three drifts (clamp raised to 3, title box grown, footer margin grown) before being left green. It runs in `npm run check`.

**One thing found on the way, and filed rather than folded in.** `probe:drag` chose its target column by requiring *every* rendered row to be fully visible, which tied that choice to how tall a card is: at 108px a 7-card column stopped qualifying, the target fell through to `Canceled`, and three checks went red for a change that has nothing to do with drag. The eligibility rule now names only the rows a run actually points at. The underlying question — why a drop into the far-right column is refused at all — reproduces on `main` at `--tickets=46` and is **LC-189**.

Gates: `npm run verify` green (820 frontend tests, the guards, the native watcher). `probe:drag` 38/38 at the default and at `--tickets=46`, with `--self-test` still going red. `matrix` clean across 8 axes × 9 states.
<!-- /longclaw:event -->
