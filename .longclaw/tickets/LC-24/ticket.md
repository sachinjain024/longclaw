---
format: longclaw.ticket/v1
id: 3c62ec71-bd3b-4d6b-b278-b051d8530c73
key: LC-24
title: Search UI over the existing index, with empty and no-result states
status: backlog
priority: p2
labels:
  - frontend
  - v0-backlog
created_at: 2026-08-05T14:23:03Z
updated_at: 2026-08-05T15:14:39.637Z
---

Search UI over the existing index, with empty and no-result states

## Why it exists

The backend already searches; without a surface the user cannot find a ticket they cannot see, which is the normal case in a real repository.

## Must-pass

Search matches keys, titles, labels, and descriptions inside the Step 4 budget; no-result and empty states match the spec. **Inherited from V0-11:** archived tickets are already returned by `search_tickets` and pinned by a Rust test, and their `· archived` tag (`screen-specs.md:154`, `:236`) is this item's to render — the row carries `archivedAt`

## Source

`docs/backlog/v0-backlog.md` — **V0-24**, Wave 2, step 12, owner Frontend.

## Checklist

- [ ] Search matches keys, titles, labels, and descriptions inside the Step 4 budget; no-result and empty states match the spec. Inherited from V0-11: archived tickets are already returned by search_tickets and pinned by a Rust test, and their · archived tag (screen-specs.md:154, :236) is this item's to… <!-- longclaw:item=ck_6a7d3e05 -->

## Activity

<!-- longclaw:event
id: evt_4459ab62
kind: create
occurred_at: 2026-08-05T14:23:03Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_18c2135d
kind: update
occurred_at: 2026-08-05T15:14:39.637Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: backlog
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->
