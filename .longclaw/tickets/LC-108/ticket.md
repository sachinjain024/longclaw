---
format: longclaw.ticket/v1
id: 51a19c19-5268-455f-8693-6ca4bbcf4c25
key: LC-108
title: Ticket panel — the title textarea shows a native resize grabber
status: done
priority: p2
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:01.238Z
updated_at: 2026-08-07T01:20:07.705Z
---

**Prototype.** Title is a borderless textarea; hover `wash`, focus field treatment

**App.** Borderless ✓, but the native **resize grabber is visible** at the title's bottom-right corner

## Source

`docs/cc_screens_diff.md` — **D-3G**, § Ticket panel, severity P2.

## Checklist

- [x] resize: none on the title textarea. <!-- longclaw:item=ck_4c4c741c -->

## Activity

<!-- longclaw:event
id: evt_0d1a8402
kind: create
occurred_at: 2026-08-05T15:16:01.238Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_4725a0ce
kind: update
occurred_at: 2026-08-07T01:20:07.705Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: done
  - field: checklist.ck_4c4c741c.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

resize: none on the title (D-3G), with rows={1} and useAutoGrow so rows is a floor rather than the size — taking the handle off a fixed two-row box would have traded a grabber for a clipped title. The hook re-measures on window resize as well as on the text: the panel is a percentage of the window, so narrowing it rewraps the same characters onto more lines, and .panel-title hides its overflow. Both declarations are held by scripts/field-guard.mjs in npm run check, which reads both ends of the pair — the declaration, and the useAutoGrow call that keeps resize: none from clipping instead of merely tidying. jsdom loads no stylesheet, so a test could not have stated it.
<!-- /longclaw:event -->
