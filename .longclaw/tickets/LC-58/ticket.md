---
format: longclaw.ticket/v1
id: 41e997e7-e66f-478e-b527-5ad3527cc7b5
key: LC-58
title: The sync waitlist (V0-38, V0-39)
status: canceled
priority: p3
labels:
  - post-mvp
created_at: 2026-08-05T14:23:17Z
updated_at: 2026-08-11T14:02:26.553Z
---

The sync waitlist (V0-38, V0-39)

## Decision on record

**Parked**, not deferred, 2026-08-01

## Why this position

Parking is not a scope decision against it. Unpark with Step 15, or earlier if measuring demand for the paid layer becomes urgent

## Source

`docs/backlog/post-mvp-backlog.md` — **P14**, Tier 3.

## Activity

<!-- longclaw:event
id: evt_02bab32f
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
id: evt_9a836c79
kind: update
occurred_at: 2026-08-11T14:02:26.553Z
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

Duplicate. This is `post-mvp-backlog.md` P14, which tracks V0-38 and V0-39 — and those two are already LC-42 and LC-43, imported from `v0-backlog.md` in the same 2026-08-05 batch. It holds nothing they do not.

Both are now resolved. LC-75 closed the waitlist as cut from v0 on 2026-08-06: no submission endpoint was ever reviewed, and Step 15's own rule is to omit the feature from the binary rather than ship a form that fails silently. So LC-42's decision is made (omit) and LC-43 is closed with it.

Parking was never cancellation, and this does not make it one. The design survives on purpose — LC-75 kept `screen-specs.md` § Waitlist and its states, keyboard and data companions intact under a `NOT IN V0` heading precisely so Step 15 has something to build on. Unparking means filing fresh tickets against a reviewed endpoint, not reopening this row.
<!-- /longclaw:event -->
