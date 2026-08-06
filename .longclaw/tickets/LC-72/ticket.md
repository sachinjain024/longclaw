---
format: longclaw.ticket/v1
id: a408586f-6cdd-460e-be2e-8025faf7c025
key: LC-72
title: App shell — footer has an Appearance <select> above the trust line; no waitlist button
status: done
priority: p2
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:00.687Z
updated_at: 2026-08-06T05:51:07.368Z
---

**Prototype.** Sidebar footer: mono `v0 · local · no account` then the waitlist ghost button

**App.** Footer has an **Appearance `<select>`** above the trust line; no waitlist button

## Source

`docs/cc_screens_diff.md` — **D-0A**, § App shell, severity P2.

## Checklist

- [x] Appearance belongs in project settings as a 3-up segment (screen-specs.md:184-187) — see D-42. Remove the native <select> from the sidebar. <!-- longclaw:item=ck_9f526cc8 -->

## Activity

<!-- longclaw:event
id: evt_7eca695f
kind: create
occurred_at: 2026-08-05T15:16:00.687Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_8b1c2fa3
kind: update
occurred_at: 2026-08-06T05:51:07.368Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: done
  - field: checklist.ck_9f526cc8.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Done in fix/lc-71-73-app-shell. The native Appearance `<select>` is out of the sidebar footer, which is now just the trust line the spec asks for (`screen-specs.md:34`).

Appearance is an app preference, not project data, so it belongs in project settings as a 3-up segment — that is LC-127, still open. Removing the control here does not strand the preference: the palette's `Toggle appearance` command cycles system → light → dark, and it is the path until LC-127 lands.

This also clears one of the two native `<select>` elements LC-152 tracks; the label-colour dropdown in settings is the other.

The V0-35 appearance tests drove this `<select>`. They now drive the store's `setAppearance`, which is exactly what both the palette command and the future segment call — what those tests assert is that an explicit override beats the system and survives a relaunch, not which control set it.
<!-- /longclaw:event -->
