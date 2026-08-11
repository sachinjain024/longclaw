---
format: longclaw.ticket/v1
id: 9611513f-f3ca-46f4-8cf8-b102b3cb1cd7
key: LC-151
title: Cross-cutting — the open project is not restored on relaunch — it always falls back to the first registry entry
status: done
priority: p2
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:01.913Z
updated_at: 2026-08-11T11:33:01.424Z
---

**Finding.** **The open project is not restored on relaunch** — it always falls back to the first registry entry

## Source

`docs/cc_screens_diff.md` — **D-71**, § Cross-cutting, severity P2.

## Checklist

- [x] Already recorded as a clean-machine finding (8578f73). Listed here only because it is visible on every screen. <!-- longclaw:item=ck_03cfd55b -->

## Activity

<!-- longclaw:event
id: evt_ded9faa9
kind: create
occurred_at: 2026-08-05T15:16:01.913Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_133c681e
kind: update
occurred_at: 2026-08-07T12:15:50.371Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: in_review
  - field: checklist.ck_03cfd55b.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Fixed with LC-150, and worth separating from it on cause. This one's cause is on the record and is not a storage failure: 8578f73 diagnosed it as never persisted at all — `activeProjectId` lived only in the in-memory store and the registry had no field for it — and the persistence it was missing landed the day after this ticket was filed, with LC-49.

So what LC-151 adds is that the value LC-49 started writing outlives the process by construction. The remembered id is part of the device-preferences document Rust keeps; it is still an opaque hint and not a second project reference, so startup asks the registry whether it is real and reachable before opening anything, which is the condition ADR 0006 attached to it and ADR 0012 keeps.

Verified on the packaged bundle, since a relaunch with two projects registered is what this ticket is about: with the second project remembered, the app comes up on the second project; with nothing remembered, it opens the first registry entry and records it — the control that proves the file reflects which project actually opened. In the suite it is a test rather than a manual pass: the process forgets what it holds and reads the document again.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_e86b32f2
kind: update
occurred_at: 2026-08-11T11:33:01.424Z
actor:
  type: human
  id: local
changes:
  - field: status
    from: in_review
    to: done
-->
### You updated this ticket
<!-- /longclaw:event -->
