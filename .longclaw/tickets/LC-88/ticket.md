---
format: longclaw.ticket/v1
id: c7531ad0-20c8-46fa-ad37-2375100f26ea
key: LC-88
title: Empty project — the guide copy wraps the raw path over two lines and strands a period on a third
status: todo
priority: p3
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:00.939Z
updated_at: 2026-08-05T15:16:00.939Z
---

**Prototype.** Copy: "Title it, give it a checklist, point an agent at the folder."

**App.** "Every ticket is one file. This one will live under `<full absolute path>`." — the raw path wraps across two lines and a **stray `.` lands alone on a third line**

## Source

`docs/cc_screens_diff.md` — **D-25**, § Empty project, severity P3.

## Checklist

- [ ] The stray period comes from <code> …</code>. at App.tsx:1766 — the trailing text node wraps after a block-ish <code>. Move the period inside, or drop the path (it is already in the header) and use the prototype's copy. <!-- longclaw:item=ck_e96b067d -->

## Activity

<!-- longclaw:event
id: evt_1885464f
kind: create
occurred_at: 2026-08-05T15:16:00.939Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
