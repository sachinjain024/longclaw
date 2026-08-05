---
format: longclaw.ticket/v1
id: b31fa2cb-ebb0-4f4e-a5fe-e8a0a20fc0a4
key: LC-14
title: The dense issue list surface, grouped by status
status: done
priority: p1
labels:
  - frontend
  - v0-backlog
created_at: 2026-08-05T14:22:57Z
updated_at: 2026-08-05T14:22:58Z
---

~~The dense issue list surface, grouped by status~~ **Done 2026-07-31** — `src/IssueList.tsx`: one scroller, a sticky 32px header per status over a `surface` card of 36px rows, only the statuses that hold tickets, and the archived group (ADR 0004) last and collapsed behind a focusable header button. Both surfaces are projections of the same store array and neither holds a row of its own. The bucketing came out of `Board.tsx` into `src/grouping.ts` so the two cannot disagree about what is in Todo, and the list windows through the board's own arithmetic — `src/listGeometry.ts` composes slots and strides and hands them to `runningOffsets`/`windowFor` in `boardGeometry.ts`, which is the whole of the shared maths. The status dot the app never had is `src/StatusDot.tsx`, built from the existing `--lc-status-*` tokens with nothing added, and passed into the status menu's rows, which closes the gap V0-08's row named. [Plan 16](../../../docs/plans/completed/16-dense-issue-list.md)

## Must-pass

Passed both clauses, eleven behavioural claims each confirmed failing first by reverting the behaviour. **Agreement:** `App.test.tsx` § "the list and the board agree" compares what each surface has on screen after an app edit through `mutate()`, an external `ticketChanged`, an `indexRebuilt`, and a remount over a fresh snapshot — and asserts the list shows an archived ticket the board does not. **Budget:** `npm run perf:list` traces 5,000 tickets in WebKit at 15 ms p95 keyboard, 18 ms p95 scroll, 16 ms p95 external write against a ≤ 50 ms p95 budget, with 21 rows in the document and every median within a millisecond of the 600-ticket floor; `npm run perf:board` re-traced at 15/18/16 ms p95. **Amended 2026-08-01: the budget now gates something.** It was a number in this cell and a command somebody remembered to run — nothing failed if the list got slower. `perf:board` and `perf:list` were briefly a second CI job, added and then removed on 2026-08-01 because a shared runner misses the budget at any project size — see V0-06's row and V0-42. Enforced locally only. (Removed job: `.github/workflows/ci.yml` § `perf`) on every pull request and every push to `main`; each asserts its own budget and exits non-zero over it. They are deliberately **not** in `npm run verify`: two WebKit traces over 5,000 tickets are minutes, which is the wrong price for a pre-commit gate and the right one for a pull request, so the local gate is unchanged. The job installs WebKit itself (`npx playwright-core install webkit`) after `npm ci`, which is what the harness needs and a bare checkout does not have. **Three things worth a look:** the sticky header's fill is `--lc-surface` rather than the spec's `--lc-bg`, because the list sits inside the workspace card and a `bg` fill reads as a grey band; `P` opens no priority menu on a list row, because `keyboard-focus-map.md` specifies it for the board only; and the board's column headers gained the status dot `screen-specs.md:103` always asked for

## Source

`docs/backlog/v0-backlog.md` — **V0-14**, Wave 1, step 11, owner Frontend.

## Checklist

- [x] Passed both clauses, eleven behavioural claims each confirmed failing first by reverting the behaviour. Agreement: App.test.tsx § "the list and the board agree" compares what each surface has on screen after an app edit through mutate(), an external ticketChanged, an indexRebuilt, and a remount… <!-- longclaw:item=ck_663a281e -->

## Activity

<!-- longclaw:event
id: evt_e6805bee
kind: create
occurred_at: 2026-08-05T14:22:57Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_6fc486ff
kind: update
occurred_at: 2026-08-05T14:22:58Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_663a281e.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Imported from `docs/backlog/v0-backlog.md`. The must-pass verification for V0-14 is recorded there as passed.
<!-- /longclaw:event -->
