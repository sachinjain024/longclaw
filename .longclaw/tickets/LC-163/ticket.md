---
format: longclaw.ticket/v1
id: 75ca7362-c346-4f1f-8de3-a6a022e8c608
key: LC-163
title: Theme matrix cannot run to completion — it times out clicking Settings, and .content-header .secondary matches nothing
status: todo
priority: p1
labels:
  - frontend
created_at: 2026-08-06T15:18:48.997Z
updated_at: 2026-08-06T15:18:48.997Z
---

Since LC-73 moved the sidebar's project actions to the top, `npm run matrix` no longer reaches the end of its run.

Two failures, both on a clean `main` (confirmed by stashing an unrelated branch and re-running):

1. **Fatal.** `page.click('button:has-text("Settings")')` (`perf/theme-matrix.mjs`) times out after 30s and throws, so the run dies before printing its findings. The `settings` and `error` states are never checked, and neither is anything the run would have reported, because the throw pre-empts the summary.
2. **8 failures**, one per axis: `interaction: .content-header .secondary background-color on hover — probe matched nothing at rest`. `BOARD_FEEDBACK` still expects a secondary button in the content header.

Consequence: the matrix is the only check that reads *rendered* colour across theme × appearance, and right now it cannot green or red — it crashes. LC-97/LC-98 added panel probes for code surfaces that were verified locally only by skipping the two dead states.

Fix is to point the probes at wherever the project actions and Settings now live, and to re-check whether `.content-header .secondary` still exists at all or has been replaced by a different control.

## Checklist

- [ ] Repoint the Settings click at the control's new home <!-- longclaw:item=ck_4d33f11b -->
- [ ] Repoint or retire the .content-header .secondary hover probe <!-- longclaw:item=ck_60dea32a -->
- [ ] Confirm a full matrix run reaches its summary and reports 0 failures <!-- longclaw:item=ck_275ab231 -->

## Activity

<!-- longclaw:event
id: evt_94ed6868
kind: create
occurred_at: 2026-08-06T15:18:48.997Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
