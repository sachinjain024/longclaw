---
format: longclaw.ticket/v1
id: e2b168fd-fcd5-49a6-8fc9-5f28e3ee5f5a
key: LC-53
title: The repository cannot file its own tickets
status: done
priority: p2
labels:
  - product
  - post-mvp
created_at: 2026-08-05T14:23:17Z
updated_at: 2026-08-11T13:42:10.263Z
---

**The repository cannot file its own tickets.** [The CLI caveat](../../../docs/backlog/v0-backlog.md#the-cli-caveat-recorded-rather-than-resolved)

## Why now

Real evidence for a creation surface, but evidence about *our* workflow rather than a user's, which is why it stayed deferred. It stays deferred here too — listed so that the next person who writes a defect into `docs/plans/` knows why

## Source

`docs/backlog/post-mvp-backlog.md` — **P9**, Tier 2, owner Product.

## Activity

<!-- longclaw:event
id: evt_ca7f34c2
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
id: evt_eee912e6
kind: update
occurred_at: 2026-08-11T13:42:10.263Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: backlog
    to: done
-->
### Claude Code updated this ticket

Closed as already delivered — this ticket was filed already answered.

ADR 0011 ("The CLI is the creation surface agents use") names this item directly: "P9 and P11 in the post-MVP backlog are closed by this, ahead of their tier." LC-53 is P9. The v0 backlog's section heading is now struck through and marked resolved 2026-08-05, keeping the old argument only as the reasoning the decision was taken against, and AGENTS.md sends new work to `longclaw ticket create` rather than to docs/plans/.

The timing is why this sat in backlog: both backlogs were imported as LC-1…LC-58 on 2026-08-05, the same day the founder took the scope decision, so the ticket was born obsolete and its status was never moved. Its own creation entry — written by an agent, through the CLI — is the evidence that the repository can file its own tickets.

LC-55 (P11) is closed by the same ADR and its body says it and P9 move together, but its scope is slightly wider — a projection of the ticket store, against the ADR's projection of the records a command touched — so its read surface is worth checking before it is closed the same way.
<!-- /longclaw:event -->
