---
title: "Write failures and conflicts as actionable, typed states"
product: LongClaw
status: completed
backlog_id: "V0-29"
order: 39
owner_area: Frontend / Storage
release_blocking: true
depends_on: "13 (the mutation seam), 23 (which fixed one defect here and named the rest)"
blocks: "Step 14's exit gate — this is the last open row in the step"
---

# Write failures and conflicts as actionable, typed states

V0-29 is the last open Step 14 row. [Plan 23](../completed/23-retry-must-not-resend-a-stale-hash.md)
fixed one honesty defect in this surface — Retry on a conflict re-sent a hash the
disk had already moved past — and deliberately left four things behind. [Plan 38](../completed/38-complete-step-14-recovery.md)
closed every other row in the step and marked this one done without implementing
them; the review reopened it.

The four are below, each verified still true in the tree at `d2502d4`, plus a
fifth found while writing this plan.

Step 14's exit gate is *"concurrent changes produce an explicit, understandable
resolution path"* and *"a user can recover from every known failure without
editing app-internal state."* Clause 1 is the first sentence and clause 3 is the
second. This is the work that lets the step close.

## The five defects

### 1. A conflict raised outside the panel has no two-way resolution

`ConflictBanner` renders from `TicketPanel`'s own `conflict` state
(`src/TicketPanel.tsx:162`, `:515`), set in exactly two places: the panel's
`save()` being refused, and an external change landing on an open draft. Nothing
in `App.tsx` can reach it, and mounting the panel fresh runs `load("open")`,
which clears it (`src/TicketPanel.tsx:277`).

So a conflict on `changePriority`, `reorderTicket`, `setArchived`, or any of the
inverses those build for Undo gets **Open ticket** and nothing else
(`src/App.tsx:847-850` says so in its own comment). The refused edit is thrown
away by the revert before the human is asked anything.

### 2. The same typed error reads two ways

Rust's `conflict_error` (`src-tauri/src/core/storage.rs:838`) says *"This ticket
changed on disk while you were editing. Reload it or keep your version, then save
again."* That is the banner's vocabulary — it names two buttons. Out on the board
there is no banner, so plan 23 had the frontend compose its own copy instead
(`conflictMessage`, `src/mutations.ts:97`). One typed error now reads two
different ways depending on where it landed, which is the thing ADR 0010's
`message` field exists to prevent.

### 3. `permission_denied` and `io` say only what Rust said

`AppError::io` (`src-tauri/src/core/error.rs:49-61`) formats
`"{action} failed for {path}: {os error}"` — the raw `io::Error` as presentation
text. A read-only project folder reads *"Writing ticket failed for
/Users/…/ticket.md: Permission denied (os error 13)"*.

The frontend does not improve on it. The danger toast shows `normalized.message`
verbatim (`src/mutations.ts:196`), and the global banner shows the *error code*
as its heading — `error.code.replaceAll("_", " ")` (`src/App.tsx:1030`) — which
is the `internal`-looking leak the backlog row objects to. Retry is correct and
stays. Nothing else is offered: no recovery, and the file is named only inside a
sentence Rust wrote for a log.

### 4. A conflict on Undo inside the panel gets less than a save does

The inverse mutation `save()` builds (`src/TicketPanel.tsx:380-399`) carries no
`handles`, so a conflict on Undo falls through to the ordinary toast — a fact and
a dismissal — while the same conflict on the forward save gets the banner and a
choice.

### 5. Keep mine can re-send the hash Rust just refused

Found while planning this; **verify it red before fixing it.**

When a write is refused, `handles` sets the banner and returns true
(`src/TicketPanel.tsx:403-412`). `mutate()` then resolves `undefined`, so
`save()`'s `if (written) await load("local")` (`:414`) does not run and `detail`
still holds the hash Rust just rejected. `keepMine()` re-saves the refused edit
against `detail?.contentHash` (`:367`, `:432`) — the stale one. It only succeeds
today when the watcher's `ticketChanged` happens to arrive first and drive
`load("external")`, which is a race, and the existing coverage does not cover it:
`TicketPanel.test.tsx:810` asserts the banner appears and stops there.

