---
format: longclaw.ticket/v1
id: 016ec3ad-8e3f-4477-8b2e-0b5e1790132f
key: LC-47
title: Signing and notarization
status: backlog
priority: p1
labels:
  - release
  - post-mvp
created_at: 2026-08-05T14:23:17Z
updated_at: 2026-08-05T14:23:17Z
---

**Signing and notarization.** v0 ships unsigned with a documented Gatekeeper route

## Why now

The release notes tell a user to click through a security warning. That is honest and it is not a resting place: every install after this one pays the same tax, and the instruction trains a habit worth not training

## Source

`docs/backlog/post-mvp-backlog.md` — **P4**, Tier 1, owner Release.

## Checklist

- [ ] A Developer ID identity and a notarization request are recorded, and the release notes' § Opening the app the first time is deleted rather than softened <!-- longclaw:item=ck_c8bff8b2 -->

## Activity

<!-- longclaw:event
id: evt_e5e122eb
kind: create
occurred_at: 2026-08-05T14:23:17Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
