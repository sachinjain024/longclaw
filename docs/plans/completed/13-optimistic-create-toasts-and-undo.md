---
title: "Optimistic create, per-mutation write feedback, and undo"
product: LongClaw
status: completed
completed: 2026-07-31
backlog_id: V0-17
order: 13
owner_area: Frontend
release_blocking: true
depends_on: none
---

# Optimistic create, per-mutation write feedback, and undo

Creating a ticket blocks on the disk write, and nothing in the app can be taken
back. Both are trust surfaces: a modal that sits there while `create_ticket`
round-trips reads as a hang, and a tracker with no undo makes every click feel
irreversible on files the user cares about.

There is one optimistic path in the whole app — checklist ticks in
`TicketPanel.tsx` — and one ad-hoc write indicator beside it, a 1.6s flash on
the panel's disk-path line. There is no toast primitive and no undo of any kind.

This item goes first in Wave 1 because eight frontend items follow it and every
one of them raises a mutation: priority, archive/unarchive, full create, and the
board's own status changes all need the same toast, the same undo, and the same
honest disk indicator. So the deliverable is a seam, not a call site.

## Why this exists

[V0-17](../../backlog/v0-backlog.md) and the approved prototype specs:

- `states.md:56-58` — optimistic UI first; a spinner may appear only after 500ms
  of an unsettled write, and only on the disk-state indicator.
- `screen-specs.md:50-53` — the indicator itself: 9px spinner +
  `writing ticket.md…` in flight, `✓ ticket.md` settled. "This is the honest
  surface of optimistic UI."
- `states.md:62-63` — status, priority, archive/unarchive, create, and check
  also raise a toast with **Undo ⌘Z** (5s, bottom-center, single stack).
- `components.md:213-215` — toast anatomy.
- `screen-specs.md:204-207` — create is optimistic and never blocks on the write.
- `keyboard-focus-map.md:30` — global `⌘Z`, paired with the toast.
- `data-requirements.md:121` — undo scope is the inverse of the last mutation,
  session-scoped. Not a history stack.

## Working rules

- Topic branch off updated `main`. Never commit to `main`. (`AGENTS.md`)
- Colors come only from `var(--lc-*)`. There are zero hardcoded colors in
  `styles.css` and it stays that way.
- `npm --prefix apps/desktop run check` is the gate for this item.
  `npm run verify` runs the native watcher and is the founder's to run.

## Do this

Build one seam every mutation runs through, then move the two existing call
sites onto it.

1. **`src/mutations.ts`** — `mutate(mutation)`, plus a small session store for
   the toast and the write marks. A `Mutation` carries `apply` (which returns
   its own inverse), `write`, `onWritten`, `toast`, `undo`, `handles`, and
   `failure`. `undo` returns another `Mutation`, so the inverse gets the same
   write feedback and there is no second write path.
2. **`src/WriteFeedback.tsx`** — `WriteIndicator` and `ToastStack`. They own the
   500ms spinner delay and the 5s dismissal as component timers, so both are
   cleaned up on unmount and drivable with fake clocks. `⌘Z` lives with the
   toast, because that is what it is paired with.
3. **Create** becomes optimistic in `App.tsx`: a provisional row under a key
   guessed from the board, modal closed, focus on the card, real key adopted
   when the write lands.
4. **The panel** routes `save` through `mutate`, and its ad-hoc disk flash is
   replaced by the real indicator. The conflict path must survive untouched.

## Two decisions taken before the work started

1. **A failed write reverts.** `states.md:64-67` says the optimistic value
   "stays visible and marked unsaved". V0-17's must-pass says a failed write
   "reverts the optimistic state and says so". The must-pass is the gate.
2. **Undo of a create archives.** v0 has no ticket deletion
   ([ADR 0004](../../adr/0004-archive-in-v0.md), and the backlog's deferred
   register), so the inverse of a create cannot be a delete.

## Done when

- A tick appears before the write returns.
- A failed write reverts the optimistic state and says so.
- Undo restores the previous file content through the ordinary write path.
- `npm --prefix apps/desktop run check` is green.

## Outcome

Shipped as two new modules and four edited ones.

**The seam.** `apps/desktop/src/mutations.ts` holds `mutate(mutation)` and a
session store (`useMutationStore`) for the toast and the two write marks.
`apps/desktop/src/WriteFeedback.tsx` holds `WriteIndicator` and `ToastStack`.
Later surfaces need nothing else: a mutation with a `toast` and an `undo` gets
the whole behaviour, and one without them gets the disk indicator only.

Three things about its shape are deliberate:

