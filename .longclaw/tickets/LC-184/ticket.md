---
format: longclaw.ticket/v1
id: 72706f3d-581b-4895-a39c-689d24603453
key: LC-184
title: Watcher — a per-file read failure in a burst is dropped in silence, and the stale row keeps rendering as live
status: todo
priority: p2
labels:
  - storage
created_at: 2026-08-09T00:59:01.964Z
updated_at: 2026-08-09T00:59:01.964Z
---

Found by the review on LC-168, adjacent to it rather than part of it — LC-168's shape (no frontmatter) returns `Ok` with a degraded record and is unaffected.

`ProjectEngine::process_burst` (`src/engine.rs`) drops a file it cannot read twice over, and says nothing either time:

- `let Some(bytes) = read_when_settled(&path) else { continue; };` — `read_when_settled` ends in `fs::read(path).ok()`, so an unreadable file becomes `None`.
- `if let Ok((ticket, attribution)) = self.index.ingest_attributing(...)` — no `else`. `read_ticket_file` returns `Err` for an `fs::read` failure or a non-UTF-8 directory name; a parse failure is not one of these, it is the degraded path.

Either way the index keeps the row it already held and no event is emitted, so the board goes on drawing the last-known card as though it were current. That is `states.md:15-16` ("**Never silent.** An external change earns the pulse, the footer, a timeline event, or a banner") and `states.md:84-85` ("**Never:** … show cached tickets as if they were live").

## Why it is not LC-139

LC-139 / D-55 closed the same invariant one level up: `process_burst` now opens with `if !self.root.is_dir() { self.report_unavailable(); return; }`. That is the whole project folder going away. A single file the OS refuses — a bad mode, an I/O error, a directory name that is not UTF-8 — leaves the root perfectly reachable and falls straight through to the two `continue`s above.

## What is genuinely fine

The transient race is already answered and should stay silent: a file that vanished mid-burst is covered by its own deletion event, and `read_when_settled` returns `None` deliberately for it. `TicketIndex::rebuild` carries the same shape with that justification written on it. The gap is the **non-transient** failure, which nothing retries and nothing reports — it survives until something else forces a rebuild.

## Severity

P2, not higher: it needs a file the OS refuses while the folder stays reachable, which is rarer than the cases already covered. It is filed because the failure mode is the silent one — the app looks correct while showing something it can no longer read.

## Checklist

- [ ] Decide the answer for a non-transient per-file read failure: degrade the row with the io diagnostic (read_ticket_file already builds one for the parse case), or raise a state. A vanish race must stay silent — the deletion event covers it. <!-- longclaw:item=ck_8106f07a -->
- [ ] Give process_burst's two silent continues an else arm, and a test: chmod 000 a ticket.md under a running engine, expect the row to stop claiming it is live. <!-- longclaw:item=ck_d5f9c026 -->

## Activity

<!-- longclaw:event
id: evt_0b62ea32
kind: create
occurred_at: 2026-08-09T00:59:01.964Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
