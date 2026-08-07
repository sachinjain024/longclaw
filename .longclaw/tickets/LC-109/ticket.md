---
format: longclaw.ticket/v1
id: c540e37a-9f28-47f4-aa7d-ee8bd741f45f
key: LC-109
title: Ticket panel — activity heading carries the entry count — No count
status: done
priority: p3
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:01.253Z
updated_at: 2026-08-07T01:20:18.926Z
---

**Prototype.** `Activity` heading carries the entry count

**App.** No count

## Source

`docs/cc_screens_diff.md` — **D-3H**, § Ticket panel, severity P3.

## Checklist

- [x] Add it. <!-- longclaw:item=ck_0d94c10d -->

## Activity

<!-- longclaw:event
id: evt_2211c8ed
kind: create
occurred_at: 2026-08-05T15:16:01.253Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_c652b113
kind: update
occurred_at: 2026-08-07T01:20:18.926Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: done
  - field: checklist.ck_0d94c10d.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

The Activity heading carries its entry count (D-3H). It counts what is on screen rather than what the file holds, so an optimistic comment is in it: posting renders the entry before the write returns, and a heading one short of what the reader can see would be the one place the panel argued with itself. .checklist-fraction became .section-count on the way — the checklist's fraction and the activity count are one object in the prototype (prototype.js:729, :746) and differ only in what they count, so CreatePanel's fraction moved with it.
<!-- /longclaw:event -->
