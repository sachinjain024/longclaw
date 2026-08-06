---
format: longclaw.ticket/v1
id: b6cce84d-157b-4180-9233-bd5d52e4137f
key: LC-73
title: App shell — sidebar has Open folder / Create project buttons pinned at the top
status: todo
priority: p2
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:00.701Z
updated_at: 2026-08-06T07:23:17.096Z
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

<!-- longclaw:event
id: evt_552ba228
kind: comment
occurred_at: 2026-08-06T06:38:20.318Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Post-merge review follow-up. A code review read the checklist's "one quiet ghost row" as one *affordance*, not one *line* — and on that reading what shipped here is the fallback branch, not the target the ticket header states ("Sidebar has **only** section headers and project rows").

The reasoning for keeping both buttons still holds: `Welcome` renders only when no project is open (`App.tsx:1102`) and the palette root has no `Open folder` command, so deleting them would leave an open project with no way to add a second. But closing the gap properly needs a palette command *and* a create-project surface that does not live in the sidebar — the latter is not drawn in any spec today.

Filed as **LC-156** rather than reopening this, because it is new design work, not a restyle of what landed here.

Also from the same review, fixed on this branch in `2ad1d83`: the ghost row was overriding the documented small-button padding with an off-scale `0 7px` (`components.md:44`); it now inherits `.ghost.small`'s `0 9px` and still fits on one line.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_87191606
kind: update
occurred_at: 2026-08-06T07:23:17.096Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: done
    to: todo
-->
### Claude Code updated this ticket

Reopening. A second review is right that closing this as done overstated it.

What landed is the checklist's fallback: the two actions moved from filled buttons above the sections to a ghost row at the foot. What the ticket actually states — "Sidebar has **only** section headers and project rows" (`screen-specs.md:30-36`) — is not met, because the actions are still there.

The blocking work is **LC-156**: a palette `Open folder` command, and a create-project surface that does not live in the sidebar. Until both exist, deleting the row would leave an open project with no way to add a second (`App.tsx:1102`, `CommandPalette.tsx:150-211`). This ticket stays open behind it rather than being closed on the fallback.

Also from that review, fixed on this branch: the ghost row was overriding the variant's documented `ink-2` text with `ink-3` (`components.md:49`) — "quiet" in the checklist names the ghost variant, and dimming it further was reading the word rather than the table. The row now uses `.ghost`'s own colour.

The App.test.tsx block covering this is renamed `sidebar project actions — the LC-73 fallback, pending LC-156`, so it reads as "while the actions exist, this is where and how" rather than as a claim that they belong there. LC-156 should delete that block along with the row.
<!-- /longclaw:event -->