## The decision this plan makes

Plan 23 left one design question open: *may a mutation raised outside the panel
hold its edit and re-apply it over a newer file?*

**Yes — but only inside the panel, over a file the human has been shown.**

The refused edit is handed to the panel, which opens on the ticket, reads it, and
raises its existing banner over the current content. There is no second conflict
UI and no out-of-panel Keep mine.

That is not the blind overwrite plan 23 ruled out, for two reasons:

- **The write goes against a hash the panel just read and rendered.** The human
  is looking at the newer file when they choose. If the disk moves again between
  the read and the choice, Rust refuses again and the banner re-raises — the
  check still holds.
- **`TicketEdit` is field-level.** Keep mine on a board-raised priority change
  re-applies `priority` and nothing else; the external edit's other fields
  survive. A full-content overwrite is only possible from the panel's own title
  and description drafts, which is existing shipped behaviour.

The alternative — an out-of-panel banner that re-applies against a hash nobody
looked at — is rejected: it is the data loss the conflict check exists to
prevent, one interaction removed.

## Working rules

- Topic branch off updated `main`. Never commit to `main`. (`AGENTS.md`)
- One write path (`mutate()`), one conflict UI (`ConflictBanner`), one toast
  stack. No second anything.
- Colours come only from `var(--lc-*)`.
- Every behavioural claim gets a test **confirmed failing first**.
- No new Tauri capability. `capabilities/main.json` grants no shell, opener, or
  filesystem to the webview, and this row is not the place to widen it — see
  § Non-goals for what that costs.

## Do this

### 1 — Hand the refused edit to the panel (defect 1)

- `App.tsx` holds the conflict a board mutation could not resolve:
  `{ ticketKey, error, edit }`, set in the mutation's `review`, cleared when the
  panel closes or the selected ticket changes. It must not outlive the decision.
- Pass it to `TicketPanel` as one prop (`heldConflict`).
- `TicketPanel` seeds `conflict` from it **after** `load("open")` resolves, so
  the banner sits over the file as it now reads rather than over stale content.
  `load("open")`'s unconditional `setConflict(undefined)` (`:277`) is what makes
  the ordering matter; the seed goes after the load, not into it.
- `review` keeps its current job — opening the ticket — and gains the hand-off.
  The toast copy changes from stating a dead end to naming the choice waiting in
  the panel.
- The inverses built for Undo carry the same hand-off, since a conflict on an
  undone archive is the same situation.

### 2 — One conflict vocabulary (defect 2)

- `conflict_error` (`storage.rs:838`) states the fact and the guarantee and names
  no buttons: the file changed under the edit, and the version in hand was not
  written. `classify_swap_error`'s removed-file conflict (`storage.rs:~618`) is
  already fact-shaped; align the two and give both the same context keys — that
  one carries `path` but no `ticketKey`, and `conflict_error` the reverse.
- `conflictMessage` (`src/mutations.ts:97`) becomes the single composer, used by
  the toast **and** `ConflictBanner`. Actions and their consequences stay with
  the surface that owns them: the banner keeps its Reload/Keep mine note, the
  toast keeps Open ticket.
- Rust tests asserting the old banner-shaped string are updated with it.

### 3 — Name the file and offer the recovery (defect 3)

- `AppError::io` keeps `path` in `context`, adds the OS detail as context rather
  than prose, and carries a `message` a human can act on: which file, what state
  the folder or volume is in, and that the file was left as it was.
- Distinguish the two ordinary cases so the copy can be concrete — a read-only
  file or folder, and a volume with no space left. Anything else stays generic
  rather than guessing.
- The frontend renders write failures through one presentation used by both the
  danger toast and the global banner: the file name, the full path in mono, the
  guarantee, Retry, and the recovery sentence. `error.code` stops being a
  heading (`src/App.tsx:1030`).
