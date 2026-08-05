---
format: longclaw.ticket/v1
id: 39aa570e-8756-4cb6-9e7d-70866cd30e79
key: LC-19
title: Remove assignee from the prototype specs and the data requirements
status: done
priority: p1
labels:
  - design
  - v0-backlog
created_at: 2026-08-05T14:23:02Z
updated_at: 2026-08-05T14:23:03Z
---

~~Remove assignee from the prototype specs and the data requirements~~ **Text done 2026-07-31, screens not** — the Step-1 foundations were the gap ADR 0001's propagation pass never opened: `components.md` § Board card, § Avatars, § Command palette and § Shortcuts now state the v0 anatomy correctly, D7/D8/D14 in `decisions.md` are struck against their ADR blockquotes, and `proof/board.html` and `proof/components-library.html` were revised to drop the card-footer avatars, the disabled assignee field and the panel's assignee control. The ten committed PNGs in `proof/renders/` were **not** regenerated. [Plan 11](../../../docs/plans/completed/11-remove-assignee-from-specs.md)

## Must-pass

**Two of the three clauses passed. The screen clause did not, and this row said otherwise until 2026-08-01.** The must-pass reads *no spec, **screen**, or data requirement in `docs/design/` shows an assignee in local mode*; the row as first closed reported "passed for every spec and data requirement", which is the same sentence with the failing clause removed. An item narrowing its own gate to fit what it reached is worse than the gap it hides, so the gate is restored here. **Specs and data requirements: passed.** `rg -n -i 'assign|avatar|owner|people' docs/design/` leaves only ADR call-outs, agent tiles, actor avatars, and the on-disk schema. **Screens: not passed.** `proof/renders/` still shows assignee avatars on every board card, the assignee field in § 05 and the assignee control in the ticket panel, across all ten PNGs — the revised HTML could not be re-rendered because the pipeline that produced them was never committed (`foundations/README.md:53-63`, which states this). A reader taking the renders for the current anatomy takes an assignee with them, which is exactly the failure ADR 0001's consequences section names. Regenerating them is **V0-41**; until that lands this row is a pass on the words and not on the pictures. **Screen clause closed 2026-08-01:** V0-41 committed the pipeline and regenerated all ten renders from the corrected HTML — no assignee avatar, field or control remains anywhere in `docs/design/`, so this row now passes whole

## Source

`docs/backlog/v0-backlog.md` — **V0-19**, Wave 1, step 11, owner Design.

## Checklist

- [x] Two of the three clauses passed. The screen clause did not, and this row said otherwise until 2026-08-01. The must-pass reads no spec, screen, or data requirement in docs/design/ shows an assignee in local mode; the row as first closed reported "passed for every spec and data requirement", which… <!-- longclaw:item=ck_e92c0313 -->

## Activity

<!-- longclaw:event
id: evt_852ab889
kind: create
occurred_at: 2026-08-05T14:23:02Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_6bd4843c
kind: update
occurred_at: 2026-08-05T14:23:03Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_e92c0313.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Imported from `docs/backlog/v0-backlog.md`. The must-pass verification for V0-19 is recorded there as passed.
<!-- /longclaw:event -->
