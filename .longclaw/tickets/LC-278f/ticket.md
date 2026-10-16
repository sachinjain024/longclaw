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
updated_at: 2026-10-16T22:21:53.182Z
---

A dev build (`npm run dev`) and the installed release build look identical. They share the `LongClaw` name, the owl icon in the Dock and ⌘-Tab, the window title, and the bundle identifier `io.longclaw.desktop`. With both running, there's no telling which window is which. A change gets checked in the wrong one, or a project gets edited by the older build without anyone noticing. This happened during LC-206: the installed app rewrote the branch's `.longclaw/AGENTS.md` again and again.

Make a dev build unmistakable at a glance, while a release build stays exactly as it is.

## Ideas

- **Icon:** a distinct Dock/⌘-Tab icon for dev, such as the owl with a "DEV" ribbon or a different tint.
- **Name and title:** "LongClaw Dev" in the menu bar, the window title and About.
- **In-window marker:** a small badge in the header or side panel showing the branch or short commit, so a screenshot says which build it came from.
- **Separate identity:** a dev bundle identifier such as `io.longclaw.desktop.dev`, so dev keeps its own settings, app data and window state and can't disturb the installed app's.

## Acceptance criteria

- [ ] A dev build is told apart from the release build in the Dock, in ⌘-Tab and in the window, without opening anything.
- [ ] A release build (`npm run build:app`, CI) is unchanged: same icon, name, title and identifier. A check enforces this, so a dev marker can't ship.
- [ ] Dev and release can run side by side without sharing settings or app data, or the ticket records why they still share them.
- [ ] Any in-window marker passes the tile-contrast guard and `matrix` in both appearances, and is not a tab stop.
- [ ] The CLI linked by *Settings → Command line* still points at the installed app's binary, never at a dev build.

## Open questions

- Which markers to use: icon only, or icon plus name plus badge?
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
