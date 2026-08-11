---
format: longclaw.ticket/v1
id: 573265bf-6cfd-43ad-a7b6-10452e4061ee
key: LC-43
title: Waitlist UI, consent copy, success, offline, and error states
status: canceled
priority: p4
labels:
  - frontend
  - v0-backlog
  - parked
created_at: 2026-08-05T14:23:17Z
updated_at: 2026-08-11T14:02:26.573Z
---

**Parked 2026-08-01** — Waitlist UI, consent copy, success, offline, and error states

## Why it exists

Only if V0-38 lands with an endpoint. Interest in the paid layer is worth measuring; a broken form is not. Parked ahead of both.

## Source

`docs/backlog/v0-backlog.md` — **V0-39**, Wave 4, step 15 (parked), owner Frontend (parked).

## Checklist

- [ ] Not an MVP gate while parked. On unparking: signup is optional and quiet, gates no local feature, introduces no telemetry, and a failure never touches local projects <!-- longclaw:item=ck_0957ddf9 -->

## Activity

<!-- longclaw:event
id: evt_fd31e808
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
id: evt_ece6eb5e
kind: update
occurred_at: 2026-08-11T14:02:26.573Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: backlog
    to: canceled
-->
### Claude Code updated this ticket

Obsolete: the precondition resolved the other way.

This ticket's own scope is "Only if V0-38 lands with an endpoint". V0-38 is LC-42, and LC-42 landed on omit rather than on an endpoint — LC-75, 2026-08-06, closed the waitlist as cut from v0, because no submission endpoint was ever reviewed and a v0 binary that posted an email would be the one network call in a product whose release gate (`audit:network`) exists to prove it makes none.

There is no form to build and nothing to build it against. The design is not lost: LC-75 deliberately kept § Waitlist and its states/keyboard/data companions intact under a `NOT IN V0` heading rather than deleting them, so an unparked Step 15 still has its design. Building it then is a new ticket against a reviewed endpoint.
<!-- /longclaw:event -->
