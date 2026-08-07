---
format: longclaw.ticket/v1
id: 39fda5f0-97b9-4895-8fbc-6c7ba879a08a
key: LC-153
title: Cross-cutting — native textarea resize grabbers are visible on the panel title, the comment composer, and the create-mode title
status: in_review
priority: p2
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:01.952Z
updated_at: 2026-08-07T12:15:03.412Z
---

**Finding.** Native textarea **resize grabbers** are visible on the panel title, the comment composer, and the create-mode title

## Source

`docs/cc_screens_diff.md` — **D-73**, § Cross-cutting, severity P2.

## Checklist

- [x] resize: none + auto-grow; the only textarea the spec gives a resize handle to is the description editor. <!-- longclaw:item=ck_f2dd4a5e -->

## Activity

<!-- longclaw:event
id: evt_0cf9a8e6
kind: create
occurred_at: 2026-08-05T15:16:01.952Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_28491b3a
kind: update
occurred_at: 2026-08-07T12:15:03.412Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: in_review
  - field: checklist.ck_f2dd4a5e.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Fixed: the create-mode title was the third field D-73 named, and the only one still clipping. The panel's title and composer had lost the grabber *and* gained an auto-grow (LC-108, LC-107); this one wears the same `.panel-title` rule, so it had `resize: none` over `overflow: hidden` and nothing sizing it — a long title disappeared into a two-row box. `useAutoGrow` moved to `autoGrow.ts` and the create title takes a ref from it; `rows` drops to 1, which it always meant. The description editor keeps its handle, as the spec says. `field-guard.mjs` now counts a call per field per component, so one CSS rule serving two components cannot half-apply again, and a test drives the growth with a stubbed `scrollHeight` since jsdom lays nothing out.
<!-- /longclaw:event -->