- `recoverable` still selects whether Retry appears at all (ADR 0010).

### 4 — The panel's Undo reaches the banner (defect 4)

- The inverse mutation gets the same `handles` as the forward save: set
  `conflict` with the inverse as its `pending`, clear the optimistic state, raise
  no toast. Keep mine then re-applies the inverse against the reloaded file.

### 5 — Re-read on refusal, so Keep mine writes against what was shown (defect 5)

- When `handles` takes a conflict, re-read the file and keep the refused edit as
  the banner's `pending` — the same shape `load("external")` already produces for
  an external change landing on a draft, minus the draft-preservation branch.
- After it, `detail.contentHash` is the hash of the content on screen, so Keep
  mine sends a hash the human was actually shown, and the watcher event that
  follows changes nothing.

## Tests, each confirmed red first

Frontend (`vitest`):

- `App.test.tsx` — a board-raised conflict on priority opens the panel with the
  banner up and the refused edit held; Keep mine writes that edit against the
  hash the panel read, not the one the board sent.
- `App.test.tsx` — the held conflict does not survive closing the panel, and does
  not leak onto the next ticket opened.
- `TicketPanel.test.tsx` — Keep mine immediately after a refused write sends the
  reloaded hash (red today: it sends the refused one — defect 5).
- `TicketPanel.test.tsx` — a conflict on Undo raises the banner, reverts nothing,
  and raises no toast; Keep mine re-applies the inverse.
- `mutations.test.ts` — the toast and the banner state the same fact from the
  same composer for the same error.
- `App.test.tsx` / `WriteFeedback.test.tsx` — `permission_denied` and `io` name
  the file, offer Retry, state the guarantee, and never render a bare code.

Rust (`cargo test`):

- `conflict_error` names no buttons and carries both `ticketKey` and `path`.
- The removed-while-saving conflict carries the same keys.
- A write into a read-only folder returns `permission_denied` with `path` in
  context and actionable copy; the file on disk is byte-identical afterwards.
- An `ENOSPC`-shaped failure returns `io` with the same guarantees.

## Done when

- The backlog must-pass holds: *every write failure path reports a typed,
  recoverable error naming the file, and the file is left as it was.*
- A conflict raised anywhere ends at the same banner, over content the human has
  seen, with the same words for the same error.
- No path offers a button that cannot succeed, and no path throws away a refused
  edit without asking.
- `npm --prefix apps/desktop run check` is green.
- V0-29's backlog row is closed with the evidence, and `mvp_plan_order.md`
  § Step 14's progress note is rewritten — the step closes here. V0-42 is Step
  16's and stays open.

## Non-goals

- **No "Reveal in Finder" / "Open in editor" from a write failure.** Both need a
  shell or opener capability the webview deliberately does not have. The path is
  named and selectable instead. If the recovery copy turns out not to be enough
  without it, that is a new row against `capabilities/main.json`, decided on its
  own merits.
- **No "overrode an external edit" annotation.** `states.md:129` says a Keep mine
  save records the override in the activity history. Nothing implements it, in
  the panel or anywhere else — it is a Rust event-writing change, it is not part
  of this row's must-pass, and making Keep mine reachable from the board makes it
  more visible rather than newly broken. **File it as its own backlog row.**
- **No redesign of the global error banner beyond what defect 3 requires.**
- **No new error codes.** ADR 0010's enum is closed and sufficient; this row is
  about what the surfaces do with it.
- No Step 16 polish, and no touching V0-42.

## Outcome

Completed 2026-08-04 on branch `v0-29-write-failure-states`, in six commits, one
per defect plus the gate fixups. **This closes Step 14.**

### What changed

