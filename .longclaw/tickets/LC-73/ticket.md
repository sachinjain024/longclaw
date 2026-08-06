---
format: longclaw.ticket/v1
id: b6cce84d-157b-4180-9233-bd5d52e4137f
key: LC-73
title: App shell — sidebar has Open folder / Create project buttons pinned at the top
status: done
priority: p2
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:00.701Z
updated_at: 2026-08-06T05:51:07.391Z
---

**Prototype.** Sidebar has **only** section headers and project rows

**App.** Sidebar has `Open folder` / `Create project` buttons pinned at the top

## Source

`docs/cc_screens_diff.md` — **D-0B**, § App shell, severity P2.

## Checklist

- [x] These duplicate the palette's go to project… and the welcome screen. If they stay, they belong at the foot of the project list as one quiet ghost row, not as two filled buttons above the sections. <!-- longclaw:item=ck_8f71fde7 -->

## Activity

<!-- longclaw:event
id: evt_8f756aac
kind: create
occurred_at: 2026-08-05T15:16:00.701Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_43a2c70f
kind: update
occurred_at: 2026-08-06T05:51:07.391Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: done
  - field: checklist.ck_8f71fde7.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Done in fix/lc-71-73-app-shell, taking the checklist's "if they stay" branch.

They stay. The spec draws only section headers and project rows, and the two buttons do duplicate the welcome screen — but the welcome screen is only the no-project state, and the palette has no `open folder` or `create project` command (just `go to project…`, which switches between projects already registered). Removing them would leave an open project with no way to add a second one.

So they moved from two filled `secondary` buttons pinned above the sections to one quiet ghost row at the foot of the project list, with the hairline flipped from the bottom of the block to the top.

One thing worth recording: the buttons must be sized to their labels, not stretched. `flex: 1` splits the sidebar's 216px of content into 106px each, which wraps `Create project` onto a second line — caught in the theme-matrix render, not by any test.

`a11y-audit.mjs` tracks `Open folder` as a primary control at 200% zoom; its selector moved with the buttons and A5 still passes.
<!-- /longclaw:event -->
