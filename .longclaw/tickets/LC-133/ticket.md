---
format: longclaw.ticket/v1
id: e5a5888a-8289-4319-8466-2943880d26d3
key: LC-133
title: Unparseable ticket file — the ticket vanishes from the board entirely
status: todo
priority: urgent
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:01.632Z
updated_at: 2026-08-05T15:16:01.632Z
---

**Prototype.** Degraded card renders in its last-known column

**App.** **The ticket vanishes from the board entirely.** Todo went 3 → 2, no card, no warning, no count change to explain it. It survives only in the list, hoisted to a synthetic `Unreadable` group at the very bottom (`grouping.ts:86-90`) — below the fold at the default window size

## Plan

This violates the "never silent" invariant (`states.md:9-12`). The row exists all the way through (`core/storage.rs:220`, `types.ts:181`, `boardCard.ts:38`) — it is only the *grouping* that drops it. Give a degraded row a placement: keep its directory's last-known status if the index has one, else render an `Unreadable` column at the end of the board. Do not let a file the user can see on disk be invisible in the app.

## Source

`docs/cc_screens_diff.md` — **D-50**, § Unparseable ticket file, severity P0.

## Checklist

- [ ] This violates the "never silent" invariant (states.md:9-12). The row exists all the way through (core/storage.rs:220, types.ts:181, boardCard.ts:38) — it is only the grouping that drops it. Give a degraded row a placement: keep its directory's last-known status if the index has one, else render an… <!-- longclaw:item=ck_0f4fa7fe -->

## Activity

<!-- longclaw:event
id: evt_2fb19a68
kind: create
occurred_at: 2026-08-05T15:16:01.632Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
