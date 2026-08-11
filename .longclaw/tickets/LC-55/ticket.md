---
format: longclaw.ticket/v1
id: 2833b489-9b60-4307-a820-abfa2fdd3330
key: LC-55
title: CLI or JSON projection of the ticket store
status: done
priority: p3
labels:
  - post-mvp
created_at: 2026-08-05T14:23:17Z
updated_at: 2026-08-11T14:03:32.400Z
---

CLI or JSON projection of the ticket store

## Decision on record

Useful after MVP, with the caveat above

## Why this position

Step 3 left it optional and it did not delay the round trip. It is what would let LongClaw track LongClaw, so it and P9 move together

## Source

`docs/backlog/post-mvp-backlog.md` — **P11**, Tier 3.

## Activity

<!-- longclaw:event
id: evt_99a34184
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
id: evt_b3fd46a7
kind: update
occurred_at: 2026-08-11T14:03:32.400Z
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

Already done, and this ticket's own source table says so. `post-mvp-backlog.md` P11 reads "~~CLI or JSON projection of the ticket store~~ **Done 2026-08-05**" — struck on the same day this ticket was imported from that table, so the import copied the row without its strike.

The CLI is real, and it is the surface this repository files its own tickets with: `longclaw ticket create | edit | list | show`, plus `project` and `label`, printing JSON on stdout and a typed error on stderr with a non-zero exit ([ADR 0011](../../../docs/adr/0011-cli-is-the-creation-surface-agents-use.md), `AGENTS.md` § Issue tracker).

P11's two predictions both held. It said this would move with P9 — P9 is LC-53, "The repository cannot file its own tickets", also done 2026-08-05. And it said this is what would let LongClaw track LongClaw: this comment was written by that binary, against a project of 200 tickets.

Two defects found in it since are tracked on their own tickets, both closed — LC-59 (second-precision timestamps ordering two writes by a random event id) and LC-155 (`npm run dev` could not choose between the app and CLI binaries).
<!-- /longclaw:event -->
