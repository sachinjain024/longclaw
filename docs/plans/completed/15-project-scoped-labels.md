---
title: "Project-scoped labels"
product: LongClaw
status: completed
backlog_id: V0-10
order: 15
owner_area: Domain
release_blocking: true
depends_on: "12 (the label commands), 13 (the mutation seam), 14 (the shared menu)"
---

# Project-scoped labels

Labels exist on disk, on the wire, and nowhere a human can see them.
`longclaw.yaml` carries `labels: { <slug>: { name, color } }`
(`file_format.md:213-231`), every ticket carries a list of slugs
(`types.ts:124`), `ProjectReference.labels` crosses IPC with the definitions
(`types.ts:62`), and three commands — `add_project_label`,
`update_project_label`, `remove_project_label` (`src-tauri/src/lib.rs:103-138`) —
already write them. The frontend renders none of it. An agent can write a label
today and the human never sees it.

## Why this exists

Labels are the only grouping axis in v0 the user defines. The backend half
landed with [plan 12](../completed/12-rust-backend-for-wave-1.md), which was
explicit that it was backend-only and that V0-10's frontend was still open.

## The settled design

- **Definitions live in the project file; tickets store slugs only**, so a
  label's display name or colour changes without rewriting a single ticket
  (`file_format.md:229`). A slug is therefore immutable — there is no
  rename-slug command and there must not be one.
- **Chip anatomy** (`components.md:75-80`): 22px, pill radius, 1px border, a 7px
  dot in a fixed `--lc-label-*` hue — 19px and 6px on cards. The dot is
  reinforcement; the text is the identifier, and it is always drawn
  (`components.md:119`).
- **The ramp** (D12, `decisions.md:181-186`): blue · cyan · purple · pink · red ·
  orange · amber · gray. Eight fixed system hues, never themed, no green — green
  belongs to the agent. The eight `--lc-label-*` tokens already exist.
- **Chip counts**: a board card shows at most two chips, and at most one beside a
  checklist fraction, because the footer never wraps
  (`screen-specs.md:121-122`). A list row shows at most two
  (`screen-specs.md:144`) — the list surface is V0-14, so the chip has to be
  droppable into it without being built here.
- **The menu** is the same popover as status, priority and ordering
  (`screen-specs.md:239-247`), with `multiple`: labels tick and stay open. The
  panel's meta grid gains a Labels row after Priority
  (`keyboard-focus-map.md:61`).
- **An undefined slug** is not specified anywhere. The gate says it must be
  preserved and rendered legibly, so: the gray ramp hue, the raw slug as the
  text, never dropped, never normalised, never repaired on write.

## Do this

1. `src/labels.ts` — the ramp and slug → chip resolution, pure, so the board, the
   list rows, the panel and the menu cannot disagree.
2. `src/LabelChip.tsx` — the chip and its dot.
3. `src/LabelMenu.tsx` — the trigger and the multi-select `Menu`.
4. `presentCard` takes the definitions and caps the chips; `Board` passes
   `project.labels` down.
5. The panel gains the Labels row, writing through `save()` with the whole list
   and the previous whole list as its inverse.
6. `src/api.ts` gains the three wrappers. Definition management goes in the
   existing project settings panel, because `screen-specs.md` § Project settings
   does not mention labels at all.

Leave `QuickCreate.tsx` alone. V0-16 owns that surface.

## Done when

- Slugs round-trip: a tick writes `{ labels: [...] }` through `edit_ticket` and
  the chips follow.
- A renamed definition writes `update_project_label` and no ticket at all.
- An undefined slug renders as itself, survives a write of a different label, and
  can still be taken off.
- `npm --prefix apps/desktop run check` passes.

## Watch out for

- **`TicketDocument::apply` refuses an edit that changes nothing**, so a no-op
  pick must write nothing.
- **`TicketEdit.labels` is a whole-list replace**, which is what makes the
  inverse of a label change the previous full array rather than one slug.
- **Rust already proves the two hard invariants** — a changed definition and a
  removed definition each rewrite no ticket. Do not re-prove them in TypeScript.

## Outcome

Shipped as the frontend half of V0-10. Nothing in Rust changed.

- `apps/desktop/src/labels.ts` — the D12 ramp and slug → chip resolution, pure.
  `resolveLabels(slugs, definitions, limit?)` is the one lookup; it never fails
  and never drops, because an undefined slug resolves to itself.
- `apps/desktop/src/LabelChip.tsx` — `LabelChip`, `LabelChips`, `LabelDot`.
- `apps/desktop/src/LabelMenu.tsx` — `LabelMenuButton`, the Labels meta row.
- `presentCard(ticket, definitions)` caps the chips; `Board` and `TicketPanel`
  both take the project's `labels`.
- `apps/desktop/src/api.ts` — `addProjectLabel`, `updateProjectLabel`,
  `removeProjectLabel`, each taking a request object because two of them carry
  optional fields.
- Definition management is a `ProjectLabels` section inside the existing project
  settings panel in `App.tsx`, with a slug shown as the key it is rather than as
  a field.

Four decisions the design docs did not make:

1. **An undefined slug is the gray ramp hue, the raw slug as its text, and a
   dashed border.** It is never dropped, normalised, or repaired on write — a
   write of a *different* label carries it through untouched, and it stays on the
   menu so it can be taken off. The dashed border is only a marker; the slug
   itself is always readable, so colour is not carrying meaning alone.
2. **The card's checklist fraction now hides when there is no checklist**, which
   is what `components.md:180` always said and what the code did not do. Without
   it the "max 2 chips, max 1 beside a fraction" rule
   (`screen-specs.md:121-122`) has no two-chip case at all, because every card
   showed `0/0`. Chips over the cap are simply not drawn; the spec asks for no
   `+n` counter and one would cost the width the cap exists to protect.
3. **Definition management went into project settings**, because
   `screen-specs.md` § Project settings does not mention labels anywhere. It is
   deliberately plain: name, colour from the eight ramp hues, remove, and an add
   row. A colour the ramp does not hold — including Rust's own `slate` default —
   stays selectable in its row, so saving a rename cannot silently recolour a
   label.
4. **The menu's rows are frozen at the moment it opens.** Unticking an undefined
   slug otherwise deleted its own row mid-interaction, taking the only way of
   putting it back with it.

`Menu`'s `multiple` mode needed no change. Ticking, staying open, `aria-checked`
on `menuitemcheckbox`, and focus return all behaved as its own tests claim; the
wrinkle above was in the caller, not in the menu.

Confirmed red before green:

- `Board.test.tsx` — all three of "draws one chip per slug", "draws an undefined
  slug as itself", and "stops at two chips, and at one beside a checklist
  fraction".
- `TicketPanel.test.tsx` — all six of the `labels in the panel (V0-10)` tests,
  and separately "keeps an unticked undefined slug on the menu", which is what
  produced decision 4.
- `App.test.tsx` — all four of the `label definitions in project settings
  (V0-10)` tests, including must-pass 2 (`update_project_label` is called and
  `edit_ticket` is not) and the removed-definition case.

`npm --prefix apps/desktop run check` passes, including `cargo test` and the
Vite build. `npm run verify` was not run, as instructed.

One overlap left open: `QuickCreate.tsx` still takes labels as a comma-separated
free-text field. V0-16 owns that surface and will narrow quick create to title
and status (`screen-specs.md:198-207`); `LabelMenuButton` is what its full create
surface should use.
