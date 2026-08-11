---
format: longclaw.ticket/v1
id: b60012bf-0c57-42b9-8454-fed43f6cf136
key: LC-171
title: "Can't find a ticket by its key: typing LC-60 into the palette searches commands, not tickets"
status: done
priority: urgent
rank: a0
labels:
  - frontend
created_at: 2026-08-07T06:56:13.967Z
updated_at: 2026-08-11T11:29:58.753Z
---

Typing a ticket key is the fastest thing anyone knows how to do, and it finds nothing.

The palette opens in `root` mode (`CommandPalette.tsx:141`), where the query filters **command rows by label** (`CommandPalette.tsx:402`). `LC-60` matches no command, so the palette goes empty and the ticket is unreachable without first picking `Search tickets…` to enter `search` mode.

The index is not the problem. `TicketFile::search_text` puts the key first (`core/storage.rs:265-274`) and both sides lowercase and collapse whitespace, so `search_tickets` already answers `lc-60` correctly — as does the header's own filter field, which matches on key too (`filtering.ts`). Every layer beneath the palette can do this. Only the surface people reach for cannot.

The header filter is not the answer either: it narrows the project that is already open, and a key is exactly the thing you type when you are somewhere else.

## Approach

Something that recognises a query shaped like a ticket key at the root and offers that ticket. Whether that is a mode switch, a root row that appears when the query looks like a key, or making root search tickets and commands together is the design question. `keyboard-focus-map.md:100-103` already gives search-mode rows their behaviour, so a match at root should land on the same path rather than a second one.

Worth deciding at the same time: whether a bare number (`60`) counts, and whether the key must match this project's prefix.

## Checklist

- [x] A ticket key typed at the palette root finds that ticket <!-- longclaw:item=ck_49625bb4 -->
- [x] Decide whether a bare number and a foreign project prefix count <!-- longclaw:item=ck_6746d997 -->
- [x] The match uses the same open path as a search-mode row <!-- longclaw:item=ck_67b4f9b8 -->

## Activity

<!-- longclaw:event
id: evt_527764b1
kind: create
occurred_at: 2026-08-07T06:56:13.967Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_d894fe3b
kind: update
occurred_at: 2026-08-07T09:01:32.031Z
actor:
  type: human
  id: local
changes:
  - field: status
    from: todo
    to: in_progress
  - field: rank
    to: a0
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_560f1c70
kind: update
occurred_at: 2026-08-07T09:04:44.636Z
actor:
  type: human
  id: local
changes:
  - field: status
    from: in_progress
    to: todo
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_58cc16ba
kind: update
occurred_at: 2026-08-07T14:24:44.735Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: in_review
  - field: checklist.ck_49625bb4.checked
    from: "false"
    to: "true"
  - field: checklist.ck_6746d997.checked
    from: "false"
    to: "true"
  - field: checklist.ck_67b4f9b8.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_2860e372
kind: update
occurred_at: 2026-08-11T11:29:58.753Z
actor:
  type: human
  id: local
changes:
  - field: status
    from: in_review
    to: done
-->
### You updated this ticket
<!-- /longclaw:event -->
