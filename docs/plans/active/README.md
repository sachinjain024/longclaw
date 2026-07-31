---
title: "Active plans"
product: LongClaw
status: active
milestone: "M5 — Feature-complete v0 (Steps 11–15)"
written: 2026-07-31
applies_to: "main @ 6a3925a"
---

# Active plans

One file per piece of pending work. Each is self-contained: it carries its own
working rules, the current behaviour with file and line, what to change, and what
has to pass before it is done. Pick one and execute it without reading the others.

**There are no active plans right now, and Step 11 is open.** Every plan below is
closed, Wave 0 is clear, and M4 closed on 2026-07-31 when the founder decided to
proceed without the pilot sessions
([decision](../../pilot/response-memo.md#direction-decision-2026-07-31-superseded-the-same-day)).
The next work is Step 11, which is [Wave 1 of the backlog](../../backlog/v0-backlog.md)
in full — V0-08 through V0-19. Write a plan here before starting one of them.

Two things to read first, once, before Step 11 code:

- [`AGENTS.md`](../../../AGENTS.md) § Toolchain and the gate — the shims, the traps,
  and why a red native watcher is an environment suspect before a code one.
- [The retired handoff](../completed/pending-work-after-step-10.md) § The one thing
  worth carrying forward — Wave 1's order was never validated, because the pilot that
  would have validated it was skipped. Short, and it names the two items most
  affected.

## Order

The numbers are a recommended sequence, not a hard dependency chain. Anything
marked independent can be done at any time by anyone.

| #   | Plan                                                                           | Backlog | Why here in the order                                                                                                  |
| --- | ------------------------------------------------------------------------------ | ------- | ---------------------------------------------------------------------------------------------------------------------- |
| ~~00~~ | ~~Confirm CI on main~~ — **done 2026-07-31**, [outcome](../completed/00-confirm-ci-on-main.md) | — | Closed. `main` does build: run 30624782219 on `b773a7a` is green through `tauri build`. It also caught a red run on the previous tip, which produced 09. |
| ~~01~~ | ~~Close the atomic-replace race~~ — **done 2026-07-31**, [outcome](../completed/01-atomic-replace-race.md) | V0-01 | Closed. Read its outcome before starting 06: the write path moved, and the test seam it added assumes writes stay on the calling thread. |
| ~~02~~ | ~~Recover from an event-sequence gap~~ — **done 2026-07-31**, [outcome](../completed/02-event-sequence-gap.md) | V0-02 | Closed. It added `ProjectSnapshot.sequence`, which is the snapshot-reconcile boundary item 05 needs. |
| ~~03~~ | ~~Attribute a change from new records only~~ — **done 2026-07-31**, [outcome](../completed/03-attribution-from-new-records.md) | V0-07 | Closed. It restructured the tail of `process_burst`, which 05 and 06 both touch. |
| ~~04~~ | ~~Validate the project prefix on ingest~~ — **done 2026-07-31**, [outcome](../completed/04-project-prefix-validation.md) | V0-03 | Closed. It changed the signatures 05 and 06 will be holding: `read_ticket_file`, `TicketIndex::rebuild`, and both `ingest` methods now take the project key. |
| ~~05~~ | ~~Recover the watcher over sleep, wake, and overflow~~ — **done 2026-07-31**, [outcome](../completed/05-watcher-recovery.md) | V0-04 | Closed. It added native macOS wake recovery, overflow recovery, coalescing, and explicit unavailable reporting. |
| ~~06~~ | ~~Move heavy work off the command thread~~ — **done 2026-07-31**, [outcome](../completed/06-blocking-workers.md) | V0-05 | Closed. Scans, parsing, and fsync run on a bounded two-worker pool; rebuild requests return promptly and coalesce behind one `IndexRebuilt` event. |
| ~~07~~ | ~~Virtualize the board and list~~ — **done 2026-07-31**, [outcome](../completed/07-board-virtualization.md) | V0-06 | Closed for the board. Columns are windowed scroll containers over `boardGeometry.ts`, and the board carries roving arrow/`j`-`k` focus because WebKit never had the cards in the Tab order. Wave 1's list surface (V0-14) inherits that geometry and re-traces with `npm run perf:board`. |
| ~~08~~ | ~~Triage the dependabot advisories~~ — **done 2026-07-31**, [outcome](../completed/08-dependabot-triage.md) | V0-40 | Closed. All three advisories are unreachable, with the argument recorded. It produced V0-40: the alert list itself is the problem, not any advisory in it. |
| ~~09~~ | ~~Stop treating a vanished path as a watcher overflow~~ — **done 2026-07-31**, [outcome](../completed/09-rename-is-not-an-overflow.md) | —       | Closed. `collect_event` now drops only transient `Io(NotFound)` watcher errors and still escalates other errors to overflow recovery. |
| ~~10~~ | ~~Stop npm from breaking the native watcher check~~ — **closed 2026-07-31, not reproducing**, [outcome](../completed/10-npm-native-watcher-timeout.md) | — | Closed without a fix. Eight consecutive npm-launched native watcher runs, `npm run verify` at exit 0, and CI run 30629158530 are all green on the same tree that timed out. The mechanism was never found; the outcome says what to do if it returns. |

Dependencies worth knowing:

- **05 is done, and 06 preserved it.** Wake and overflow recovery still travel through
  `ProjectEngine::rebuild`, and resume/overflow rebuilds remain coalesced after
  rebuild work moved off the command thread.
- **06 touched `process_burst`** in `apps/desktop/src-tauri/src/engine.rs`, and 03
  has already reshaped its tail: the
  previous row is read once, before the ingest, because attribution needs the record
  id the ingest is about to overwrite. Do not reorder that. 04 added one more thing
  to it: the project key is read once at the top of the burst, so every path in the
  burst is judged against the same project.
- **04 is done, and both 05 and 06 inherit its signatures.** Reading a ticket now
  requires saying which project you are reading for:
  `storage::read_ticket_file(path, project_key)`,
  `TicketIndex::rebuild(root, project_key)`, and `ingest`/`ingest_attributing` all
  take it. Item 06 moved these onto workers, carrying the project key with the
  work. Item 05's snapshot reconcile goes through
  `ProjectEngine::rebuild`, which now reads `project.md` *before* the tickets —
  deliberately, because the key decides which directories are this project's at all.
- **06 inherited two things from 01.** The write path an edit takes is now
  `commit` → `storage::atomic_replace`, not `atomic_write`. And `ReplaceSeams`, the
  test seam 01 added, lives in a `thread_local!`; the engine now captures it before
  submitting the worker write, so the race test still drives the swap window.
- **07 is done, and V0-14 inherits it.** The board's column geometry lives in
  `boardGeometry.ts` and is what the list surface should be built on; its sticky
  group headers and archived group are the part 07 did not have to solve. The
  board's keyboard navigation is new and is the model the list should follow.
- **09 and 10 are both closed, and no plan is open.** The vanished-path overflow bug
  is fixed in `collect_event`, and the npm-launched native watcher timeout that
  blocked local `npm run verify` no longer reproduces — closed without a fix, so
  treat a recurrence as an environment question and read
  [10's outcome](../completed/10-npm-native-watcher-timeout.md) before reopening
  anything. Wave 0 is clear and M4 is closed, so no code and no gate stands between
  this repository and Step 11.

## Waves 1–3 are unplanned, and now for a different reason

Waves 1–3 of [the backlog](../../backlog/v0-backlog.md) — 32 of its 39 items — still
have no plans here. The original reason is gone: the guardrail has been satisfied and
the pilot will not invalidate anything, because it was skipped.

What remains is ordinary sequencing. Write a plan when you pick an item up, not 32
plans in advance — the backlog's Wave 1 rows already carry the must-pass check and
the reason each exists, which is most of what a plan needs. Take them roughly in
order; that order is now final rather than provisional, and
[the retired handoff](../completed/pending-work-after-step-10.md) says what that is
worth.

Three items are risk-based rather than breadth, so they are safe to take out of
order at any time: V0-19 (remove assignee from the prototype specs — do this before
Step 11 builds the surfaces around it), V0-30 (index-loss recovery), and V0-40
(scope Dependabot to what ships).

## When a plan is done

1. Its must-pass checks are in the suite and green, and `npm run verify` passes.
2. Add a `## Outcome` section to the plan: what shipped, what you decided, what you
   found that was not in the plan.
3. Move the file to `docs/plans/completed/`.
4. Update the row in [the backlog](../../backlog/v0-backlog.md) and, if it retired
   one, [the release risks](../../release-risks.md).
