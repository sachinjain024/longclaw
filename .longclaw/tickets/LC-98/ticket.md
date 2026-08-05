---
format: longclaw.ticket/v1
id: 588c117b-22ea-485e-b847-5946eef3c3e8
key: LC-98
title: Ticket panel — fenced code blocks render as a solid black bar with no visible text
status: todo
priority: urgent
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:01.092Z
updated_at: 2026-08-05T15:16:01.092Z
---

**Prototype.** Fenced blocks render as readable code

**App.** **Fenced blocks render as a solid black bar with no visible text** (LC-119's ```` ```md ```` example)

## Plan

Same root cause: `.markdown-code { background: var(--lc-tile) }` (`styles.css:1705-1711`) with `.markdown-code code { background: transparent }` and inherited dark ink. Either give the block a light surface, or keep the dark tile and set `color: var(--lc-on-accent-agent)`/an explicit light ink. Decide once, in tokens.

## Source

`docs/cc_screens_diff.md` — **D-03**, § Ticket panel, severity P0.

## Checklist

- [ ] Same root cause: .markdown-code { background: var(--lc-tile) } (styles.css:1705-1711) with .markdown-code code { background: transparent } and inherited dark ink. Either give the block a light surface, or keep the dark tile and set color: var(--lc-on-accent-agent)/an explicit light ink. Decide… <!-- longclaw:item=ck_9620a903 -->

## Activity

<!-- longclaw:event
id: evt_9fbe807d
kind: create
occurred_at: 2026-08-05T15:16:01.092Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
