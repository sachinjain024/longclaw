---
format: longclaw.ticket/v1
id: fdb5ad58-2827-48f4-a1de-346c2d16568b
key: LC-165
title: Board and list — --lc-size-board-stack still reserves 360px for the two-row header LC-67 collapsed
status: done
priority: p1
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-07T05:41:47.970Z
updated_at: 2026-08-08T08:57:23.059Z
---

**Spec.** The board and list stacks size to the window. The reserve above and below a column is the header and the board's own padding, and nothing else.

**App.** `--lc-size-board-stack` is `calc(100vh - 360px)` (`apps/desktop/src/tokens/design-tokens.css:88`). That 360px was sized for the *two-row* header — `project-toolbar` above `board-heading` — plus the dev trace strip. LC-67 collapsed the header to one row and LC-74 closed the terminal handle as not-in-v0, so nothing subtracts that height any more. Columns render materially shorter than the window allows, and board/list windowing measures against the wrong viewport.

Both stacks read the token: `.board-stack` (`styles.css:886`) and the list's stack (`styles.css:1319`). The comment at `styles.css:881` still describes the old chrome.

## Source

`docs/cc_ui_diffs.md` § Step 4 and `docs/cd_ui_diffs.md` § 1 / Step 4, both deleted 2026-08-07. Every `D-` row in `docs/cc_screens_diff.md` had already been filed as LC-67…LC-154; this was one of five items across the three comparison documents that never got a ticket. LC-74's review note recorded the retune as "preserved as independent work" — this is that work.

## Checklist

- [x] Derive the reserve from the one-row header plus the board's own padding rather than the stale 360px, and update the explanatory comment at styles.css:881. <!-- longclaw:item=ck_b9000f4a -->
- [x] Re-run npm run perf:board and npm run perf:list and quote the numbers — the reserve feeds the windowing viewport, so this changes what the harness measures. <!-- longclaw:item=ck_aba63c6e -->
- [x] Check short and tall windows: independent column scrolling should start only when content actually exceeds the main panel's height. <!-- longclaw:item=ck_76d20435 -->

## Activity

<!-- longclaw:event
id: evt_fcd4e235
kind: create
occurred_at: 2026-08-07T05:41:47.970Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_038b2adf
kind: update
occurred_at: 2026-08-08T04:16:42.592Z
actor:
  type: agent
  id: codex
  name: Codex
changes:
  - field: status
    from: todo
    to: in_progress
-->
### Codex updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_c275faa0
kind: update
occurred_at: 2026-08-08T08:09:02.077Z
actor:
  type: agent
  id: codex
  name: Codex
changes:
  - field: checklist.ck_b9000f4a.checked
    from: "false"
    to: "true"
  - field: checklist.ck_aba63c6e.checked
    from: "false"
    to: "true"
  - field: checklist.ck_76d20435.checked
    from: "false"
    to: "true"
-->
### Codex updated this ticket

Implemented the one-row board/list stack reserve. Verification: short/tall WebKit perf-build viewports at 520px and 920px had documentExtra=0; board stack heights were 339px/739px and list heights were 378px/778px. Perf: board p95 keyboard 15ms, scroll 19ms, filter 30ms, external write 17ms; list p95 keyboard 19ms, scroll 19ms, filter 26ms, external write 17ms.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_519457ad
kind: update
occurred_at: 2026-08-08T08:46:30.114Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: in_progress
    to: in_review
-->
### Claude Code updated this ticket

Reworked the reserve after review, then re-ran the evidence.

The first cut bounded `.board-stack` at `calc(var(--lc-size-board-stack) - var(--lc-size-board-column-head))`, with `--lc-size-board-column-head: 39px` declared on `.board-column`. Two problems, neither of them the arithmetic: `--lc-` is the token namespace and nothing outside `src/tokens/` may declare into it, and 39 is the head's 16px of padding plus whichever child is tallest, so a heading one type step larger silently makes it wrong — the same way 360 stayed behind when LC-67 made the header one row.

`.board-column` now carries the cap itself and is a flex column; `.board-column-head` is `flex: none` and `.board-stack` is `min-height: 0`, so the head takes its measured height and the stack shrinks into the rest. No number to go stale, and `--lc-size-board-stack` means one thing again for all three consumers (`.board-stack`, `.issue-list`, `.list-guide`). `token-guard.mjs` gained a rule that fails the build on any `--lc-*` defined outside `src/tokens/`, self-tested red.

Item 3, properly this time. The earlier `documentExtra=0` proved the page does not overflow and said nothing about the other half of the claim — a column that scrolls when it did not need to. Probed in WebKit over the perf build at 1440 wide, six columns:

  h=1000 n=12  → 0/6 scroll, stack 199px (content-sized, cap idle), documentExtra 0
  h=1000 n=400 → 6/6 scroll, stack 819px = 1000 − 142 − 39, documentExtra 0
  h=520  n=12  → 0/6 scroll, stack 199px, documentExtra 0
  h=520  n=400 → 6/6 scroll, stack 339px = 520 − 142 − 39, documentExtra 0

Scrolling starts only when the content exceeds the box, at both heights. The 48px below a scrolling column is `.board-grid`'s 20px bottom padding plus `.main-panel`'s 28px inset — chrome the 142 accounts for, not slack.

The review's reading that the head renders ~35px and the 39 was ~4px tall does not hold: measured, `.board-column-head` is 39px. The height was right; the name was the defect.

perf:board p95 (5,000 / 600-ticket floor): keyboard 16/15, scroll 19/18, filter 32/29, external write 17/17.
perf:list p95: keyboard 19/16, scroll 19/19, filter 24/24, external write 17/17. Every p95 within the 50ms budget.

a11y:audit Part A passes A1-A5 — A3 drives a card 25 rows into a scrolled column, which is the box this changed. `npm run verify` green.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_734ee6ec
kind: update
occurred_at: 2026-08-08T08:57:23.059Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: in_review
    to: done
-->
### Claude Code updated this ticket

Review fixes verified and merged: the reserve is derived by layout rather than written down, npm run verify is green, perf:board and perf:list are within budget, and a11y:audit Part A passes.
<!-- /longclaw:event -->
