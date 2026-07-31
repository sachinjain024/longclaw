---
title: "Full ticket create surface with every approved field"
product: LongClaw
status: completed
backlog_id: V0-16
order: 22
owner_area: Frontend
release_blocking: true
depends_on: "13 (mutate), 14 (Menu), 15 (LabelMenu), 18 (DescriptionEditor)"
---

# Full ticket create surface with every approved field

Quick create is the only way to make a ticket, and it is the wrong shape twice
over. It asks for six things the spec says a *quick* create must not ask for, and
it asks for labels as a comma-separated text box — which was defensible before
V0-10 gave the project real label definitions and a real label menu, and is not
defensible now. A slug typed into a free-text field is a slug the project may not
define.

`screen-specs.md:198-216` splits the two surfaces:

- **Quick create** is title + status, and carries an **Open full editor →** that
  passes the typed title along.
- **Full create** is *the ticket panel in create mode*: provisional ID chip
  (`KEY-n · new`), title, the same meta grid (status/priority/labels), the
  description editor in write mode only, checklist draft rows with remove and
  add-row, and a footer of **Create ticket** (`⌘↵`) + ghost **Cancel**.

This is the last open item in Wave 1.

## Decisions taken before writing code

**Create mode lands beside the panel, not inside it.** `src/CreatePanel.tsx`, a
sibling wearing `.ticket-panel`. Every behaviour in `TicketPanel.tsx` is a
function of a file on disk: the `load` loop, the content hash every `save` carries,
the conflict banner, the draft-preservation ref, the external-mark
acknowledgement, the checklist adoption, the timeline and the composer, the
archive button. A create has no file, so all of those are dead branches, and
`detail === undefined` — the state a create would live in — already means
"still reading from disk" in that component. Sharing is a module extraction
(`src/metaOptions.tsx` for the status and priority menu rows), not a component
merge.

**Full create is optimistic for the board and deferred for the panel.** It runs
the same `submitNewTicket` as quick create, so the card appears at the top of its
column under the provisional key before the write leaves, the toast and its Undo
and `⌘Z` all work, and nothing blocks on the disk. The *panel* is the one part
that waits: `screen-specs.md:214` says "the panel swaps to view mode of **the real
ticket**", and view mode is `readTicket(projectId, ticketKey)` against a path that
does not exist until the write lands. Opening the panel on the guessed key would
show a `ticket_not_found`. So the create panel closes on submit, focus goes to the
optimistic card, and the panel opens on the key Rust allocated when the write
returns. Nothing is ever shown as a fact about a file before the file exists.

**No assignee (ADR 0001), no attachments (ADR 0005), no rank (ADR 0003).**
`NewTicket` has no rank field and a created ticket needs no rank allocation.

## The must-pass

> A ticket created with every field parses identically to the same ticket
> assembled by edits.

A Rust contract test, beside the three models already in
`src-tauri/tests/file_format_contract.rs`. Two paths to two files:
`prepare_new_ticket` with every field populated, versus `prepare_new_ticket` with
title alone followed by one `TicketDocument::apply` per field. Both files are
re-parsed from their own bytes and their **ticket state** is compared.

"Identically" cannot mean byte-identical and must not be weakened to something
trivially true. What is compared and what is excluded:

| Compared | Excluded, and why |
|---|---|
| `title`, `status`, `priority`, `labels`, `description` | `id` — a fresh UUID per create |
| checklist as `(text, checked)` pairs, in order | `key` — two files, two directories: `LC-1` and `LC-2` |
| `assignee`, `rank`, `archived_at`, `attachments`, `unknown_keys` — the fields *neither* path was asked to set | `created_at`/`updated_at` — the edit path is asked for its changes after the create, so its `updated_at` is legitimately later |
| `history_incomplete`, `record_diagnostics` | checklist item **ids** — minted per item; the pair comparison is the honest form |
| | `activity` — differs *by construction*: one create event versus a create plus N updates. That is the difference between the two paths, not a defect |

Each set field is also asserted to be the non-default value it was asked for, so
two empty tickets cannot pass by agreeing about nothing.

## Do this

1. **`src/metaOptions.tsx`** — lift `STATUS_OPTIONS`/`PRIORITY_OPTIONS` out of
   `TicketPanel.tsx` so the panel, the create panel, and quick create's status
   trigger read one list.
2. **`src/DescriptionEditor.tsx`** — a `writeOnly` variant: no Preview tab, no
   footer of its own, no mount focus (the title owns it in create mode), and no
   `Esc`/`⌘↵` interception (the create panel owns both). Modelled as a
   discriminated union so the edit path keeps its required `onSave`/`onCancel`.
3. **`src/CreatePanel.tsx`** — the surface. Provisional chip is a `<span>`, never
   a tab stop. Tab order status → priority → labels, per
   `keyboard-focus-map.md:57`. `⌘↵` creates; `Esc` cancels.
4. **`src/QuickCreate.tsx`** — narrow to the spec: context line, title, status
   trigger, and a footer of **Open full editor →**, the hints `↵ create · esc
   cancel`, and **Create**. The description, checklist and priority fields and the
   comma-separated labels box all go.
5. **`src/App.tsx`** — one create surface at a time (`"quick" | "full"`), the
   title carried between them, `submitNewTicket` given an option that swaps the
   panel to view mode of the real ticket instead of focusing the card.
6. **`src-tauri/tests/ipc_requests.rs`** — the create request's shape is
   unchanged, but the test that pins it is named after quick create and quick
   create no longer sends that shape. Rename it and add the narrowed one.

## Done when

- The Rust must-pass is in `file_format_contract.rs` and green, and confirmed to
  fail against an injected divergence.
