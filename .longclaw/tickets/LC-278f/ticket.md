---
format: longclaw.ticket/v1
id: d4d23707-fadd-4e10-81a9-99466e996b54
key: LC-278f
title: Tell a dev build apart from the release build
status: todo
priority: none
labels:
  - frontend
  - platform
created_at: 2026-10-16T22:21:53.182Z
updated_at: 2026-10-22T08:40:54.535Z
---

A dev build (`npm run dev`) and the installed release build look identical. They share the `LongClaw` name, the owl icon in the Dock and ⌘-Tab, the window title, and the bundle identifier `io.longclaw.desktop`. With both running, there's no telling which window is which. A change gets checked in the wrong one, or a project gets edited by the older build without anyone noticing. This happened during LC-206: the installed app rewrote the branch's `.longclaw/AGENTS.md` again and again.

Make a dev build unmistakable at a glance, while a release build stays exactly as it is.

## Suggested markers

Ranked by how quickly each one tells the builds apart.

| # | Marker | Where it shows | Cost | Notes |
|---|---|---|---|---|
| 1 | **Icon colour.** The same owl on a different background colour: a warm amber or orange that no accent theme uses, against the release icon's neutral one. | Dock, ⌘-Tab, Finder, Launchpad | Low: one recoloured icon set | Readable even at 16 px, where text isn't. This is how Chrome Canary, Firefox Nightly and VS Code Insiders do it. |
| 2 | **"DEV" band on the icon.** A diagonal corner ribbon or a bottom strip on the icon reading DEV. | Dock, ⌘-Tab | Low, on the same icon set as 1 | Pairs with 1: colour at a glance, the word when you look. |
| 3 | **App name "LongClaw Dev".** | Menu bar, ⌘-Tab label, About, Activity Monitor, Force Quit | Low | Tells the processes apart when quitting the right one. |
| 4 | **Window title "LongClaw Dev — `<branch>`".** | Title bar, Mission Control, Window menu | Low | Says *which* checkout as well, when two dev builds run. |
| 5 | **In-app badge "DEV · `<branch>` · `<short sha>`".** A small pill in the header or the foot of the side panel. | Inside the window and in every screenshot | Medium: one component plus the guards | It's the only marker a screenshot or bug report carries. Not a tab stop. It must pass tile-contrast and `matrix` in all five themes in both appearances. |
| 6 | **Separate bundle identifier `io.longclaw.desktop.dev`.** | Not visible on its own | Low to medium: settings, app data and window state move | Not a marker, but it keeps a dev build from reading or writing the installed app's state (LC-279b's window frame, LC-238s's panel width). Dev starts with empty settings once. |
| 7 | *Thin coloured strip along the window's top edge.* | Window | Medium | **Not recommended.** It competes with the accent themes, and the contrast guard would have to except it. |

**Recommendation:** 1, 2, 3 and 5 for recognition, with 6 for isolation. Leave out 4 unless two dev builds are often open at once, and leave out 7.

**Things to check while building:**
- `tauri dev` runs an unbundled binary. Whether the Dock shows the configured icon there, or needs it set at runtime, is unverified.
- Keep the dev values in a dev-only config overlay (`tauri.dev.conf.json`, merged by `tauri dev --config`), so the release `tauri.conf.json` doesn't change. A check in `verify` that the release config has no dev name, icon or identifier keeps a marker from shipping.

## Acceptance criteria

- [ ] A dev build is told apart from the release build in the Dock, in ⌘-Tab and in the window, without opening anything.
- [ ] A release build (`npm run build:app`, CI) is unchanged: same icon, name, title and identifier. A check enforces this, so a dev marker can't ship.
- [ ] Dev and release can run side by side without sharing settings or app data, or the ticket records why they still share them.
- [ ] Any in-window marker passes the tile-contrast guard and `matrix` in both appearances, and is not a tab stop.
- [ ] The CLI linked by *Settings → Command line* still points at the installed app's binary, never at a dev build.

## Open questions

- Which markers to use? The recommendation is 1, 2, 3 and 5, with 6.
- The icon colour: amber or orange is the suggestion. It needs to stay distinct from all five accent themes.
- Should the dev identifier be split now, given dev would then start with empty settings?

## Activity

<!-- longclaw:event
id: evt_f26b4bd9
kind: create
occurred_at: 2026-10-16T22:21:53.182Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_c77f9444
kind: update
occurred_at: 2026-10-22T08:40:54.535Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: description
-->
### Claude Code updated this ticket

Added ranked marker suggestions (icon colour, a DEV band on the icon, the app name, the window title, an in-app badge, a separate app ID, and a window strip, which isn't recommended) and a recommendation: 1, 2, 3 and 5, with 6.
<!-- /longclaw:event -->
