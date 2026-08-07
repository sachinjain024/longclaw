---
format: longclaw.ticket/v1
id: b629addc-7b35-4f31-a5b7-94fb37912ead
key: LC-168
title: Storage — a ticket.md with no frontmatter at all has no test, and was observed missing even from the Unreadable group
status: todo
priority: p1
labels:
  - storage
created_at: 2026-08-07T05:42:13.651Z
updated_at: 2026-08-07T05:42:13.651Z
---

**Observed 2026-08-05.** A ticket whose `ticket.md` has no frontmatter at all — not even an opening `---` fence — was dropped even from the `Unreadable` group. It never reached the degraded path, so a file sitting on disk was invisible in the app. That is the `states.md:9-12` "never silent" invariant.

**What the code says now.** `TicketDocument::parse` does refuse it, with a located diagnostic: `"ticket.md must begin with a --- frontmatter delimiter"` at line 1 (`core/ticket.rs:450-452`). So the parse side has an answer. What is missing is any test that a file in that shape becomes a degraded record and reaches a snapshot — `core/storage.rs` covers a foreign directory (`:1518`) and a non-UTF-8 file (`:1571`), and nothing covers this one.

Start with the test. If it passes, the row is being lost somewhere after the parse and the original observation is still live. If it fails, it names the defect directly.

Related but not the same: LC-133 is the degraded card's *placement* (last-known column), which assumes the row arrives at all.

## Source

`docs/cc_screens_diff.md` § 15, "Also observed" — the one finding in that section that was never given a `D-` number, and so was never swept into LC-133…LC-138.

## Checklist

- [ ] Add the Rust-side test in core/storage.rs: a ticket.md with no --- fence becomes a degraded record carrying its raw bytes and a diagnostic, the way the foreign-directory and non-UTF-8 cases already do. <!-- longclaw:item=ck_0c5fba72 -->
- [ ] If that test passes, reproduce the original observation end to end and find where the degraded row is dropped between the snapshot and the Unreadable group. <!-- longclaw:item=ck_5c18ec79 -->

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
