---
title: "Reconcile Step 12 command-set documentation"
product: LongClaw
status: completed
type: documentation-debt
owner_area: Design
written: 2026-08-01
applies_to: "Step 12 command palette documentation"
---

# Reconcile Step 12 command-set documentation

## Why this exists

`docs/mvp_plan_order.md` § Step 12 predates ADR 0001 and Proposal P1. It still
lists an `assign` palette command and says the Phase 2 terminal command should be
reserved without being exposed. Both statements conflict with the ADR, the
prototype specifications, the backlog must-pass, and the now-accepted P1 scope.

This is documentation debt only. It does not add product scope: P1 was accepted
on 2026-08-01, and the terminal remains a visible, disabled, `PHASE 2` row with no
terminal implementation.

## Current source of truth

- ADR 0001 removes assignment from local mode.
- `docs/design/prototype/screen-specs.md` defines the twelve-command root set.
- `docs/design/foundations/components.md` now lists the same twelve commands.
- `docs/design/prototype/README.md` records P1 as accepted.
- `docs/backlog/v0-backlog.md` requires the terminal row to be visible, disabled,
  and tagged `PHASE 2`.

## What to change

1. Update `docs/mvp_plan_order.md` § Step 12 to remove `assign`.
2. Add P1's four accepted commands: priority, archive/unarchive, board ordering,
   and board/list view.
3. Replace the terminal instruction with: expose a visible, disabled `new
   terminal` row tagged `PHASE 2`; do not implement terminal behavior in v0.
4. **`docs/design/foundations/decisions.md` § D14 (`:202-213`) — the one stale
   reference already located.** Its body still lists the original eight commands,
   and its ADR 0001 blockquote still says set-priority, view-toggle, archive and
   board-ordering are staged "for sign-off". They were signed off on 2026-08-01.
   **Follow that file's own convention rather than rewriting it**: D14 is a
   decision log, and the pattern established when ADR 0001 was propagated is a
   dated blockquote beneath the entry, with `~~strikethrough~~` on superseded text
   in place and `<details><summary>Superseded original</summary>` where a whole
   entry was replaced (D3, D4). Do not renumber, and do not delete the history —
   D14 as accepted at Step 1 is a true record of what was decided then. The same
   file's D8 blockquote (`:139-140`) is about `A`/assign and is already correct;
   leave it. Note also `decisions.md:6` says every decision below is "staged for
   founder sign-off at the M0 gate" — P1 is accepted but the M0 gate is still open
   (`prototype/README.md:127`), so that sentence stands.
5. Search the rest of the documentation for stale eight-command, assign-command, or
   hidden-terminal wording and reconcile only references that describe the current
   v0 command set. Suggested starting point: `rg -n 'assign' docs/` and
   `rg -n 'new terminal|Phase 2 slot' docs/`, reading every hit rather than
   pattern-replacing — most `assign` hits in `docs/design/` are deliberate ADR 0001
   call-outs that V0-19 put there on purpose, and removing one would undo that
   item's work. `docs/plans/completed/11-remove-assignee-from-specs.md` lists which
   are which.
6. Preserve the Phase 2 scope guardrail: no PTY, embedded terminal, or terminal
   session behavior is part of this change.

**One thing this plan must not do.** `mvp_plan_order.md` is the execution plan, not
a design document, and several of its steps have been amended in place before
(Step 9 records that it was skipped; Step 10 records what it never absorbed). Amend
Step 12 the same way — state what changed and when — rather than quietly rewriting
it so it looks as though it was always right. The value of that file is partly that
it records what the project believed at the time.

## Must-pass

- Step 12, the command palette plans, the design specifications, and the backlog
  describe the same twelve root commands.
- No local-mode palette or shortcut specification includes `assign`.
- Every relevant specification says the terminal row is visible, disabled, and
  tagged `PHASE 2`.
- The plan's terminal scope remains documentation-only and does not imply a v0
  terminal implementation.
- `rg` checks for the stale phrases are recorded in the outcome.

## Completion

After the edits and targeted search pass, add an Outcome section, move this file
to `docs/plans/completed/`, and remove its active-plan row.
## Outcome

Updated `mvp_plan_order.md` with the accepted twelve-command set, removed `assign`, and made the terminal row visibly disabled and `PHASE 2`-tagged. The active-plan index and this plan now record completion.
