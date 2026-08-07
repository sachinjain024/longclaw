---
format: longclaw.ticket/v1
id: 2db763df-af9c-4955-b574-0a2cd28f4f3d
key: LC-172
title: "Attachments: paste an image into a description or comment and have it land in the ticket's folder"
status: backlog
priority: p2
rank: a0
labels:
  - frontend
  - format
created_at: 2026-08-07T06:56:34.384Z
updated_at: 2026-08-07T10:56:36.948Z
---

The file format already has attachments; the app has never been able to make one.

`docs/file_format.md:86-98` defines the bounded `longclaw:attachment` record and `docs/file_format.md:261-269` puts the bytes under `.longclaw/tickets/<KEY>/attachments/`. `TicketRow` carries `attachmentCount` and `TicketDetail` carries `attachments` (`types.ts`), and Rust parses and preserves the records (`core/ticket.rs`, `core/storage.rs`). What is missing is every half a human touches: no way to add one, and `markdown.ts` notes there is no attachment UI to open (ADR 0005).

Paste is the interaction that matters. A screenshot is the most common thing anyone wants to put on a ticket, and going out to a file picker to save it first is what stops people.

## What this has to decide

- **Where the bytes go.** The folder is settled by the format. The naming is not: the format's example is `att_7d2a-debug-log.txt`, so a pasted image needs an id and a name it never had.
- **What the description holds.** The format writes a Markdown link beside the record. A pasted image should render, which is an `![]()` and a relative path the webview cannot resolve today — the same wall ADR 0005 hit.
- **Comments as well as descriptions**, since the ask is both, and comments are a different record in `ticket.md`.
- **Refusing rather than truncating.** A size cap, and what the app says when it declines — this is the one path that writes bytes the user cannot see the size of.
- **What a ticket does with an attachment whose file is gone.** The non-destructive invariant (`states.md:9-12`) says never repair; the record stays and the surface says so.

## Not in this

Video, drag-and-drop from the desktop, and reordering. Paste an image, see it, and have it be a real file on disk that git can hold.

## Checklist

- [ ] Pasting an image into the description writes it under the ticket's attachments/ and registers it <!-- longclaw:item=ck_e7158c2f -->
- [ ] The same works in a comment <!-- longclaw:item=ck_841aefba -->
- [ ] A registered image renders in the description rather than showing a broken link <!-- longclaw:item=ck_16b0efaa -->
- [ ] A size cap that refuses out loud rather than truncating <!-- longclaw:item=ck_7f79a3b3 -->
- [ ] A record whose file is missing says so and is never repaired away <!-- longclaw:item=ck_7a853916 -->

## Activity

<!-- longclaw:event
id: evt_617e7701
kind: create
occurred_at: 2026-08-07T06:56:34.384Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_6579b188
kind: update
occurred_at: 2026-08-07T09:55:21.550Z
actor:
  type: human
  id: local
changes:
  - field: rank
    to: a0
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_81029151
kind: update
occurred_at: 2026-08-07T09:56:28.851Z
actor:
  type: human
  id: local
changes:
  - field: status
    from: todo
    to: in_progress
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_ac6ea0f8
kind: update
occurred_at: 2026-08-07T10:51:29.560Z
actor:
  type: human
  id: local
changes:
  - field: status
    from: in_progress
    to: todo
  - field: rank
    from: a0
    to: Zy
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_2771b988
kind: update
occurred_at: 2026-08-07T10:51:42.282Z
actor:
  type: human
  id: local
changes:
  - field: status
    from: todo
    to: in_progress
  - field: rank
    from: Zy
    to: a0
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_bb9a51f1
kind: update
occurred_at: 2026-08-07T10:56:36.948Z
actor:
  type: human
  id: local
changes:
  - field: status
    from: in_progress
    to: backlog
-->
### You updated this ticket
<!-- /longclaw:event -->
