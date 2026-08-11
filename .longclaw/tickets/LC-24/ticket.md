---
format: longclaw.ticket/v1
id: 3c62ec71-bd3b-4d6b-b278-b051d8530c73
key: LC-24
title: Search UI over the existing index, with empty and no-result states
status: done
priority: p2
labels:
  - frontend
  - v0-backlog
created_at: 2026-08-05T14:23:03Z
updated_at: 2026-08-11T14:03:11.004Z
---

Search UI over the existing index, with empty and no-result states

## Why it exists

The backend already searches; without a surface the user cannot find a ticket they cannot see, which is the normal case in a real repository.

## Must-pass

Search matches keys, titles, labels, and descriptions inside the Step 4 budget; no-result and empty states match the spec. **Inherited from V0-11:** archived tickets are already returned by `search_tickets` and pinned by a Rust test, and their `· archived` tag (`screen-specs.md:154`, `:236`) is this item's to render — the row carries `archivedAt`

## Source

`docs/backlog/v0-backlog.md` — **V0-24**, Wave 2, step 12, owner Frontend.

## Checklist

- [x] Search matches keys, titles, labels, and descriptions inside the Step 4 budget; no-result and empty states match the spec. Inherited from V0-11: archived tickets are already returned by search_tickets and pinned by a Rust test, and their · archived tag (screen-specs.md:154, :236) is this item's to… <!-- longclaw:item=ck_6a7d3e05 -->

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

<!-- longclaw:event
id: evt_47531083
kind: update
occurred_at: 2026-08-11T14:03:11.004Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: backlog
    to: done
  - field: checklist.ck_6a7d3e05.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Already shipped on 2026-08-01, before this ticket was filed. V0-24 is [plan 27](../../../docs/plans/completed/27-search-surface.md), closed as "Indexed search, result states, archived/degraded rows, and interaction budgets are complete", under the Step 12 completion at `docs/plans/active/README.md:36`.

Verified in the tree, both halves of the must-pass:

- The surface is the palette's search sub-mode (`CommandPalette.tsx:276`). The empty query is treated as a real query answered with the first page rather than as no query at all (`:204`), and the no-result state renders `No matches` with `Searching…` while a query is in flight, in a `role="status"` region (`:623-624`).
- The clause inherited from V0-11 holds too: rows carry the quiet trailing `· archived` tag (`:57`, `:110`, `:130`), built from the row's own `archivedAt` as plan 17's outcome said it would be.

LC-171 later closed the one real gap left in this surface — typing a key like `LC-60` searched commands rather than tickets — and that is recorded there, not here.

Filed by the 2026-08-05 import off the unstruck `v0-backlog.md:139` row.
<!-- /longclaw:event -->
