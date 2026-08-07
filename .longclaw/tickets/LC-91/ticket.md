---
format: longclaw.ticket/v1
id: fe1111e9-ead7-4b76-a023-6faad4428945
key: LC-91
title: Filter states — A bordered rounded container spanning the content width, top-aligned
status: done
priority: p2
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:00.988Z
updated_at: 2026-08-07T05:51:31.164Z
---

**Prototype.** Centered in the board region, no container

**App.** A bordered rounded container spanning the content width, top-aligned

## Source

`docs/cc_screens_diff.md` — **D-31**, § Filter states, severity P2.

## Checklist

- [x] Drop the frame; centre it in the remaining height. NoMatches in App.tsx:1775+. <!-- longclaw:item=ck_a15dde49 -->

## Activity

<!-- longclaw:event
id: evt_b46a10fe
kind: create
occurred_at: 2026-08-05T15:16:00.988Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_3d7f87e1
kind: update
occurred_at: 2026-08-07T05:49:24.239Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: in_progress
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_9840c632
kind: update
occurred_at: 2026-08-07T05:51:31.164Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: in_progress
    to: done
  - field: checklist.ck_a15dde49.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

The frame is gone — dashed border, tint and 18px block margin — and the panel now centres in the height the header leaves. Three parts: `.main-panel` becomes a column, the workspace takes a `.workspace-state` modifier for the one state that stands *instead of* the surfaces rather than above them, and `.no-matches` claims what is left and centres in it. Scoped to that state on purpose: the board and the list size themselves and gain nothing from being flex items, and their budgets say so — `perf:board` p95 15/18/25/16ms, `perf:list` p95 16/19/23/16ms. Measured in WebKit at 1440x900, the panel spans y=86 to 844 with its title on the centre line. `.no-matches p` also takes the 400px the prototype gives a state panel's sub-line, which the frame used to do by accident. `.empty-board` and `.unreachable-panel` keep their frames: D-20 and D-59 are the rows that decide those.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_35f6cfc4
kind: comment
occurred_at: 2026-08-07T06:04:48.106Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Review follow-up, three things. **The centring was 14px out.** The board and the list stay mounted behind the panel — they hold the roving focus and the scroll position a no-match keystroke would otherwise throw away, and they are what draws the unreadable rows the filter never hides — but an empty one still spent 28px of its own padding under the panel. `.workspace-state > .board-grid:empty` and its list twin take that case, which is exactly "this surface drew nothing". Re-measured in WebKit at 1440x900: the panel now spans the region whole, y=86 to 872, where it stopped at 844 before. **One expression, not two.** `showNoMatches` decides both the panel and the class that centres it; they were two conditions that had to stay in agreement about one state. **A guard, because no test can see a frame.** jsdom loads no stylesheet, so the vitest suite can hold the class the centring hangs off and never the declarations behind it — and `.no-matches` used to share its rule with `.empty-board` and `.unreachable-panel`, which do keep their frames, so the selector has a plausible way back onto it. `scripts/state-panel-guard.mjs` fails on a border, a background or a margin returning to `.no-matches`, and on any link of the flex chain (`.main-panel` column, `.workspace-state` flex 1, `.no-matches` flex 1 + justify-content) going missing; it runs in `npm run check` as `states:check`. Both failure modes were provoked to confirm it goes red. Budgets re-run after the change: `perf:board` p95 15/18/26/17ms, `perf:list` p95 16/19/20/15ms, `a11y:audit` Part A green.
<!-- /longclaw:event -->