- **`apply` returns its own inverse.** The optimistic revert is written next to
  the optimistic apply, which is the only place it can be got right.
- **`undo` returns a `Mutation`.** Taking a change back is an ordinary write, so
  it gets the same indicator, the same failure handling, and its own toast for
  free. Undo mutations carry no `undo`, which is how the "inverse of the last
  mutation, not a stack" scope from `data-requirements.md:121` is enforced by
  the type rather than by a rule someone has to remember.
- **`handles` exists so a conflict is not a failure.** The panel returns true
  for `code === "conflict"` and raises the ConflictBanner itself; nothing is
  reverted and no danger toast appears. Preserving that path was the main risk
  in this item and it is now pinned by a test.

**A second Zustand store.** `useLongClawStore` documents itself as a cache of
what is on disk (ADR 0006). Toasts and in-flight write marks are session UI that
never survives a reload and must never look like a fact about a file, so they
live in their own store. `resetMutations()` is the test hook, called in
`beforeEach` the same way `useLongClawStore.setState` already is.

**Create.** `submitNewTicket` no longer awaits. It inserts a provisional row
under a key guessed by `provisionalTicketKey` (highest numeric suffix on the
board, plus one), closes the modal, moves focus to the card, and swaps in
whatever key Rust actually allocated when the write lands. `QuickCreate` lost
its `submitting` prop — the modal has nothing left to wait for.

**The panel.** `save(edit, options)` now takes an optional `SaveFeedback`
(`apply` / `toast` / `inverse` / `inverseToast`), which is the handle the
following items should reach for. Status and check use it; priority, archive,
and unarchive are the same three lines. `DISK_FLASH_MS` and the `diskFlash`
state are gone — the panel header renders `<WriteIndicator idle={relativePath}
/>`, so there is one write-feedback mechanism in the app instead of two.

### What was not in the plan

- **Undo of a create is a real gap between the spec and the ADRs, and it is
  worth the founder's attention.** `screen-specs.md:204-207` says the create
  toast offers Undo. ADR 0004 and the deferred register both close the door on
  deletion. So Undo on a create archives the ticket, and the toast says
  `LC-7 archived — v0 never deletes a ticket file` rather than implying the
  ticket vanished. Two consequences: the card **stays on the board** after
  undoing a create, because archived tickets are not filtered out until V0-11;
  and undoing a create leaves an archived ticket behind that the user has to
  find and deal with. Either the spec should stop promising Undo on create, or
  v0 needs a narrow "discard a ticket you just made" operation. This
  implementation is honest about what it did, but it is not what the screen spec
  describes.
- **The divergence from `states.md:64-67` is now real and should be reconciled.**
  The doc says a failed write keeps the optimistic value visible and marked
  unsaved. The code reverts and raises a danger toast with Retry, because that
  is what V0-17's must-pass asks for. `states.md` should be updated to match, or
  the must-pass revisited.
- **The danger toast does not auto-dismiss.** `components.md:213-215` gives
  toasts a 5s life. A danger toast reports state that was taken back under the
  user and carries the only Retry, so expiring it would lose both. It stays
  until dismissed or retried. Default toasts keep the 5s.
- **The spinner and the text are now separate.** The old panel flash showed
  `⟳ writing …` immediately. `states.md:56-58` allows a spinner only after 500ms,
  so the text appears at once and the spinner joins it later. The existing
  "says it is writing, then that it wrote" test was updated to stop asserting
  the glyph.
- **A conflict now reverts the optimistic tick.** The old `save` cleared
  `pendingChecks` when a conflict *blocked* a save but not when Rust *returned*
  one, so a tick could sit visibly checked under a conflict banner. Both paths
  now revert. The banner is unchanged and Keep-mine still re-applies the pending
  edit.
- **`⌘Z` yields to fields.** The keymap says "Global (any context, no input
  focused)". The listener ignores the key when the event target is inside an
  input, textarea, select, or contenteditable, so the comment box keeps its own
  undo.
- **No new design tokens were needed.** `inverse-surface`, `inverse-ink`,
  `inverse-ink-2`, `danger*`, `ink-disabled`, and `shadow-overlay` were all
  already generated.

### Validation

- `npm --prefix apps/desktop run check` — green (tokens, format, lint + clippy,
  typecheck, 139 frontend tests, Rust tests, vite build).
- Confirmed red before the implementation: the three App create tests
  (`must-pass 1`, `must-pass 2`, and the create-undo test) and five of the six
  new panel tests. The sixth — that a conflict stays on the banner — passed
  against the old code, which is the point: it is a regression guard for the
  path this item was most likely to break.
