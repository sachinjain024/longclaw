---
format: longclaw.ticket/v1
id: c5ea5c83-f606-4626-8fb1-61462fa1085d
key: LC-59
title: The CLI wrote second-precision timestamps, so two of its writes ordered by a random event id
status: done
priority: p3
labels:
  - format
created_at: 2026-08-05T14:23:58Z
updated_at: 2026-08-05T14:47:07.917Z
---

**Corrected 2026-08-05, after the ticket was filed.** The premise below was wrong in the part that mattered: it blamed the app, and the app never had this. `engine::now` has always written milliseconds (`SecondsFormat::Millis`, `engine.rs:781`). The CLI added on the same day wrote seconds (`SecondsFormat::Secs`), which is what tied its own two writes.

Found by the app itself: three tickets filed from the window while the merge was in flight carry `occurred_at: …T14:44:30.610Z`, and every imported ticket carries a bare second. One project, two writers, two precisions.

## What actually happened

`occurred_at` is sorted by instant and ties break on the event id, which is a random suffix (`core/ticket.rs:521`, `timelineEvents.ts:59`). Importing the two backlogs created each already-passed row and then checked its must-pass item, and **15 of the 33 rendered "Claude Code updated this ticket" above "Claude Code created this ticket"** — inside one second, the dice decided. The import worked around it by waiting for the clock to turn.

The workaround was treating the symptom. The cause was one word in `cli::now`.

## Fix

`cli::now` writes `SecondsFormat::Millis`, matching the engine, pinned by `a_timestamp_carries_the_precision_the_app_writes`. Two writers at one precision cannot tie the way these did.

## What was left alone

The 58 imported tickets keep their second-precision stamps. They are valid — the format contract fixes no precision, `instant_of` parses both, and `events_sort_by_instant_even_when_precision_differs` covers the mix. Their order is already correct, and rewriting 58 files to change a timestamp format would be churn with a real risk and no reader.

The id tie-breaker stays as it is. It makes an order deterministic, which is what it was for; it was never able to make one correct.

## Checklist

- [x] Two events written in the same second render create-before-update in the panel and in the file, with a test that writes both inside one second and fails against the current second-precision timestamp <!-- longclaw:item=ck_fc6234d7 -->

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

<!-- longclaw:event
id: evt_79d77e66
kind: update
occurred_at: 2026-08-05T14:47:07.917Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: title
    from: Two writes inside one second leave the timeline order to a random event id
    to: The CLI wrote second-precision timestamps, so two of its writes ordered by a random event id
  - field: status
    from: todo
    to: done
  - field: labels
    from: domain
    to: format
  - field: description
  - field: checklist.ck_fc6234d7.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Reopened my own premise and closed it against the real cause. The app was not at fault — the CLI I added the same day was, and the evidence that showed it was three tickets a human filed from the app while this was being merged.
<!-- /longclaw:event -->
