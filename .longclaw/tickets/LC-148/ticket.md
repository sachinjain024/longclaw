---
format: longclaw.ticket/v1
id: cb44f3fd-7f6c-41ef-aa9b-347b330dd91a
key: LC-148
title: External update / agent freshness — an unknown-actor change gets the full agent-green treatment and a warn triangle — the two vocabularies are mixed on one line
status: todo
priority: p3
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:01.864Z
updated_at: 2026-08-05T15:16:01.864Z
---

**Prototype.** Agent green is for agent writes; an unknown actor gets the **warn** treatment (`states.md:150-152`)

**App.** An unknown-actor change gets the full agent-green treatment *and* a warn triangle — the two vocabularies are mixed on one line

## Source

`docs/cc_screens_diff.md` — **D-62**, § External update / agent freshness, severity P3.

## Checklist

- [ ] Pick per attribution: agent → green + ❯; unknown → warn + triangle. <!-- longclaw:item=ck_b160d938 -->

## Activity

<!-- longclaw:event
id: evt_64df619f
kind: create
occurred_at: 2026-08-05T15:16:01.864Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
