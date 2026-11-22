---
format: longclaw.ticket/v1
id: a6397f61-e4c3-439c-9225-5e5f4aee5739
key: LC-290b
title: Esc no longer closes the ticket panel or the command palette
status: todo
priority: p1
labels:
  - frontend
  - platform
type: bug
created_at: 2026-11-22T11:29:30.425Z
updated_at: 2026-11-22T11:29:30.425Z
---

Esc does nothing in the dev build (reported 2026-11-22): the ticket panel stays open, and the ⌘K command palette stays open. Whether a release build is affected is not yet known. If 0.4.0 has it, that is a release blocker and needs a patch release.

## What is known

- **The page's own handlers work.** `npm run a11y:audit` passes on this branch's base (`5c4d0af`, = v0.4.0 + ticket edits). It drives the real `App` in WebKit with only a keyboard, and its A1 and A2 rows press Esc to close the ticket panel (`TicketPanel.tsx:733-739`) and the palette (`CommandPalette.tsx:780`); both pass. So the key is lost **before it reaches the page** in the native window, or by something present only under the real Tauri backend rather than the perf stubs.
- **Nothing in the frontend captures Esc.** The only capture-phase keydown listener is zoom's (`zoom.ts:108`, LC-258c), and `zoomIntent` matches only ⌘=, ⌘+, ⌘-, ⌘0.
- **No global shortcut.** There is no `tauri-plugin-global-shortcut`, so the installed app running alongside the dev build cannot take the key.
- **Suspect: the app menu LC-258c installed in 0.4.0.** `lib.rs:1137-1140` now calls `app.set_menu(zoom::menu_with_zoom(..))`, which replaces Tauri's default menu at startup. This is the only native keyboard-path change between v0.3.1 and v0.4.0. Not yet confirmed.
- The installed app on the reporter's machine is **0.3.1**, which is before LC-258c.

## To find out

1. Press Esc with the panel open in the installed 0.3.1 app. If it works, the regression is between 0.3.1 and 0.4.0.
2. Press it in a 0.4.0 release bundle. This decides whether to cut a patch release.
3. In the dev build, log `keydown` in a capture listener on `window` to see whether Esc reaches the page at all. Then comment out `set_menu` and compare.
4. Find out why a11y:audit could not catch this (WebKit with stubs, not the Tauri window), and add coverage that would have.

## Activity

<!-- longclaw:event
id: evt_3cafe15c
kind: create
occurred_at: 2026-11-22T11:29:30.425Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
