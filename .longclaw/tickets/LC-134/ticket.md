---
format: longclaw.ticket/v1
id: c8cc6098-f32a-479b-bf81-fd87479fc965
key: LC-134
title: Unparseable ticket file — it opens as the 560px right panel, and the surface behind paints through it — several lines of the file are covered by opaque white bands from the list rows underneath, so the file is partly unreadable
status: todo
priority: urgent
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:01.646Z
updated_at: 2026-08-05T15:16:01.646Z
---

**Prototype.** Raw file view is a 680px centered modal

**App.** It opens as the 560px right panel, **and the surface behind paints through it** — several lines of the file are covered by opaque white bands from the list rows underneath, so the file is partly unreadable

## Source

`docs/cc_screens_diff.md` — **D-51**, § Unparseable ticket file, severity P0.

## Checklist

- [ ] Same root cause as D-01 (z-index). Also decide modal-vs-panel: the spec says modal, and a modal removes the layering problem entirely. <!-- longclaw:item=ck_63f38b7a -->

## Activity

<!-- longclaw:event
id: evt_2c273c12
kind: create
occurred_at: 2026-08-05T15:16:01.646Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
