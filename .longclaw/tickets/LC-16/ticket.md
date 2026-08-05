---
format: longclaw.ticket/v1
id: e1644e0e-fd29-4237-b33e-1662f9d6df0d
key: LC-16
title: Full ticket create surface with every approved field
status: done
priority: p1
labels:
  - frontend
  - v0-backlog
created_at: 2026-08-05T14:22:59Z
updated_at: 2026-08-05T14:23:00Z
---

~~Full ticket create surface with every approved field~~ **Done 2026-08-01** — there are two create surfaces now and the split is `screen-specs.md:198-216`'s. **Full create is `src/CreatePanel.tsx`, beside the panel rather than inside it**: it wears `.ticket-panel` and shares its vocabulary through `src/metaOptions.tsx`, `MenuButton`, `LabelMenuButton` and `DescriptionEditor`, but every behaviour in `TicketPanel.tsx` is a function of a file on disk — the load loop, the hash each save is written against, the conflict banner, the draft-preservation ref, the timeline, the composer, archive — and a create has none of them, while `detail === undefined` already means "still reading from disk" there. It carries the provisional chip (`KEY-n · new`, a `<span>` and never a tab stop), title, the meta grid, the description editor in **write mode only** (a `writeOnly` variant with no Preview tab, no footer and no keys of its own), checklist draft rows with remove and add-row, and `Create ticket` (`⌘↵`) + `Cancel`. No assignee (ADR 0001), no attachments (ADR 0005), no rank (ADR 0003) — `NewTicket` has no rank field. **Quick create is narrowed to title + status** and carries the typed title into full create, which is what V0-10 flagged: its comma-separated labels box was free text typed against definitions the project keeps in `longclaw.yaml`. **Full create is optimistic for the board and deferred for the panel**: it runs the same `submitNewTicket`/`mutate()` as quick create, so the card is up under the guessed key before the write leaves and the toast, Undo and `⌘Z` all work — but the panel opens on the key Rust allocated, because "view mode of the real ticket" reads a file and there is no file until then. [Plan 22](../../../docs/plans/completed/22-full-create-surface.md)

## Must-pass

Passed. **The must-pass is Rust**: `a_ticket_created_with_every_field_matches_one_assembled_by_edits` in `tests/file_format_contract.rs` builds two files in one temp project — `prepare_new_ticket` with all six fields, versus `prepare_new_ticket` with a title alone plus one `TicketDocument::apply` per field — re-parses each from its own bytes and compares a `CreatedState`: title, status, priority, labels, description, checklist as ordered `(text, checked)` pairs, **and** `assignee`, `rank`, `archived_at`, `attachments`, `unknown_keys`, `history_incomplete` and `record_diagnostics`, which neither path was asked to touch. It excludes `id` (a fresh UUID), `key` (two directories), `created_at`/`updated_at` (the edit path is asked for its changes after its create), checklist item ids (minted per item), and `activity` (one create event against a create plus five updates — the difference between the two paths, not a defect); it asserts the excluded ones **differ** rather than passing over them, and asserts every set field is a non-default so two blank tickets cannot agree about nothing. Confirmed red against an injected divergence on each side: reversing the create writer's checklist order, and making `append_checklist_item` write `- [x]`. **Fourteen frontend claims confirmed red-first** by reverting each behaviour in `CreatePanel.test.tsx`, `QuickCreate.test.tsx` and `App.test.tsx` § "the full create surface". **One defect found on the way:** `Menu.tsx`'s trigger and rows had no `type`, so putting the status menu inside quick create's `<form>` made every click submit it — two stray creates. Both are `type="button"` now, as is `LabelMenu`'s trigger. **`checklistFromLines` is gone** — quick create was its only caller and full create uses discrete draft rows, so it and its three unit tests were removed rather than kept as tested dead code. **Two things worth a look:** the two writers' bytes are not identical even though their parsed state is — the edit path leaves an extra blank line after the description and none before `## Activity`, because `append_checklist_item` builds its section without a trailing blank; and full create's footer carries a mono note the spec does not ask for, matching the description editor's, but it deliberately does not name the provisional folder, because the key is a guess

## Source

`docs/backlog/v0-backlog.md` — **V0-16**, Wave 1, step 11, owner Frontend.

## Checklist

- [x] Passed. The must-pass is Rust: a_ticket_created_with_every_field_matches_one_assembled_by_edits in tests/file_format_contract.rs builds two files in one temp project — prepare_new_ticket with all six fields, versus prepare_new_ticket with a title alone plus one TicketDocument::apply per field —… <!-- longclaw:item=ck_217d90fe -->

## Activity

<!-- longclaw:event
id: evt_dbb0af54
kind: create
occurred_at: 2026-08-05T14:22:59Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_6eb75760
kind: update
occurred_at: 2026-08-05T14:23:00Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_217d90fe.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Imported from `docs/backlog/v0-backlog.md`. The must-pass verification for V0-16 is recorded there as passed.
<!-- /longclaw:event -->
