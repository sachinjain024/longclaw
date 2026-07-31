---
title: "Active plans"
product: LongClaw
status: active
milestone: "M4 — Pilot direction accepted"
written: 2026-07-31
applies_to: "main @ aae472d"
---

# Active plans

One file per piece of pending work. Each is self-contained: it carries its own
working rules, the current behaviour with file and line, what to change, and what
has to pass before it is done. Pick one and execute it without reading the others.

[The pending-work handoff](pending-work-after-step-10.md) is the orientation
document — where the project stands and why these items exist. Start there if you
have no context at all; start here if you just want work.

## Order

The numbers are a recommended sequence, not a hard dependency chain. Anything
marked independent can be done at any time by anyone.

| #   | Plan                                                                           | Backlog | Why here in the order                                                                                                  |
| --- | ------------------------------------------------------------------------------ | ------- | ---------------------------------------------------------------------------------------------------------------------- |
| 00  | [Confirm CI on main](00-confirm-ci-on-main.md)                                 | —       | Five minutes, and it tells you whether the tree you are about to build on is green. Do it first.                       |
| ~~01~~ | ~~Close the atomic-replace race~~ — **done 2026-07-31**, [outcome](../completed/01-atomic-replace-race.md) | V0-01 | Closed. Read its outcome before starting 06: the write path moved, and the test seam it added assumes writes stay on the calling thread. |
| ~~02~~ | ~~Recover from an event-sequence gap~~ — **done 2026-07-31**, [outcome](../completed/02-event-sequence-gap.md) | V0-02 | Closed. It added `ProjectSnapshot.sequence`, which is the snapshot-reconcile boundary item 05 needs. |
| ~~03~~ | ~~Attribute a change from new records only~~ — **done 2026-07-31**, [outcome](../completed/03-attribution-from-new-records.md) | V0-07 | Closed. It restructured the tail of `process_burst`, which 05 and 06 both touch. |
| ~~04~~ | ~~Validate the project prefix on ingest~~ — **done 2026-07-31**, [outcome](../completed/04-project-prefix-validation.md) | V0-03 | Closed. It changed the signatures 05 and 06 will be holding: `read_ticket_file`, `TicketIndex::rebuild`, and both `ingest` methods now take the project key. |
| ~~05~~ | ~~Recover the watcher over sleep, wake, and overflow~~ — **done 2026-07-31**, [outcome](../completed/05-watcher-recovery.md) | V0-04 | Closed. It added native macOS wake recovery, overflow recovery, coalescing, and explicit unavailable reporting. |
| 06  | [Move heavy work off the command thread](06-blocking-workers.md)               | V0-05   | Restructures engine orchestration, so it goes after the correctness fixes rather than moving code out from under them. |
| 07  | [Virtualize the board and list](07-board-virtualization.md)                    | V0-06   | Independent. Must land before Wave 1's list surface, which is what renders 5,000 rows.                                 |
| 08  | [Triage the dependabot advisories](08-dependabot-triage.md)                    | —       | Independent. Do it whenever; it may turn out to be nothing.                                                            |

Dependencies worth knowing:

- **05 is done, and 06 inherits it.** Wake and overflow recovery now travel through
  `ProjectEngine::rebuild`, and resume/overflow rebuilds are coalesced. Item 06
  must preserve that coalescing when rebuild work moves off the command thread.
- **06 touches `process_burst`** in `apps/desktop/src-tauri/src/engine.rs`, and 03
  has already reshaped its tail: the
  previous row is read once, before the ingest, because attribution needs the record
  id the ingest is about to overwrite. Do not reorder that. 04 added one more thing
  to it: the project key is read once at the top of the burst, so every path in the
  burst is judged against the same project.
- **04 is done, and both 05 and 06 inherit its signatures.** Reading a ticket now
  requires saying which project you are reading for:
  `storage::read_ticket_file(path, project_key)`,
  `TicketIndex::rebuild(root, project_key)`, and `ingest`/`ingest_attributing` all
  take it. Item 06 moves these onto workers, so whatever carries work to a worker
  has to carry the key with it. Item 05's snapshot reconcile goes through
  `ProjectEngine::rebuild`, which now reads `project.md` *before* the tickets —
  deliberately, because the key decides which directories are this project's at all.
- **06 inherits two things from 01.** The write path an edit takes is now
  `commit` → `storage::atomic_replace`, not `atomic_write`. And `ReplaceSeams`, the
  test seam 01 added, lives in a `thread_local!` that is only correct while a write
  runs on the thread that asked for it — moving writes to a worker means the seam
  installer moves with them, or the race test silently stops driving anything.
- **07 is genuinely independent** of everything else. It is the one to hand to a
  second person working at the same time.

## What is deliberately not planned yet

Waves 1–3 of [the backlog](../../backlog/v0-backlog.md) — 32 of its 39 items — have
no plans here, on purpose:

- The plan's guardrail forbids starting Wave 1 breadth before M4 is decided.
- The order _within_ those waves is a pre-pilot baseline, not observed value. Pilot
  evidence is expected to reshuffle it.

Writing 32 detailed plans now would be work the pilot may invalidate, and it would
make a stale ordering look authoritative. Plan them when M4 closes, or when the
founder decides to proceed without the pilot. Two Wave 3 items — V0-19 (remove
assignee from the prototype specs) and V0-30 (index-loss recovery) — are small and
pilot-independent if you need extra work before then.

## When a plan is done

1. Its must-pass checks are in the suite and green, and `npm run verify` passes.
2. Add a `## Outcome` section to the plan: what shipped, what you decided, what you
   found that was not in the plan.
3. Move the file to `docs/plans/completed/`.
4. Update the row in [the backlog](../../backlog/v0-backlog.md) and, if it retired
   one, [the release risks](../../release-risks.md).
