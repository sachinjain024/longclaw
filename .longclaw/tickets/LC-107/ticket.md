---
format: longclaw.ticket/v1
id: abb06e34-e6d5-4835-b22a-b88a34c32ef0
key: LC-107
title: Ticket panel — avatar + a bordered textarea with a visible native resize grabber + a separate Comment button
status: done
priority: p2
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:01.222Z
updated_at: 2026-08-07T01:20:07.683Z
---

**Prototype.** Composer: avatar + auto-growing borderless field, `⌘↵` posts

**App.** Avatar + a bordered textarea with a visible native resize grabber + a separate `Comment` button

## Source

`docs/cc_screens_diff.md` — **D-3F**, § Ticket panel, severity P2.

## Checklist

- [x] Remove the resize handle (resize: none + auto-grow), keep ⌘↵, and demote the button to a quiet primary that appears once there is text. <!-- longclaw:item=ck_f32c610f -->

## Activity

<!-- longclaw:event
id: evt_6e59669e
kind: create
occurred_at: 2026-08-05T15:16:01.222Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_92516d05
kind: update
occurred_at: 2026-08-07T01:20:07.683Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: done
  - field: checklist.ck_f32c610f.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Removed the grabber and rebuilt the composer's sizing (D-3F). resize: none plus a real auto-grow — useAutoGrow, the prototype's own scrollHeight measurement — with a 220px cap so a long comment scrolls itself rather than pushing the timeline it belongs to off the screen. The rows arithmetic it replaces counted newlines, so a wrapped paragraph never grew at all. The Comment button now renders only once there is text, at the quiet variant the prototype gives it (prototype.js:753, btn-secondary btn-sm) rather than the row's words 'quiet primary': disabled, it was a control that could never be pressed and a Tab stop that led nowhere. Two consequences were followed up rather than left: the placeholder now names ⌘↵, because the button that stood for the action is no longer on screen to do it, and keyboard-focus-map.md:61 says the comment stop is conditional. The theme matrix read the human accent off that button, so its agent-vs-human probe moved to the description link, which this state always renders.
<!-- /longclaw:event -->
