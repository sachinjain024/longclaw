---
title: "The Rust backend Wave 1 is missing"
product: LongClaw
status: completed
backlog_id: "V0-09, V0-10, V0-18"
order: 12
owner_area: Storage
release_blocking: true
depends_on: none
---

# The Rust backend Wave 1 is missing

Three Wave 1 items need something from Rust that is not there yet. None of them
is a bug in what exists; all three are holes in the surface the frontend has to
build against, and two of them are holes the frontend cannot fill from its side.

- **V0-10** parses `labels:` out of `longclaw.yaml` and then drops it on the
  floor. `Project.labels` exists (`core/project.rs:49`); `ProjectReference` — the
  only project shape that crosses IPC — does not carry it, and there is no writer
  and no command. The frontend can render a slug but has no display name and no
  colour for it, and no way to define one.
- **V0-09** can set a rank and can never clear one. `TicketEdit.rank` is
  `Option<String>` (`core/ticket.rs:326`) and `apply()` handles only the `Some`
  arm (`:608-618`), unlike `labels` and `archived_at`, which both have removal
  branches. ADR 0003 says rank is written only by manual reordering; leaving
  Manual has nowhere to put the rank back.
- **V0-18** is believed to already hold and is asserted nowhere against its own
  bar. The corpus harness drives exactly one mutation — a title edit — and checks
  that `Vec<Attachment>` compares equal, which is "parses the same", not
  "byte-identical records".

## Why this exists

Wave 1's frontend items are being built in parallel. Each of the three gaps above
is upstream of one of them, so they are pulled out here rather than being
discovered mid-item.

## Working rules

- `export PATH="/opt/homebrew/opt/rustup/bin:$PATH"` before any cargo work.
- Backend only: `apps/desktop/src-tauri/`, plus `apps/desktop/src/types.ts` for
  the TypeScript mirror of any wire-shape change. Other agents own the rest of
  the frontend.
- Test-first at the seams, and confirm each behavioural test is red before it is
  made green.
- `npm --prefix apps/desktop run test:rust` and `npm --prefix apps/desktop run check`.
  Not the full `npm run verify`: it runs the native watcher, which is slow and
  which another part of this work runs once at the end.

## Do this

### 1. Label definitions, exposed and writable

Add `labels` to `ProjectReference` as a `BTreeMap<String, Label>`, last in the
struct so the existing fields keep their order. `ProjectReference` is also the
persisted registry entry, so the field needs `#[serde(default)]` the way `key`
and `starred` already have it: a registry file written by the current build must
still load.

`longclaw.yaml` is the source of truth. The registry entry is a cache that only
has to survive an unreachable folder, so `list` and `find` re-read the project
file and rebuild the reference from it rather than trusting what they persisted.

`Mapping` (`core/yaml.rs`) can only mutate top-level scalars and sequences.
`labels:` is a nested mapping, so it needs nested support: set one field of one
child, and remove one child, with every other child's bytes — and every other
line of the edited child, including keys this build does not interpret —
untouched.

Then `ProjectDocument::add_label`, `update_label`, `remove_label`, registry and
`AppState` pass-throughs, and three commands shaped like `update_project_theme`.

The invariant to prove: a rename changes the display name in `longclaw.yaml` and
touches zero ticket files, because tickets store slugs. Removal is the same:
an unknown slug on a ticket is preserved and rendered legibly, so a removed
definition is not a reason to rewrite anything.

### 2. A rank clear path

`TicketEdit.rank` becomes `Option<Option<String>>` behind a deserializer that
distinguishes an absent key from an explicit `null`, so `{"rank": null}` clears
and an absent `rank` still means "leave it alone". `deny_unknown_fields` stays,
the frontend type gains `| null`, and nothing else in the pinned contract moves.
The removal branch mirrors `archived_at`: `Mapping::remove` plus a `FieldChange`
with a `from` and no `to`.

### 3. V0-18, asserted rather than assumed

