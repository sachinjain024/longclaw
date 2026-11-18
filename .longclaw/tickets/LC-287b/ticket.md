---
format: longclaw.ticket/v1
id: 0cfbad43-69d4-480c-9263-f7c7bcda0e89
key: LC-287b
title: A found update is forgotten on relaunch, and the pane says up to date for up to a day
status: todo
priority: p2
labels:
  - platform
type: bug
created_at: 2026-11-18T13:44:21.522Z
updated_at: 2026-11-18T13:44:21.522Z
---

An update the app has already found is forgotten when the app relaunches. The found version is held only in the running process (`UpdateService.pending` in `update.rs`), and the scheduled check runs at most once per 24 hours (`CHECK_INTERVAL_MS`, `isCheckDue` in `updates.ts`), with _Check now_ counting as that check (`UpdatesPane.tsx` calls `rememberUpdateCheck`). So someone who finds an update, cancels the password prompt or simply quits before pressing _Restart to update_, and opens the app again is shown _up to date_ until the next slot, up to a day later, though the app knew minutes earlier that a newer version exists. `status()` itself says "nothing pending and nothing checked read the same from here".

Seen on 2026-11-18 during LC-267r's second standard-account run: as `lctest` on 0.3.0, _Check now_ found 0.3.1; cancelling the administrator prompt and relaunching left the app saying nothing about 0.3.1. The same run also showed 0.3.1 was not offered on launch until _Check now_ was pressed, because the earlier run had used that day's slot.

To decide: remember the last found version (and the time it was found) beside the last-check time, so a relaunch inside the slot shows _available_ rather than _up to date_; or let a launch whose last check found something check again. Either way the pane must not say _up to date_ on a machine it knows is behind.

## Activity

<!-- longclaw:event
id: evt_507cd2b0
kind: create
occurred_at: 2026-11-18T13:44:21.522Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
