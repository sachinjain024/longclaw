---
format: longclaw.ticket/v1
id: a5aa7858-ef5b-473e-90eb-d1e54d8e3a8a
key: LC-23
title: Arrow and j/k navigation, predictable focus return, and the escape contract
status: done
priority: p2
labels:
  - frontend
  - v0-backlog
created_at: 2026-08-05T14:23:03Z
updated_at: 2026-08-11T14:03:10.983Z
---

Arrow and `j`/`k` navigation, predictable focus return, and the escape contract

## Why it exists

Focus lost behind a panel or modal is the failure mode that makes keyboard support unusable in practice.

## Source

`docs/backlog/v0-backlog.md` — **V0-23**, Wave 2, step 12, owner Frontend.

## Checklist

- [x] Automated focus tests for the critical flows: focus is never lost behind the panel, a modal, a menu, or the palette, and returns where the map says <!-- longclaw:item=ck_740e7c40 -->

## Activity

<!-- longclaw:event
id: evt_d3128257
kind: create
occurred_at: 2026-08-05T14:23:03Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_cfa24cf3
kind: update
occurred_at: 2026-08-05T15:14:39.619Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: backlog
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_1cf5e7bd
kind: update
occurred_at: 2026-08-11T14:03:10.983Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: backlog
    to: done
  - field: checklist.ck_740e7c40.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Already shipped on 2026-08-01, before this ticket was filed. V0-23 is [plan 28](../../../docs/plans/completed/28-focus-and-the-escape-contract.md), closed as "Escape handling, focus traps/returns, fallback focus, and regression coverage are complete", under the Step 12 completion at `docs/plans/active/README.md:36`.

Verified in the tree:

- `Board.tsx:155-164` binds both vocabularies the title asks for — `ArrowUp/Down/Left/Right` and `j`/`k`/`h`/`l` — matched in lower case because caps lock or a held shift is still the same key to the person pressing it. `IssueList.tsx:94-99` binds arrows and `j`/`k`, the list being one dimension. Both come from `keyboard-focus-map.md:39-40`.
- The Esc ladder and focus return are the map's § Focus return table (`:159-166`), and `rovingFocus.ts` is the shared mechanism.

The checklist asks for automated focus tests for the critical flows, and those exist as a run rather than a memory: `npm run a11y:audit` drives the real `App` in WebKit with no pointer input anywhere in it, checking each step against the line of `keyboard-focus-map.md` it implements, and carries a `--self-test` inversion that fails if a row still passes when the build is broken on purpose. That is a stronger instrument than the jsdom focus tests this item originally imagined.

Filed by the 2026-08-05 import off the unstruck `v0-backlog.md:138` row.
<!-- /longclaw:event -->
