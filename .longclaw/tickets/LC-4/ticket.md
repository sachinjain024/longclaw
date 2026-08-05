---
format: longclaw.ticket/v1
id: 8d4f2f07-c58d-4ce7-bc14-ba75457baf00
key: LC-4
title: "Watcher recovery: NSWorkspaceDidWakeNotification behind platform/macos, overflow diagnostics, coalescing with focus recovery, and an explicit watcher-unavailable state"
status: done
priority: urgent
labels:
  - platform
  - v0-backlog
created_at: 2026-08-05T14:22:47Z
updated_at: 2026-08-05T14:22:48Z
---

Watcher recovery: `NSWorkspaceDidWakeNotification` behind `platform/macos`, overflow diagnostics, coalescing with focus recovery, and an explicit watcher-unavailable state

## Why it exists

FSEvents drops history over sleep, wake, overflow, and removed roots, and macOS gives no `Resumed` callback while the window stays focused. A closed lid is an ordinary event on a laptop; today it can leave the app confidently wrong.

## Source

`docs/backlog/v0-backlog.md` — **V0-04**, Wave 0, step 14, owner Platform.

## Checklist

- [x] Done 2026-07-31. Watcher integration covers overflow, restored roots, coalescing, and unavailable reporting; a focused-window sleep/wake soak on macOS 26.5.2 confirmed edits appear without click, refresh, or restart <!-- longclaw:item=ck_20921a50 -->

## Activity

<!-- longclaw:event
id: evt_df644f14
kind: create
occurred_at: 2026-08-05T14:22:47Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_0f3744ea
kind: update
occurred_at: 2026-08-05T14:22:48Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_20921a50.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Imported from `docs/backlog/v0-backlog.md`. The must-pass verification for V0-04 is recorded there as passed.
<!-- /longclaw:event -->
