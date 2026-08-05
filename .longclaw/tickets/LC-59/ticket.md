---
format: longclaw.ticket/v1
id: c5ea5c83-f606-4626-8fb1-61462fa1085d
key: LC-59
title: Two writes inside one second leave the timeline order to a random event id
status: todo
priority: p3
labels:
  - domain
created_at: 2026-08-05T14:23:58Z
updated_at: 2026-08-05T14:23:58Z
---

`occurred_at` is written at second precision (`SecondsFormat::Secs`), and the timeline breaks a tie on the event id, which is a random suffix (`core/ticket.rs:521`, `timelineEvents.ts:59`). Two writes inside the same second therefore order by dice rather than by history.

## How it was found

Importing the two backlogs on 2026-08-05. Each already-passed row was created and then had its must-pass item checked, and **15 of the 33 rendered "Claude Code updated this ticket" above "Claude Code created this ticket"**. The import worked around it by waiting for the clock to cross a second boundary before the second write; the app has no such wait.

## Why it exists

A user can reach it without trying: create a ticket and tick a checklist item straight away, or send two mutations from one interaction. The entry is truthful and the order is not, which reads as the app losing track of its own history — the one thing the activity model exists to be trusted about.

The tie-breaker is not the bug. It makes the order *deterministic*, which is what it was for; it was never able to make it *correct*.

## Options

- Write `occurred_at` at millisecond precision. `instant_of` already parses mixed precision, and `events_sort_by_instant_even_when_precision_differs` already covers the mixed case, so the reader needs no change.
- Or make the id monotonic within a file, so the tie-break carries write order.

The first is smaller and the format contract already allows it: timestamps are RFC 3339 strings, and nothing in it fixes the precision.

## Checklist

- [ ] Two events written in the same second render create-before-update in the panel and in the file, with a test that writes both inside one second and fails against the current second-precision timestamp <!-- longclaw:item=ck_fc6234d7 -->

## Activity

<!-- longclaw:event
id: evt_d87a9f9d
kind: create
occurred_at: 2026-08-05T14:23:58Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
