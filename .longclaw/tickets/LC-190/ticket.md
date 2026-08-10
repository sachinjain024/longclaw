---
format: longclaw.ticket/v1
id: c6a4c812-5eab-4015-a856-9b3cc5b974bf
key: LC-190
title: "Board: a drop into the far-right column is refused, and probe:drag cannot see it"
status: in_review
priority: none
labels:
  - frontend
created_at: 2026-08-10T04:58:07.335Z
updated_at: 2026-08-10T15:50:22.167Z
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

- [x] Decide which it is: drive a mouse-up over the far column with the board scrolled to it, and say whether the drop event fires <!-- longclaw:item=ck_e572659b -->
- [ ] If it is the app: fix the drop, and add a drag-probe case that aims at the far column rather than reaching it by accident <!-- longclaw:item=ck_9b077547 -->
- [x] If it is the probe: give it a way to reach a column that needs the grid scrolled, so the far column is testable at all <!-- longclaw:item=ck_845db456 -->

## Activity

<!-- longclaw:event
id: evt_8a5ce09d
kind: create
occurred_at: 2026-08-10T04:58:07.335Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_944acbc9
kind: comment
occurred_at: 2026-08-10T04:59:05.535Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Re-keyed from LC-189. Three branches each allocated LC-189 off a main whose highest key was LC-188: this report (filed while landing LC-166), the global focus treatment split out of LC-158, and the design-doc citation drift on `fix/lc-189-design-doc-citations`. The citation one was already pushed, is `in_review`, and carries the key in its branch name and commit message, so by the rule the LC-184 collision set (`9b64629`) the unpushed ones yield. This is the same report verbatim under a new key and a new id; the LC-189 that `LC-166` names in its closing note is this ticket.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_13a1b718
kind: update
occurred_at: 2026-08-10T15:37:34.634Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: in_progress
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_bd99f5c5
kind: update
occurred_at: 2026-08-10T15:49:59.500Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_e572659b.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_3de4a695
kind: update
occurred_at: 2026-08-10T15:49:59.523Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_845db456.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_1c9f84ca
kind: update
occurred_at: 2026-08-10T15:50:22.167Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: in_progress
    to: in_review
-->
### Claude Code updated this ticket

**It is the probe.** The app takes a drop into the far-right column; the pointer was never over it.

Two runs of the same drag at `--tickets=46`, differing only in whether `.board-grid` had been scrolled:

```
A. unscrolled, aimed where the probe aims
   columns: Backlog[264..528] Todo[540..804] In Progress[816..1080]
            In Review[1092..1356] Done[1368..1632] Canceled[1644..1908]
   target PF-5 at x=1648, viewport 1440, grid box [264..1416]
   dragstart=true dragover=11 accepted=11 drop=false lit=1
   PF-6: Backlog[0] -> Backlog[0]

B. grid scrolled to the end, aimed at the same column
   columns: ... Done[876..1140] Canceled[1152..1416]
   target PF-5 at x=1156
   dragstart=true dragover=16 accepted=16 drop=true lit=1
   PF-2: In Progress[0] -> Canceled[0]
```

Six columns of 264px and their gaps is ~1644px of board against a 1440px window, so the sixth column starts 200px past the right edge. The probe aimed a mouse-up at x=1648 and WebKit never delivered a `drop`. `lit=1` was the *previous* column still lit from the pointer's way across, which is what made this read as a refusal.

The cause is in `read()`: `visible` asked only whether a row was inside its own scroller vertically. A `getBoundingClientRect` is the unclipped position, so an off-screen column reported full-height rows and passed the eligibility test. LC-166 changed which ticket count landed there, not whether it could happen.

## What changed

- `visible` now means inside the scroller **and** inside the pane the group scrolls sideways in — a new `pane` selector per surface (`.board-grid` for the board; `.issue-list` for the list, where one element bounds both axes).
- A sixth case, `board-across-far`, scrolls the grid to its end and drops into the last column on purpose. It asserts it scrolled at all and that its target really is the board's last column, so it cannot quietly decay into a second `board-across-manual`.

## Runs

- `npm run probe:drag` — 49/49 (was 43/43)
- `npm run probe:drag -- --tickets=46` — 49/49, the count the report was filed at
- `npm run probe:drag -- --self-test` — 20/49, inversion holds; the new case's rows go red with the rest
- `npm run verify` — exit 0

`ck_9b077547` stays open on purpose: it is the branch for "if it is the app", and the app was exonerated.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_147420b8
kind: comment
occurred_at: 2026-08-10T16:10:54.319Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Review findings, and a correction to the run figures above.

**The baseline was misreported.** The comment above says `probe:drag` went 49/49 "(was 43/43)". `main`'s probe is **42/42**, not 43/43. The nine cases there are 5 checks each for the four that must land and the three list/board `across` runs, 4 each for the two Priority controls that must be refused, and 4 for the panel checklist; `board-across-far` adds 7, which is the 49. Nothing about the conclusion changes — only the number it was measured against.

**Fixed from the two-axis review:**

- The probe's case list is documented in four places and only `AGENTS.md` had been updated. `CONTRIBUTING.md`, `apps/desktop/perf/README.md` and the module docblock in `drag-probe.mjs` now name the sixth case too — the same set `b05964d` and `0e95c47` updated when the fifth landed.
- The anti-decay guard measured its target against `before.at(-1)`, the last group *drawn*, which includes the `Unreadable` and `Archived` groups that `usable` deliberately excludes. On a board carrying an unreadable file it would have failed a run with nothing wrong with it. It now measures against the last group that takes a drop at all, and that exclusion is one `takesDrop` predicate both places share instead of an inline list.
- `scrollPaneToEnd` said it returned "the distance scrolled" and returned the resting `scrollLeft`. Renamed and the docblock corrected; the settle comment no longer claims a frame it does not wait for.
- The `far` branch in target selection was a nested ternary; it is a named `targetGroup` now.

**Kept, with the reason:** the `pane` bound applies to the list surface as well as the board, which the probe branch of this ticket did not ask for. `read()` is one function serving both surfaces, and the blindness it fixes is not board-specific — a list whose groups scrolled sideways would report the same false refusal. The list's pane is its scroller, so the bound is a no-op there today and its cases stay green.

Runs after the fixes: `probe:drag` 49/49, `--tickets=46` 49/49, `--self-test` 20/49 with the inversion holding, `npm run verify` exit 0.
<!-- /longclaw:event -->
