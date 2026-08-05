---
format: longclaw.ticket/v1
id: 5f183a57-5285-4818-bb0e-8dff72015520
key: LC-18
title: Preserve attachment registry records losslessly with no attachment UI
status: done
priority: p1
labels:
  - storage
  - v0-backlog
created_at: 2026-08-05T14:23:01Z
updated_at: 2026-08-05T14:23:02Z
---

Preserve attachment registry records losslessly with no attachment UI

## Why it exists

ADR 0005 ships the on-disk attachment format without UI. An agent may already register attachments, and the app must not drop what it does not render.

## Must-pass

Done 2026-07-31. `attachment_records_survive_every_mutation_byte_identically` compares the raw `## Attachments` bytes before and after title, status, priority, labels, rank, archive, unarchive, description, checklist toggle, checklist append, and comment, over a new `valid-attachment-records-preserved` fixture carrying a media type outside the v0 `image/*`, `text/*`, `video/*` set and a record with fields this build does not interpret. It already held by construction; the assertion is the proof, and it was confirmed to fail against an injected rewrite of the attachments chunk. **Amended 2026-08-01:** *every* mutation now means every one. The matrix omitted `rank: Some(None)` — `TicketEdit.rank` is `Option<Option<String>>` and clearing is its own arm of `apply` and its own wire value, sent whenever a human undoes the drop that gave a card its first rank. It runs against the result of the rank set, the way unarchive runs against the archive, and was confirmed red on its own: an attachments rewrite injected into the clear arm alone fails `rank clear` and no other case. No attachment UI and no app-created registry entries (ADR 0005). [Plan 12](../../../docs/plans/completed/12-rust-backend-for-wave-1.md)

## Source

`docs/backlog/v0-backlog.md` — **V0-18**, Wave 1, step 11, owner Storage.

## Checklist

- [x] Done 2026-07-31. attachment_records_survive_every_mutation_byte_identically compares the raw ## Attachments bytes before and after title, status, priority, labels, rank, archive, unarchive, description, checklist toggle, checklist append, and comment, over a new valid-attachment-records-preserved… <!-- longclaw:item=ck_694cbb7c -->

## Activity

<!-- longclaw:event
id: evt_f5edfcd2
kind: create
occurred_at: 2026-08-05T14:23:01Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_e053e4d5
kind: update
occurred_at: 2026-08-05T14:23:02Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_694cbb7c.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Imported from `docs/backlog/v0-backlog.md`. The must-pass verification for V0-18 is recorded there as passed.
<!-- /longclaw:event -->
