---
format: longclaw.ticket/v1
id: bba4d152-3249-4e87-ae61-f5288a651263
key: LC-76
title: Welcome / first launch — the 240px sidebar stays visible with No starred projects / No local projects placeholders
status: done
priority: p1
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:00.748Z
updated_at: 2026-08-07T06:26:59.169Z
---

**Prototype.** Full-window; no app shell

**App.** The 240px sidebar stays visible with `No starred projects` / `No local projects` placeholders

## Source

`docs/cc_screens_diff.md` — **D-10**, § Welcome / first launch, severity P1.

## Checklist

- [x] Render Welcome above the shell when projects.length === 0 — the welcome screen is the no-projects state, and an empty sidebar is a second, weaker statement of the same thing. <!-- longclaw:item=ck_06e4a02a -->

## Activity

<!-- longclaw:event
id: evt_f6601a8a
kind: create
occurred_at: 2026-08-05T15:16:00.748Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_488a2552
kind: update
occurred_at: 2026-08-07T06:26:59.169Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: done
  - field: checklist.ck_06e4a02a.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->
