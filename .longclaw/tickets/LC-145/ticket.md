---
format: longclaw.ticket/v1
id: 581701d1-a0e3-471e-bbcf-abee6d909397
key: LC-145
title: Folder missing / unreachable — the copy is registry-speak, and the banner sentence is a run-on
status: done
priority: p3
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:01.819Z
updated_at: 2026-08-07T03:15:54.485Z
---

**Prototype.** Copy names the causes and the guarantee: "The project folder moved, or its disk isn't mounted. Your tickets are safe in their files — LongClaw never deletes or rewrites them, and this project stays listed until you decide."

**App.** "The registry entry was kept, but the folder cannot be opened from this path. Select its new location or remove only this app reference." — registry-speak, and **the banner copy is ungrammatical**: "The selected project folder is no longer available The file was left as it was." (missing sentence break)

## Source

`docs/cc_screens_diff.md` — **D-5C**, § Folder missing / unreachable, severity P3.

## Checklist

- [x] Rewrite to the prototype's copy. Fix the run-on sentence regardless. <!-- longclaw:item=ck_fa467db5 -->

## Activity

<!-- longclaw:event
id: evt_87775603
kind: create
occurred_at: 2026-08-05T15:16:01.819Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_062f17b6
kind: update
occurred_at: 2026-08-07T03:15:54.485Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: done
  - field: checklist.ck_fa467db5.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->
