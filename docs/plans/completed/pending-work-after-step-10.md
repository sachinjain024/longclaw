---
title: "Pending work after Step 10"
product: LongClaw
status: closed
milestone: "M4 — Pilot direction accepted (closed 2026-07-31)"
written: 2026-07-30
closed: 2026-07-31
applies_to: "main @ 6a3925a"
---

# Pending work after Step 10

**Closed 2026-07-31.** This file existed to hold the work between Step 10 and the
M4 gate, and to keep two things apart: the open risk that could be fixed
immediately, and the work that was waiting on pilot evidence. Both halves are
resolved, so by its own retirement rule it moves here.

- **The risk half was done.** Wave 0's seven items (V0-01…V0-07) and all ten plans
  in this directory are closed, with `npm run verify` and CI green on `6230240`.
- **The evidence half was waived.** On 2026-07-31 the founder decided to proceed
  without the pilot sessions, which closed M4 and unblocked Step 11.

## Where its contents went

| What this file carried             | Where it lives now                                                                  |
| ---------------------------------- | ----------------------------------------------------------------------------------- |
| Toolchain traps, the gate commands, and the native-watcher caveat | [`AGENTS.md`](../../../AGENTS.md) § Toolchain and the gate — promoted so every session reads it |
| The plan index and the dependencies between closed items | [`docs/plans/active/README.md`](../active/README.md)                     |
| What to build next                 | [The backlog](../../backlog/v0-backlog.md) § Wave 1, which is Step 11 in full         |
| The M4 decision and what it cost   | [The pilot response memo](../../pilot/response-memo.md)                              |

## The one thing worth carrying forward

This file's original warning was *do not start Wave 1 breadth before M4 is decided*.
M4 is decided, so that warning is spent. Its replacement is narrower and does not
block anything:

**Step 11 is being built against an order nobody validated.** The pilot was the
mechanism for finding out whether the Waves 1–3 ranking matched what users need, and
it was skipped. The ranking did not improve when the pilot was cancelled; it just
stopped being provisional. Two specific consequences to know while working:

- The backlog's `Pilot` column is inert. Its `confirm` rows — notably V0-12's
  markdown editor and V0-13's attribution treatment — ship on their current design
  without an outside look, which is exactly what that marking was flagging.
- One acceptance criterion, the human-accent freshness treatment in
  `src/freshness.ts`, was resolved by keeping it *by default* rather than by
  evidence. The memo records that as a judgement call, not a finding.

Neither is a reason to stop. Both are reasons to treat a surprise during Step 11 as
information the pilot would have given earlier and cheaper.

## Rules that outlived this file

These were listed here and are not restated anywhere as forcefully, so they are kept:

- **Never mint a ticket key.** LongClaw owns key allocation; an agent must not create
  `.longclaw/tickets/<KEY>/` or guess a key (`docs/agents/issue-tracker.md`). This
  repository still has no `.longclaw/` store, which is why plans live in
  `docs/plans/` — see the standing risk about that in
  [the release risks](../../release-risks.md).
- **Do not rewrite or delete a file the app cannot parse.** The format contract's
  hardest rule.
- **Do not write pilot findings that did not happen.** The memo's tables are
  permanently empty and no decision permits back-filling them.
- **Domain language matters.** Ticket, actor, activity event, external change,
  acknowledgement — `CONTEXT.md` defines them and the words appear in code and tests.
  An "issue" or a "task" in new code is a review finding.
