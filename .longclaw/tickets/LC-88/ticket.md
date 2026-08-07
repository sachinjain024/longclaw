---
format: longclaw.ticket/v1
id: c7531ad0-20c8-46fa-ad37-2375100f26ea
key: LC-88
title: Empty project — the guide copy wraps the raw path over two lines and strands a period on a third
status: done
priority: p3
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:00.939Z
updated_at: 2026-08-07T08:07:12.538Z
---

**Prototype.** Copy: "Title it, give it a checklist, point an agent at the folder."

**App.** "Every ticket is one file. This one will live under `<full absolute path>`." — the raw path wraps across two lines and a **stray `.` lands alone on a third line**

## Source

`docs/cc_screens_diff.md` — **D-25**, § Empty project, severity P3.

## Checklist

- [x] The stray period comes from <code> …</code>. at App.tsx:1766 — the trailing text node wraps after a block-ish <code>. Move the period inside, or drop the path (it is already in the header) and use the prototype's copy. <!-- longclaw:item=ck_e96b067d -->

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

<!-- longclaw:event
id: evt_0d1b0e87
kind: update
occurred_at: 2026-08-07T08:07:12.538Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: done
  - field: checklist.ck_e96b067d.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Done, by the item's second option: the path is dropped rather than the period moved inside the `<code>`. It is already in the header chip (D-06), and a 264px card is the last place an absolute path should be asked to wrap. The copy is the prototype's — "Title it, give it a checklist, point an agent at the folder." — so there is no `<code>` left for a text node to wrap after.
<!-- /longclaw:event -->
