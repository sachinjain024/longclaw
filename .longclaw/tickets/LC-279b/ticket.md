---
format: longclaw.ticket/v1
id: 2726afe0-4103-4d5f-9ed4-ea8a692a21dc
key: LC-279b
title: Open full-screen on first launch, then remember the window's position and size
status: todo
priority: none
labels:
  - frontend
  - platform
created_at: 2026-10-16T22:54:43.305Z
updated_at: 2026-10-16T22:54:43.305Z
---

LongClaw always opens at a fixed 1180×780 window (`tauri.conf.json`), wherever macOS puts it. On a large display it starts as a small window that has to be dragged out every launch. Moving or resizing it is forgotten on quit.

## What to build

- **First launch:** the window fills the screen it opens on, meaning the display's usable area (inside the menu bar and Dock). This is a zoomed window, not a macOS full-screen Space.
- **Later launches:** the window opens at the position and size it had when the app was last closed, including when that was zoomed.

## Acceptance criteria

- [ ] With no saved state, the window opens filling the usable area of the main display, never under the menu bar or Dock.
- [ ] Moving or resizing the window, then quitting and reopening, restores the same position and size.
- [ ] A window that was zoomed (filling the screen) when quit reopens zoomed. A window that was in a full-screen Space reopens as a normal window filling the screen, not in a new Space. *(Confirm.)*
- [ ] The state is saved per display. If the saved display is gone (an external monitor unplugged) or the saved frame would be off screen, the window falls back to filling the main display. It never opens off screen or where it can't be reached.
- [ ] The restored size never goes below the minimum (760×620). A saved size larger than the current display is clamped to it.
- [ ] The state is saved on quit and on a move or resize (debounced), so a crash or force-quit keeps the last known frame.
- [ ] Nothing flashes at the default size before jumping to the saved frame: the window is shown only once its frame is set.
- [ ] Window state lives in app data, not in any project's `.longclaw/` folder. It is per machine, not shared through git.

## Notes

- Prior art: LC-238s remembers the ticket panel's width.
- `tauri-plugin-window-state` covers most of this. Check its off-screen and missing-display handling before relying on it, and check it adds nothing that touches the network.
- If LC-278f gives dev builds their own app ID, dev and release will remember separate window frames, which is what we want.

## Activity

<!-- longclaw:event
id: evt_7da1a3c2
kind: create
occurred_at: 2026-10-16T22:54:43.305Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
