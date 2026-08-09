---
format: longclaw.ticket/v1
id: b629addc-7b35-4f31-a5b7-94fb37912ead
key: LC-168
title: Storage — a ticket.md with no frontmatter at all has no test, and was observed missing even from the Unreadable group
status: done
priority: p1
labels:
  - storage
created_at: 2026-08-07T05:42:13.651Z
updated_at: 2026-08-09T00:44:20.732Z
---

**Observed 2026-08-05.** A ticket whose `ticket.md` has no frontmatter at all — not even an opening `---` fence — was dropped even from the `Unreadable` group. It never reached the degraded path, so a file sitting on disk was invisible in the app. That is the `states.md:9-12` "never silent" invariant.

**What the code says now.** `TicketDocument::parse` does refuse it, with a located diagnostic: `"ticket.md must begin with a --- frontmatter delimiter"` at line 1 (`core/ticket.rs:450-452`). So the parse side has an answer. What is missing is any test that a file in that shape becomes a degraded record and reaches a snapshot — `core/storage.rs` covers a foreign directory (`:1518`) and a non-UTF-8 file (`:1571`), and nothing covers this one.

Start with the test. If it passes, the row is being lost somewhere after the parse and the original observation is still live. If it fails, it names the defect directly.

Related but not the same: LC-133 is the degraded card's *placement* (last-known column), which assumes the row arrives at all.

## Source

`docs/cc_screens_diff.md` § 15, "Also observed" — the one finding in that section that was never given a `D-` number, and so was never swept into LC-133…LC-138.

## Checklist

- [x] Add the Rust-side test in core/storage.rs: a ticket.md with no --- fence becomes a degraded record carrying its raw bytes and a diagnostic, the way the foreign-directory and non-UTF-8 cases already do. <!-- longclaw:item=ck_0c5fba72 -->
- [x] If that test passes, reproduce the original observation end to end and find where the degraded row is dropped between the snapshot and the Unreadable group. <!-- longclaw:item=ck_5c18ec79 -->

## Activity

<!-- longclaw:event
id: evt_15e2c0c8
kind: create
occurred_at: 2026-08-07T05:42:13.651Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_790ca967
kind: update
occurred_at: 2026-08-09T00:44:20.732Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: done
  - field: checklist.ck_0c5fba72.checked
    from: "false"
    to: "true"
  - field: checklist.ck_5c18ec79.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Both items are closed, and the second one closes as *not reproducing*.

The parse side had an answer already, so the new coverage is the two places that never had any. `a_file_with_no_frontmatter_fence_becomes_a_degraded_record_with_its_bytes_intact` (core/storage.rs) reads a valid-UTF-8 file in this project's own directory that opens no fence, and asserts the degraded record and the `TicketRow::Degraded` it produces — the located diagnostic D-52 needs, the bytes left alone. `a_ticket_file_with_no_frontmatter_reaches_the_snapshot_as_a_degraded_row` (tests/storage_integration.rs) plants one in a real project and reads it back off the engine's snapshot, its detail, and a rebuild.

Both pass as written, so the row is not lost after the parse either — and the search the checklist asked for came up empty on the rest of the chain. scan_ticket_paths finds it by directory, rebuild keeps every row a read returns, the row serialises as any other degraded one, filterTickets exempts it by state, and groupByStatus sends a degraded row with no remembered seat to Unreadable on both surfaces. IssueList's own case is even written on a `"no frontmatter"` diagnostic.

What the 2026-08-05 observation saw was D-50: every degraded card vanished from the board, whatever had broken the file. LC-133 closed that on 2026-08-07 by lending the row its directory's last-known seat, and this shape came back with the rest. Nothing here is specific to a missing fence, which is why it never needed its own `D-` number — what it needed was the test.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_574c4329
kind: comment
occurred_at: 2026-08-09T00:56:27.243Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Review found a real gap in the above, and it is closed now.

The two tests I had written both plant or read the file *before* the engine starts, which is the cold path. The observation was made the other way — § 15's method is `Reproduced by hand-breaking LC-133/ticket.md with the app running` — and the live path is a different one: watcher burst, then `ingest_attributing` rather than `rebuild`. The existing break-in-place test there (`a_ticket_that_becomes_unreadable_degrades_in_place`) breaks a `status:` value, so the file still has frontmatter and the parser still reaches a field. The fenceless shape, which is refused before that, had no live-path coverage at all.

`a_ticket_whose_frontmatter_is_taken_away_entirely_degrades_in_place_too` (tests/watcher_integration.rs) is that case: the frontmatter is taken away under a running engine, and the row arrives as a change event — there is no event for a row the pipeline dropped, so reaching the assertion is itself the half that was never tested — degrades with its located diagnostic, and keeps its last-known column. Putting the frontmatter back brings the ticket back.

That last assertion is worth stating plainly, because it corrects the emphasis of my previous comment: on the live path this file lands in `In Progress`, not `Unreadable`. `Unreadable` is the fallback for a directory the session never saw parse, which is the cold path's answer. Both are now written down, and each test says which one it is.

Also from the review: the integration test now asserts the write refusal its two neighbours assert, and § 15's superseded sentences are struck rather than merely contradicted by the paragraph below them.
<!-- /longclaw:event -->