- Behavioural coverage for the create panel and the narrowed quick create, each
  confirmed red-first.
- `npm --prefix apps/desktop run check` is green.

## Watch out for

- **Do not build a second write path.** Create goes through `mutate()` like
  everything else (plan 13).
- **Do not build a second label affordance.** `LabelMenuButton` is the meta row.
- **Undo of a create archives**, because v0 has no deletion (ADR 0004). Keep
  V0-17's honest copy for whichever surface created the ticket.
- The provisional key is a **guess** read off the rows on screen. Never present it
  as the ticket's key: `KEY-n · new`, display only.

## Outcome

Shipped as planned, with one decision sharpened and one defect found on the way.

**Create mode landed beside the panel**, as `apps/desktop/src/CreatePanel.tsx`. The
argument in the plan held up under the code: nothing in `TicketPanel.tsx` survives
the removal of the file it reads. What the two share turned out to be exactly one
module worth of vocabulary — `src/metaOptions.tsx`, lifted out of the panel so the
panel, the create panel and quick create's status trigger cannot disagree about
what the options are.

**Full create is optimistic for the board and deferred for the panel.** The card
appears under the guessed key before the write leaves, through the same
`submitNewTicket`/`mutate()` path quick create uses, so the toast, its Undo and
`⌘Z` are unchanged and undoing a create still archives (ADR 0004). The panel is
the part that waits: `submitNewTicket` gained one option, `openPanel`, which calls
`openTicket(written.ticket.key)` in `onWritten` instead of `focusCard`. It cannot
be done sooner — view mode is `readTicket(projectId, key)`, and opening on the
guess would read a path that does not exist. Focus rides the optimistic card in
the gap, so nothing waits and nothing is dropped.

**`DescriptionEditor` gained a `writeOnly` variant** rather than a create-mode
clone: no Preview tab, no footer, no mount focus, and neither `Esc` nor `⌘↵`
intercepted, because the create panel owns both. It is a discriminated union, so
the edit path still cannot be constructed without `onSave`/`onCancel`.

### What the must-pass compares

`a_ticket_created_with_every_field_matches_one_assembled_by_edits` in
`src-tauri/tests/file_format_contract.rs`. Two files in one temporary project:
`prepare_new_ticket` with all six fields, versus `prepare_new_ticket` with a title
alone plus one `TicketDocument::apply` per field. Each is re-parsed from its own
bytes and projected into a `CreatedState`.

Compared: `title`, `status`, `priority`, `labels`, `description`, the checklist as
ordered `(text, checked)` pairs — and `assignee`, `rank`, `archived_at`,
`attachments`, `unknown_keys`, `history_incomplete` and `record_diagnostics`,
which *neither* path was asked to touch. Excluding those would let a create that
quietly wrote a rank pass.

Excluded, and asserted to differ rather than passed over: `id` (a fresh UUID),
`key` (two directories), `created_at`/`updated_at` (the edit path is asked for its
changes after its create), checklist item ids (minted per item), and `activity`
(one create event against a create plus five updates — the difference between the
two paths, not a defect in either). Every set field is also asserted to be a
non-default, so two blank tickets cannot pass by agreeing about nothing.

Confirmed red on both sides of the seam: reversing the create writer's checklist
order, and making `append_checklist_item` write `- [x]`.

### Found on the way

**`Menu.tsx`'s buttons had no `type`.** A `<button>` inside a `<form>` defaults to
`submit`, so the first run of the narrowed quick create fired two creates per
status pick. The trigger and the rows are `type="button"` now, and so is
`LabelMenu`'s trigger. Nothing before V0-16 put a menu inside a form, which is why
it had never shown.

**The two writers' bytes are not identical, only their parsed state is.** The
frontmatter matches line for line apart from `id`, `key` and `updated_at`. The
body differs in two blank lines: the edit path leaves an extra one after the
description (`set_description` writes `\n{text}\n\n` whenever any chunk follows)
and none before `## Activity` (`append_checklist_item` builds a new `## Checklist`
section without a trailing blank). Both parse the same and both render the same,
so this is cosmetic, it predates V0-16, and it is left alone deliberately — but it
is the concrete reason the must-pass is a claim about parsed state rather than
about bytes.

**`checklistFromLines` is gone.** It turned a textarea into items, with a pasted
Markdown task list accepted. Quick create was its only caller and full create uses
discrete draft rows, so nothing was left to paste into. It and its three unit tests
were removed rather than kept as tested dead code; git has them if a
paste-a-checklist affordance is ever wanted.

**Full create's footer carries a mono note the spec does not list.** It matches
the description editor's `writes to ticket.md on save`, which is the app's voice
everywhere else. It deliberately does not name the folder: the provisional key is
a guess, so `writes one ticket.md under .longclaw/tickets/` is what can honestly
be said.

### Validation

- `npm --prefix apps/desktop run check`: green (tokens, format, lint, typecheck,
  Rust + frontend tests, vite build).
- 472 frontend tests, 26 files. Seventeen behavioural claims for this item, each
  confirmed failing first by reverting the behaviour it describes.
- `src-tauri/tests/ipc_requests.rs`: the create request's shape is unchanged, but
  the test that pinned it was named for quick create, which no longer sends it.
  Renamed to `the_create_request_the_full_create_surface_sends`, with
  `the_create_request_quick_create_sends` added beside it — the narrowed surface
  omits four fields, so they have to be genuinely optional on the wire rather than
  merely always sent.
- Perf not re-run: nothing on the board or list render path changed. `Menu.tsx`
  gained a `type` attribute and `TicketPanel.tsx` lost two `const`s to an import.