A fixture carrying attachment records the app cannot interpret — a media type
outside `image/*`, `text/*`, `video/*`, and a record with a field this build does
not read — plus a test that drives every mutation an edit can make and asserts the
`## Attachments` region comes back byte-identical each time. Not "the attachments
parse the same": the bytes.

## Done when

- Three label commands exist, return the updated `ProjectReference`, and are
  covered by tests including the two V0-10 must-pass invariants.
- `{"rank": null}` clears a rank; `tests/ipc_requests.rs` accepts both spellings.
- The V0-18 test drives title, status, priority, labels, rank, archive,
  unarchive, description, checklist toggle, checklist append, and comment.
- `test:rust` and `check` are green.
- The V0-18 backlog row is closed in the done convention. V0-09 and V0-10 stay
  open: only their backend halves land here.

## Watch out for

- `tests/fixtures/ipc-contract.json` pins the serialized `ProjectReference`.
  Adding a field means updating the fixture in the same change.
- An emptied `labels:` must not become a bare `labels:` — that reads back as
  null and the project stops parsing.
- A rank cleared to `Option<Option<String>>` silently changes what serde does
  with an explicit `null`: without a custom deserializer, `null` deserializes to
  the outer `None`, which means "leave it alone" and the clear never happens.

## Outcome

All three landed. Two of the three assumptions above turned out to be right and
one of them was wrong in a way worth recording.

### Label definitions (V0-10, backend half)

`ProjectReference` gained `labels: BTreeMap<String, Label>` last in the struct,
behind `#[serde(default)]` (`core/model.rs`). It is populated by
`ProjectReference::from_project`, so it comes from `longclaw.yaml` on every path
that builds a reference.

The source-of-truth decision came out on the side of the file, as planned, but it
needed more than not caching. `RegistryStore::list` already re-read the project
file to probe reachability and then threw the parsed document away; that probe is
now `refreshed`, which rebuilds the whole reference from the document and keeps
only `starred` — the one field the registry genuinely owns — from the cached
entry. `find` runs it too, so an engine started after an external edit sees the
new definitions. The registry file still *contains* the labels, because
`ProjectReference` has one `Serialize` impl for both the wire and the registry,
but nothing reads them back except for a project whose folder is gone.

`core/yaml.rs` had no nested-mapping support and needed it. It gained a private
`NestedMapping` — the children of one top-level entry, each owning its own raw
bytes — behind two public methods, `Mapping::set_nested_scalar` and
`Mapping::remove_nested`. Setting a field rewrites one line inside one child;
everything else, including keys inside a definition that this build does not
interpret, passes through untouched. A new child is appended rather than sorted
in, so no existing line moves. Removing the last child collapses the key to
`labels: {}`, because a bare `labels:` reads back as null and would stop the
project parsing — that one is pinned by its own test.

`ProjectDocument` gained `add_label`, `update_label`, and `remove_label`; the slug
is not editable by design, since it is what tickets store. Three commands wrap
them: `add_project_label`, `update_project_label`, `remove_project_label`, all
returning the updated `ProjectReference` and all dropping the cached engine the
way `update_project_theme` does.

The V0-10 invariant is pinned in `registry.rs` by
`changing_a_label_definition_never_rewrites_a_ticket`, which registers a project
with a ticket carrying both a defined slug and an undefined one, then renames,
recolours, adds, and removes definitions and compares the ticket's bytes each
time. Removal is covered by the same test for the same reason: an undefined slug
is preserved and rendered as itself, so dropping a definition is not a reason to
touch a ticket either.

### Rank clear (V0-09, backend half)

`TicketEdit.rank` is now `Option<Option<String>>` behind a local `nullable`
deserializer, so absent still means "leave it alone" and `null` means "clear".
Without the custom deserializer serde reads an explicit `null` as the outer
`None`, which would have silently made the clear a no-op — that is the trap the
plan called out, and it is real. `deny_unknown_fields` is unchanged, the pinned
`ipc-contract.json` did not move, and the frontend `TicketEdit.rank` only widened
to `string | null`. The removal branch mirrors `archived_at`: `Mapping::remove`
plus a `FieldChange` carrying `from` and no `to`.