**Rust — `core/error.rs`, `core/storage.rs`, `engine.rs`.** `AppError::io` names
the file and states the cause; the raw `io::Error` moves to `context.systemError`
and the cause is *typed* as `context.cause` — `readOnly`, `noSpace`, `missing`,
or absent — so the frontend offers a recovery for what the error actually says
rather than pattern-matching prose. The save path reports the ticket rather than
the sibling temporary it writes first, which is where the old copy came from:
`.ticket.md.longclaw-9f2e….tmp is read-only` names a file that did not exist a
moment earlier and will not exist a moment later. `conflict_error` drops "Reload
it or keep your version" — those are `TicketPanel`'s buttons, and a conflict
raised on the board has neither. `Engine::commit` fills `ticketKey` and `path`
on any write failure raised too far down to know them, via a new
`with_context_if_absent` that fills gaps and never corrects.

**One conflict vocabulary — `mutations.ts`, `ConflictBanner.tsx`,
`attribution.ts`.** `conflictMessage` is exported and both surfaces use it. It
reads the error's `message` and adds the actor clause, rather than rebuilding the
sentence from `context`: a file *removed* while saving is not a file *changed*,
and a composer working from context alone flattens one into the other. The banner
drops its separate attribution line now that the sentence carries it.

**Defect 5, found while planning — `TicketPanel.tsx`.** A refused write left
`detail` holding the hash Rust had just rejected, because `save()` only reloads
when the write landed. Keep mine re-sent that hash and was refused identically
*unless the watcher's event happened to arrive first*. The panel now re-reads as
part of handling the conflict, in `external` mode so drafts survive, and an
unresolved conflict is no longer replaced by a later observation of the same
divergence — it is holding the edit the write was refused for.

**Defect 4 — `TicketPanel.tsx`.** Both directions share one `takeConflict`, so a
conflict on Undo gets the banner rather than a toast that stated the fact and
offered dismissal.

**Defect 1 — `App.tsx`, `TicketPanel.tsx`.** `App` holds the refused edit until
the panel is up and has read the file, then seeds the ordinary banner. The seed
is gated on `detail`, which is the whole of the ordering: `load("open")` ends by
clearing the conflict, so seeding earlier would seed into a banner about to be
dismissed. The hold is dropped when any ticket is opened or the panel closes.

**Defect 3 — `failure.ts` (new), `App.tsx`, `mutations.ts`, `styles.css`.** One
presentation for both surfaces: a human title, the message, the path in mono and
selectable, the recovery, and only the guarantee the app can make — a save that
failed while restoring what it displaced kept those bytes and says where.
`error.code.replaceAll("_", " ")` is gone from the banner heading.

### Tests, and which were red first

Rust (`core::error::tests`, `core::storage::tests`), all four new:

- `a_permission_failure_names_the_file_and_the_cause_rather_than_the_os_error`,
  `a_full_volume_says_so_and_stays_recoverable`,
  `an_unclassified_io_failure_still_names_the_file_and_keeps_the_detail` —
  red on the missing constructor, then on the assertions.
- `context_already_set_is_not_overwritten_by_a_later_seam`.
- `a_refused_stale_write_states_the_fact_and_names_no_buttons` — **red on
  `assertion failed: !error.message.contains("Reload")`**, the defect itself.
- `a_save_into_a_read_only_folder_names_the_ticket_and_leaves_it_as_it_was` —
  **red on `!error.message.contains(".tmp")`**, likewise.

Frontend:

- `TicketPanel.test.tsx` § "keeps mine against the file it re-read, not the hash
  that was just refused" — **red on the panel never re-reading** (defect 5).
- `TicketPanel.test.tsx` § "takes a conflict on Undo to the banner, like any
  other refused write" — **red: the banner never appeared** (defect 4).
- `App.test.tsx` § "hands the refused edit to the panel, and keeps it against the
  file the panel read" — **red the same way** (defect 1).
- `App.test.tsx` § "does not carry a refused edit onto the next ticket, or back
  after a close".
- `App.test.tsx` § "names the file and the recovery rather than the error code" —
  **red on `expected 'permission deniedSaving ticket failed…' to contain 'That
  file could not be written'`**, confirmed by stashing the wiring with the test
  in place (defect 3).
