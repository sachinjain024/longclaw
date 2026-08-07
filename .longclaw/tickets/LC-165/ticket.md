---
format: longclaw.ticket/v1
id: fdb5ad58-2827-48f4-a1de-346c2d16568b
key: LC-165
title: Board and list — --lc-size-board-stack still reserves 360px for the two-row header LC-67 collapsed
status: todo
priority: p1
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-07T05:41:47.970Z
updated_at: 2026-08-07T05:41:47.970Z
---

**Spec.** The board and list stacks size to the window. The reserve above and below a column is the header and the board's own padding, and nothing else.

**App.** `--lc-size-board-stack` is `calc(100vh - 360px)` (`apps/desktop/src/tokens/design-tokens.css:88`). That 360px was sized for the *two-row* header — `project-toolbar` above `board-heading` — plus the dev trace strip. LC-67 collapsed the header to one row and LC-74 closed the terminal handle as not-in-v0, so nothing subtracts that height any more. Columns render materially shorter than the window allows, and board/list windowing measures against the wrong viewport.

Both stacks read the token: `.board-stack` (`styles.css:886`) and the list's stack (`styles.css:1319`). The comment at `styles.css:881` still describes the old chrome.

## Source

`docs/cc_ui_diffs.md` § Step 4 and `docs/cd_ui_diffs.md` § 1 / Step 4, both deleted 2026-08-07. Every `D-` row in `docs/cc_screens_diff.md` had already been filed as LC-67…LC-154; this was one of five items across the three comparison documents that never got a ticket. LC-74's review note recorded the retune as "preserved as independent work" — this is that work.

## Checklist

- [ ] Derive the reserve from the one-row header plus the board's own padding rather than the stale 360px, and update the explanatory comment at styles.css:881. <!-- longclaw:item=ck_b9000f4a -->
- [ ] Re-run npm run perf:board and npm run perf:list and quote the numbers — the reserve feeds the windowing viewport, so this changes what the harness measures. <!-- longclaw:item=ck_aba63c6e -->
- [ ] Check short and tall windows: independent column scrolling should start only when content actually exceeds the main panel's height. <!-- longclaw:item=ck_76d20435 -->

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
