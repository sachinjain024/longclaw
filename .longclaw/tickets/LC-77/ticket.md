---
format: longclaw.ticket/v1
id: 0e0e8495-e271-4bd7-bc80-79a1297cae83
key: LC-77
title: "Welcome / first launch — two columns: copy left, a permanently-visible create-form card right"
status: done
priority: p1
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:00.763Z
updated_at: 2026-08-07T06:27:06.140Z
---

**Prototype.** Single centered column

**App.** Two columns: copy left, a permanently-visible create-form card right

## Source

`docs/cc_screens_diff.md` — **D-11**, § Welcome / first launch, severity P1.

## Checklist

- [x] Restore the two-step flow: welcome → folder picker → create form. The form should not be on screen before a folder exists — it currently asks for a name and key with nowhere to put them. <!-- longclaw:item=ck_3123f052 -->

## Activity

<!-- longclaw:event
id: evt_3e76db40
kind: create
occurred_at: 2026-08-05T15:16:00.763Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_31c35822
kind: update
occurred_at: 2026-08-07T06:27:06.140Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: done
  - field: checklist.ck_3123f052.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->