- `mutations.test.ts` § "tells a write failure what to do about itself, and keeps
  Retry" — **red on the missing recovery sentence**; and § "offers no recovery
  for a failure nothing classified".
- `TicketPanel.test.tsx` § "states the conflict in the same words any other
  surface would" (defect 2).

Two existing tests changed rather than broke: the conflict fixtures in
`mutations.test.ts` and `App.test.tsx` carried Rust's old banner-shaped string,
and now carry what Rust actually sends. § "says a conflict plainly when the error
names no actor and no key" now asserts the composer *keeps* the specific sentence
instead of flattening it, which is the stronger claim.

### Review follow-up, 2026-08-04

A review of the branch found three spec gaps and two smells. All five are fixed
in `2eb8231`; the first is the one that mattered.

**Keep mine could still race its own re-read.** Re-reading on refusal is not
enough on its own: `takeConflict` raised the banner immediately and started the
read behind it, so a press inside that one round trip still sent the hash the
refusal had just proved stale. The banner still goes up at once — an unresolved
conflict is true the moment the write is refused, and hiding it would be worse —
but Keep mine now awaits that read, and `save()` takes its `expectedHash` from
the last **read** rather than the last render, so a save that waited sends what
came back rather than what was on screen when the button was pressed. The held
board conflict starts the same read and is covered by the same await.
Pinned by `TicketPanel.test.tsx` § "waits for the re-read before keeping mine,
rather than racing it" and — after a second review asked for the board path to be
pinned in its own right rather than by shared mechanism — `App.test.tsx` § "waits
for the panel's own read before keeping a held conflict". Both **red on the write
going out immediately**, confirmed by removing the `await` with the tests in
place. The board path is the longer window of the two: the panel raises the
handed-over banner as soon as it has *a* file, and only then goes back for the
current one.

**`sync_directory` named the folder.** The last step of a save reported `LC-1`
where every other step reports `ticket.md`. It now names the ticket and keeps the
folder in `context.directory`. Red on `!message.contains("ticket.md")`.

**`context.cause` was a bare string on both sides of the wire.** It is
behavioral — it decides whether a recovery is offered and which one — so it is
`core::error::IoCause` in Rust and `FailureCause` in `types.ts`, with the set
pinned in `tests/fixtures/ipc-contract.json` § `writeFailureCauses` and asserted
from both languages, exactly as `appliedFieldChanges` pins what an edit can
write. `src/failure.test.ts` also pins the degrade: a cause this build does not
know offers no recovery rather than a guess.

On the TS side the list exists **once**: `FAILURE_CAUSES` is a const tuple,
`FailureCause` is derived from it, and the guard in `failure.ts` derives from it
too, so a cause added in Rust is one line here rather than three that can drift
apart. `failureRecovery`'s exhaustive `Record<FailureCause, string>` then refuses
to compile until the new cause has copy.

**The hand-off was a data clump.** `{ ticketKey, error, edit }` is `HeldConflict`
in `types.ts` now, shared rather than written out in both `App` and `TicketPanel`.

### Validation

- `npm run verify` — green end to end: tokens, format, lint (eslint + clippy),
  typecheck, 526 frontend tests, 196 Rust tests, vite build, and the native
  watcher round trip. Re-run green after the review follow-up.
- `npm --prefix apps/desktop run test:stress` — green.

### What this deliberately did not do

Both non-goals above held. No Tauri capability was widened, so a write failure
names its path and does not offer to reveal it in Finder.

The "overrode an external edit" annotation `states.md:129` describes is filed as
**V0-43**, and the split is worth knowing before anyone ranks it: the clause has
two halves, and *the recoverability half is already true*. `FieldChange` carries
`from` and `to`, so the value the external editor wrote is in the record the save
appends — Keep mine cannot make an overridden value unreadable. What is missing
is only the annotation, so the timeline cannot tell a save that overrode somebody
from an ordinary one. That is copy, not data loss, which is why Step 14 closes
without it.
