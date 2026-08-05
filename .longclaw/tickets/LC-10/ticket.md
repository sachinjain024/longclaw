---
format: longclaw.ticket/v1
id: abbdfb32-acbc-471c-b4d1-df4b0f142e35
key: LC-10
title: "Project-scoped labels: definitions in longclaw.yaml, chips on cards and rows, label menu"
status: done
priority: p1
labels:
  - domain
  - v0-backlog
created_at: 2026-08-05T14:22:53Z
updated_at: 2026-08-05T14:22:54Z
---

~~Project-scoped labels: definitions in `longclaw.yaml`, chips on cards and rows, label menu~~ **Done 2026-07-31** — one slug → chip resolution (`src/labels.ts`) behind the chip (`src/LabelChip.tsx`), so the board card, the panel, the menu, and V0-14's list rows cannot disagree about what a slug looks like. The panel's meta grid gained a Labels row on the shared popover in `multiple` mode, writing the whole list through `save()`; definitions are added, renamed, recoloured and removed from project settings, where `screen-specs.md` is silent. Chips cap at two on a card and one beside a checklist fraction, and the D12 ramp is the only palette on offer. [Plan 15](../../../docs/plans/completed/15-project-scoped-labels.md)

## Must-pass

Passed all three clauses, each confirmed failing first: slugs round-trip through `edit_ticket` with an undo toast carrying the previous whole list (`TicketPanel.test.tsx`); a renamed definition calls `update_project_label` and writes no ticket (`App.test.tsx`); an undefined slug renders as itself on the card, in the panel and on the menu, survives a write of a different label, and outlives its definition being removed (`labels.test.ts`, `Board.test.tsx`, `TicketPanel.test.tsx`, `App.test.tsx`). **Two things worth a look:** the card's checklist fraction now hides at `0/0` per `components.md:180`, because otherwise the two-chip case is unreachable; and `QuickCreate.tsx` still takes labels as comma-separated free text, which V0-16 owns. **Scope, recorded 2026-08-01.** `screen-specs.md:251-258` enumerates the settings modal's sections — Name + Key, Folder, Theme, Appearance, danger zone — and Labels is not one of them, so the whole editor is outside what was asked for, and **removal** is asked for nowhere at all. Both are kept, deliberately, and the reasoning belongs here rather than in the diff. **Rename** is not optional: this row's second clause is *a renamed label definition rewrites no ticket*, which cannot be demonstrated without somewhere to rename from, and the spec says nothing about where that lives. **Add** follows rename — a project with no definitions has nothing to rename. **Removal** is the one that was a judgement call, and it is kept on two grounds: an editor that can only add strands a mistyped slug in `longclaw.yaml` permanently, since v0 has no other way to edit it from the app; and removal is provably harmless here rather than merely believed to be. It is the exact state this row's third clause already requires the app to survive — a ticket carrying a slug with no definition, rendered as itself — and both halves are tested: `registry::tests::changing_a_label_definition_never_rewrites_a_ticket` compares the ticket bytes across a rename, an add and a remove, and `App.test.tsx` asserts the slug outlives its definition on screen. It writes one project file and no ticket, and re-adding the definition restores the name and the colour. If a founder disagrees, the affordance is one section of the settings modal and three Tauri commands

## Source

`docs/backlog/v0-backlog.md` — **V0-10**, Wave 1, step 11, owner Domain.

## Checklist

- [x] Passed all three clauses, each confirmed failing first: slugs round-trip through edit_ticket with an undo toast carrying the previous whole list (TicketPanel.test.tsx); a renamed definition calls update_project_label and writes no ticket (App.test.tsx); an undefined slug renders as itself on the… <!-- longclaw:item=ck_9a5eb87e -->

## Activity

<!-- longclaw:event
id: evt_6a739f98
kind: create
occurred_at: 2026-08-05T14:22:53Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_438c41bf
kind: update
occurred_at: 2026-08-05T14:22:54Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_9a5eb87e.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Imported from `docs/backlog/v0-backlog.md`. The must-pass verification for V0-10 is recorded there as passed.
<!-- /longclaw:event -->
