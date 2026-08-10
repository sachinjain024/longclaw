---
format: longclaw.ticket/v1
id: 60d86227-40f3-4be4-b2c1-e1e2f203d987
key: LC-197
title: Guard the components.md contract in both directions
status: todo
priority: p2
labels:
  - design
created_at: 2026-08-10T07:27:18.466Z
updated_at: 2026-08-10T07:27:18.466Z
---

`components.md` is the contract between the design system and the app. Neither
side's components are the source: the `.jsx` in Claude Design and the TSX in
`apps/desktop/src` are both renderings of what that file specifies. There is no
mechanical path between the two runtimes and there should not be one — a
generated component diff across them would be a guarantee that lies.

What the contract needs instead is a guard, because nothing enforces it today.
That is precisely how LC-192's H group happened: the founder retired the status
glyphs (D3), the priority set (D4) and the assignee (ADR 0001); the repo
implemented all three; `components.md` was updated; and the design system went
on shipping the old ones for three months because no check connected them.

The guard is a repo-side check with two directions:

- a component named in `components.md` with no implementation in
  `apps/desktop/src` — a spec nobody built
- a component in `apps/desktop/src` that `components.md` does not describe — an
  implementation nobody specified

Follow the house style of the existing guards (`token-source-guard.mjs`,
`glyph-drift-guard.mjs`): a long header explaining the failure it exists to
catch, a non-zero exit with the findings named, and a self-test proving it goes
red. Wire it into `npm run check`.

Cheap, and it is the piece that makes the process in LC-192's sync practice
real rather than aspirational.

## Checklist

- [ ] Fail when components.md names a component with no implementation in apps/desktop/src <!-- longclaw:item=ck_d39d8a71 -->
- [ ] Fail when apps/desktop/src has a component components.md does not describe <!-- longclaw:item=ck_2646bc4d -->
- [ ] Self-test proving the guard goes red in both directions <!-- longclaw:item=ck_cf3dcdbe -->
- [ ] Wire into npm run check <!-- longclaw:item=ck_0292891d -->

## Activity

<!-- longclaw:event
id: evt_52e3f21a
kind: create
occurred_at: 2026-08-10T07:27:18.466Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
