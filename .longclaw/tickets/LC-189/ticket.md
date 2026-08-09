---
format: longclaw.ticket/v1
id: e3c186c5-d372-4caf-9cdd-59a2d2cbbcbc
key: LC-189
title: "Board: a drop into the far-right column is refused, and probe:drag cannot see it"
status: todo
priority: none
labels:
  - frontend
created_at: 2026-08-09T15:07:34.010Z
updated_at: 2026-08-09T15:07:34.010Z
---

Found while landing LC-166, and it reproduces on `main` untouched by it.

**What happens.** With the board's drag probe aimed at the rightmost column, the page lights the column up as a drop target and accepts every `dragover` — and then no `drop` event fires at all, so the card stays where it was.

```
board-across-manual — board: drag between columns (Manual)
  FAIL  the page accepted the drop
        dragstart=true dragover=6 accepted=6 drop=false
  ok    the group under the pointer lights up
        lit=1
  FAIL  PF-6 is in Canceled now
        PF-6 Backlog[0] → Backlog[0]
```

**Reproduce on main**, at the pre-LC-166 card height:

```sh
git checkout main
npm --prefix apps/desktop run probe:drag -- --tickets=46   # 35/38, exits 1
```

46 is what makes the probe's target fall through to `Canceled`; at the default 40 it lands on `Todo` and the run is green. So the default has been stepping over this, not proving it absent.

**Two candidates, and this ticket is to decide which.** Either the pointer never reaches `Canceled` — the board grid scrolls sideways and the mouse-up may be landing outside the reachable area, which would make it a limit of the probe's mouse driving — or the app genuinely refuses a drop into the far column, which would be a real defect on a surface a person uses with six columns and a narrow window. `lit=1` says the column *did* register as a target, which is what makes the second reading worth ruling out rather than assuming.

**Not blocking LC-166.** LC-166 changed which ticket count trips this and nothing else; its probe run is 38/38 at the default and at `--tickets=46`. What LC-166 did change is the probe's group-eligibility rule, which required *every* rendered row to be visible and so tied the choice of target column to how tall a card is (`perf/drag-probe.mjs`); it now requires only the rows a run actually points at. That is what makes `--tickets=46` reach `Todo` and pass, and it is also what stops this ticket's case from being reachable by ticket count alone — decide it with a case that aims at the far column on purpose.

## Checklist

- [ ] Decide which it is: drive a mouse-up over the far column with the board scrolled to it, and say whether the drop event fires <!-- longclaw:item=ck_a6b24184 -->
- [ ] If it is the app: fix the drop, and add a drag-probe case that aims at the far column rather than reaching it by accident <!-- longclaw:item=ck_255ad6bd -->
- [ ] If it is the probe: give it a way to reach a column that needs the grid scrolled, so the far column is testable at all <!-- longclaw:item=ck_fe38e382 -->

## Activity

<!-- longclaw:event
id: evt_71c37a82
kind: create
occurred_at: 2026-08-09T15:07:34.010Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
