---
format: longclaw.ticket/v1
id: c6d80b4c-7781-4f1f-a410-43934d438935
key: LC-52
title: Plan 37's deferred design discrepancies
status: backlog
priority: p2
labels:
  - design
  - post-mvp
created_at: 2026-08-05T14:23:17Z
updated_at: 2026-08-06T13:52:50.510Z
---

**Plan 37's deferred design discrepancies.** Settings is an inline panel rather than the specified centered modal and its Remove flow has no confirming dialog naming the path; the content header is two stacked rows rather than one 56px header; Welcome is two columns rather than a centered one; ~~the Phase 2 terminal region is unreserved~~ *(no longer a discrepancy — LC-74, 2026-08-06: the terminal is not shown in v0 at all, so an unreserved shell is the spec)*; spacing and border literals are unrouted

## Source

`docs/backlog/post-mvp-backlog.md` — **P8**, Tier 2, owner Design.

## Why now

Each is a structural change to a surface rather than a visual pass, which is why plan 37 drew the line there. The settings modal is the one with a user-visible cost — a Remove flow with no confirmation naming the folder is a destructive-adjacent action without a guard

## Activity

<!-- longclaw:event
id: evt_7be27eb0
kind: create
occurred_at: 2026-08-05T14:23:17Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_0da7b99c
kind: update
occurred_at: 2026-08-06T13:20:06.604Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: description
-->
### Claude Code updated this ticket

Dropped the terminal-reservation clause: LC-74 closed it on 2026-08-06 as not-in-v0, so an unreserved shell is now the spec rather than a deferred discrepancy. The other four items are untouched. `docs/backlog/post-mvp-backlog.md` P8 carries the same strike.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_be0501f7
kind: update
occurred_at: 2026-08-06T13:52:50.510Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: description
-->
### Claude Code updated this ticket

Restores the `## Source` section, which the previous edit dropped. That was unintended and unrecorded: the edit passed a replacement description assembled from the ticket body and omitted the section, and its event declared only `field: description` while stating the other items were untouched. The provenance link to `post-mvp-backlog.md` P8 — the row LC-74 had just amended — was the thing lost. Caught in review of the LC-74/LC-75 branch. The terminal-clause strike itself is unchanged.
<!-- /longclaw:event -->
