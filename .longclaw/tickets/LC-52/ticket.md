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
updated_at: 2026-08-05T14:23:17Z
---

**Plan 37's deferred design discrepancies.** Settings is an inline panel rather than the specified centered modal and its Remove flow has no confirming dialog naming the path; the content header is two stacked rows rather than one 56px header; Welcome is two columns rather than a centered one; the Phase 2 terminal region is unreserved; spacing and border literals are unrouted

## Why now

Each is a structural change to a surface rather than a visual pass, which is why plan 37 drew the line there. The settings modal is the one with a user-visible cost — a Remove flow with no confirmation naming the folder is a destructive-adjacent action without a guard

## Source

`docs/backlog/post-mvp-backlog.md` — **P8**, Tier 2, owner Design.

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