### V0-18

The prior audit was right: it already held, and no code changed to make the new
test pass. What did not hold was the *coverage* claim — the corpus harness drove
one mutation and compared parsed `Vec<Attachment>` values, which is a weaker bar
than the backlog states. `attachment_records_survive_every_mutation_byte_identically`
now slices the raw `## Attachments` region and compares bytes across all eleven
mutations, over a fixture with a media type outside the v0 set and a record
carrying `checksum` and a nested `x_origin` that this build never reads.

Because it passed on the first run, "red first" was not available. It was
confirmed to bite instead: with a two-line fault injected into
`TicketDocument::apply` that rewrote `sha256:` to `sha256-` inside the attachments
chunk, the test failed and printed the diff. The fault was reverted immediately.

### Confirmed red first

- `core::yaml` nested-mapping tests (8) — failed to compile against the old
  `Mapping`.
- `core::ticket::tests::setting_and_clearing_a_rank_leave_the_other_keys_alone`
  and `clearing_a_rank_that_is_already_absent_changes_nothing` — failed to compile
  against `rank: Option<String>`.
- `tests/ipc_requests.rs::an_absent_rank_leaves_the_rank_alone_and_a_null_rank_clears_it`
  — same.
- `core::project` label tests (8) — no `add_label`/`update_label`/`remove_label`.
- `registry::tests::changing_a_label_definition_never_rewrites_a_ticket` and
  `label_definitions_are_re_read_from_the_project_file` — no `labels` field, no
  registry methods.
- `attachment_records_survive_every_mutation_byte_identically` — green on first
  run, then confirmed by fault injection as described above.

Three of those tests were red for the wrong reason first and had to be corrected
rather than the code: `set_scalar_after` and `set_nested_scalar` place a new key
after the *last* entry of `after` that exists, not the first, and a new label is
appended rather than sorted into slug order. In both cases the existing behaviour
is the right one and the expectation was wrong.

### Validation

- `npm --prefix apps/desktop run test:rust`: green — 103 lib, 3 format-contract,
  5 ipc-requests, 17 storage, 18 watcher, plus the smaller suites.
- `npm --prefix apps/desktop run check`: green, including `cargo clippy -D warnings`,
  `tsc --noEmit`, vitest, and the vite build.
- `npm run verify` was deliberately not run: it drives the native watcher, which
  another part of this work runs once at the end.

### Scope note

One rule was broken knowingly. Making `labels` required on the TypeScript
`ProjectReference` — which is what the wire actually sends — broke `tsc` in three
frontend files that build project literals: `perf/fixture.ts`, `src/App.test.tsx`,
and `src/state.test.ts`. Each got exactly one added line, `labels: {},`. The
alternative was to declare the field optional, which would have been a lie about
the wire shape and would have pushed `?? {}` into every consumer.

## Amendment 2026-08-01 — one mutation the matrix was missing

V0-18's must-pass is that attachment records survive *every* app mutation
byte-identically, and `attachment_records_survive_every_mutation_byte_identically`
enumerated eleven of them. It omitted `rank: Some(None)`.

That is not a gap in coverage of a field already covered. `TicketEdit.rank` is
`Option<Option<String>>` — absent leaves the rank alone, `null` clears it — and
clearing takes its own arm of `apply`, reached by its own wire value. It is what
the board sends when a human undoes the drop that gave a card its first rank, so
it is a live path and not a hypothetical one. The matrix now runs it against the
result of the rank set, the way unarchive runs against the archive, because
clearing a rank a ticket does not have is refused.

Confirmed red on its own rather than as part of the whole: an attachments rewrite
injected into the clear arm alone fails `rank clear` and nothing else.
