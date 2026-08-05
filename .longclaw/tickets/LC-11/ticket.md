---
format: longclaw.ticket/v1
id: 7c3e269f-2a47-4f72-9846-33345d5e6de9
key: LC-11
title: Archive and unarchive, with the archived group in the list
status: done
priority: p1
labels:
  - domain
  - v0-backlog
created_at: 2026-08-05T14:22:54Z
updated_at: 2026-08-05T14:22:55Z
---

~~Archive and unarchive, with the archived group in the list~~ **Done 2026-07-31** — the mutation the two finished halves were missing. Archived tickets leave `groupByStatus` in `src/grouping.ts` rather than leaving the board in `Board.tsx`: archived is a date and not a status (ADR 0004), so a ticket carrying one has no status bucket, and every caller inherits that instead of the board owning a rule a third surface could forget. The write is raised in `App.tsx` beside `changePriority`, not through the panel's `save()`, because archiving closes the panel and a mutation whose revert, toast, undo and conflict all live in component state cannot survive its own unmount; the panel keeps a ghost Archive/Unarchive button and an `archived` chip, takes its archived state from the same store row the board and list read, and writes nothing. Unarchiving leaves the panel open. Nothing in Rust changed. [Plan 17](../../../docs/plans/completed/17-archive-and-unarchive.md)

## Must-pass

Passed every clause. **Never moves or deletes:** `archiving_sets_archived_at_and_leaves_the_directory_where_it_is` compares the ticket directory's whole listing before and after an archive and the unarchive after it, with the status and title untouched — confirmed red with the `archived` branch of `apply` disabled. **Leaves the board:** three `Board.test.tsx` claims and the V0-14 agreement test, which now asserts the disagreement it is allowed. **Stays findable:** `an_archived_ticket_is_still_found_by_search` archives `LC-2` and finds it by title, by key and in the empty query, with `archivedAt` still on the row — confirmed red with an archived filter injected into `TicketIndex::search`. **Unarchives cleanly:** the App-level round trip, whose Undo writes the inverse against the hash the first write returned. Ten frontend claims confirmed failing first. **Two things worth a look:** the **`· archived` tag on a search result is not done and is not claimed here** — there is no search UI in the app at all, so it lands with V0-24; and a conflict on this mutation reverts to a danger toast whose Retry re-sends the captured hash, which is `changePriority`'s inherited wart rather than a new one

## Source

`docs/backlog/v0-backlog.md` — **V0-11**, Wave 1, step 11, owner Domain.

## Checklist

- [x] Passed every clause. Never moves or deletes: archiving_sets_archived_at_and_leaves_the_directory_where_it_is compares the ticket directory's whole listing before and after an archive and the unarchive after it, with the status and title untouched — confirmed red with the archived branch of apply… <!-- longclaw:item=ck_cd664a92 -->

## Activity

<!-- longclaw:event
id: evt_91ef3eb1
kind: create
occurred_at: 2026-08-05T14:22:54Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_9aaefe6d
kind: update
occurred_at: 2026-08-05T14:22:55Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_cd664a92.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Imported from `docs/backlog/v0-backlog.md`. The must-pass verification for V0-11 is recorded there as passed.
<!-- /longclaw:event -->
