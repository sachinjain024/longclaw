---
title: "Retry must not re-send a stale hash"
product: LongClaw
status: completed
backlog_id: "—"
order: 23
owner_area: Frontend
release_blocking: false
depends_on: "13 (the mutation seam), 14 and 17 (the board-raised mutations that expose it)"
blocks: "nothing; V0-29 owns the full treatment of write-failure states"
---

# Retry must not re-send a stale hash

A failed write raises a danger toast with a **Retry**. Retry re-sends the
mutation exactly as it was built, `expectedHash` and all. For a **conflict** that
hash is stale *by definition* — a conflict is Rust saying the bytes on disk are
no longer the ones the edit was built from — so Retry re-sends the same stale
hash and fails identically, every time.

A button that can never succeed is a trust defect in a product whose whole pitch
is that failures are visible and non-destructive.

## Why this exists

Introduced by V0-08 ([plan 14](14-priority-end-to-end.md)), which raised the
first mutation outside the panel, and surfaced by V0-11
([plan 17](17-archive-and-unarchive.md)), whose Outcome records it as known and
unfixed: *"This inherits that path's one wart: Retry re-sends the hash captured
when the mutation was built, so retrying a conflict fails the same way."*

`apps/desktop/src/mutations.ts:156` was the line:

```ts
store.raise({
  message: mutation.failure?.(normalized) ?? normalized.message,
  tone: "danger",
  retry: () => void mutate(mutation),
});
```

Every failure code takes that branch, `conflict` included.

The panel is not affected. `TicketPanel`'s `save()` carries a `handles` that
returns true for `conflict`, so the conflict reaches `ConflictBanner` and nothing
reverts and no toast is raised. The exposed mutations are the ones raised in
`App.tsx`, which are raised there precisely because the panel's `save()` cannot
survive its own unmount: `changePriority`, `reorderTicket`, `setArchived`, and
the inverses those build for Undo.

## Working rules

- Topic branch off updated `main`. Never commit to `main`. (`AGENTS.md`)
- One write path. `mutate()` in `src/mutations.ts` — no second toast stack, no
  second conflict UI.
- Colours come only from `var(--lc-*)`.
- Proportionate. This is a defect fix, not a redesign of the error surface.

## Do not fix it by re-reading the hash

The obvious fix — have Retry re-read the file and write against whatever hash it
finds — is the data loss the conflict check exists to prevent. It would silently
overwrite whatever changed the file. Both
[ADR 0010](../../adr/0010-errors-cross-ipc-as-a-closed-tagged-shape.md) and
`docs/mvp_plan_order.md` § Step 14 forbid it: *"The app never silently deletes,
overwrites, or 'repairs' content it cannot safely understand."*

## Do this

Distinguish a conflict from an ordinary failed write **in the failure toast**.

1. **Ordinary failures keep Retry.** Permission denied, disk full, io — nothing
   changed the file, so re-sending the same edit against the same hash is exactly
   right.
2. **A conflict offers no Retry.** It says what happened — the file changed under
   the edit, and by whom when the error's `context` names an actor — and offers
   the honest next action instead.
3. The action is **Open ticket**: mount the panel on that ticket, which reads the
   file and shows the current state, so the human can decide and redo the change
   against what is actually there.
4. Leave the panel's own conflict path byte-identical.

## Done when

- A conflict on a board-raised mutation raises a danger toast with no Retry, a
  message naming the ticket and the actor, and an Open ticket button that opens
  the panel on the live file.
- An ordinary failure still reverts, still says so, and still offers Retry.
- The panel's conflict still reaches `ConflictBanner`, reverts nothing, and
  raises no toast.
- `npm --prefix apps/desktop run check` passes.

## Outcome

Completed 2026-08-01 on branch `wave-1-ticket-domain-and-surfaces`. No Rust
changed. Three files: `src/mutations.ts`, `src/WriteFeedback.tsx`, `src/App.tsx`.

### The defect, verified

Reproduced before anything was changed. `mutate()`'s catch took one branch for
every code, so an archive refused with `conflict` raised a toast carrying
`retry: () => void mutate(mutation)` — the same closure over the same `Mutation`,
whose `write` closes over the `expectedHash` read when the card was still fresh.
Every press re-sends it and gets the same refusal. The App-level test that pins
it failed on exactly that assertion before the fix.

Rust's conflict copy made it worse rather than merely useless. `conflict_error`
(`src-tauri/src/core/storage.rs:838`) says *"This ticket changed on disk while
you were editing. Reload it or keep your version, then save again."* That is the
**banner's** vocabulary, and out on the board there is no banner: the toast was
telling the user to press two buttons that were not on screen, beside a Retry
that was.

### What changed

`mutate()`'s catch now splits on `normalized.code === "conflict"`:

- **not a conflict** — unchanged. `failure` copy or the error's own message,
  `retry` attached.
- **a conflict** — `retry` is `undefined`, the message comes from a new
  `conflictMessage(error)`, and `review` is attached when the mutation supplied
  one. The revert still runs: an unhandled conflict is still a write that did not
  land, so the optimistic state must not stay on screen.

`conflictMessage` reads only what ADR 0010 puts in `context`, and degrades:
`LC-3 changed on disk, last edited by Claude (agent). Your change was not
written.` With no `ticketKey` it says "The file changed on disk"; with no actor
it drops the clause. Nothing is invented.

`Mutation` gains one optional field, `review?: (error: AppError) => void`, and
`Toast` gains `review?: () => void`, rendered by `ToastStack` as **Open ticket**
beside where Retry would be. `App.tsx` passes `review: () => openTicket(key)` on
all four mutations that send an `expectedHash` and on the inverses they build for
Undo. A create sends no hash and cannot conflict; its inverse is an archive and
can, so that one has it too.

`handles` is untouched and still wins: it is checked first, so a surface that
owns conflict resolution never reaches any of this.

### Can a board-raised conflict reach a real resolution path?

**It cannot reach `ConflictBanner`, and this plan does not pretend otherwise.**

The banner is rendered from `TicketPanel`'s own `conflict` state, set in exactly
two places: the panel's `save()` being refused, and an external change landing
while the panel holds an unsaved draft. Nothing in `App.tsx` can set it, and
mounting the panel fresh runs `load("open")`, which clears it.

So **Open ticket** is not Reload / Keep mine, and it is not a second conflict UI.
It is the panel opened on the ticket, reading the file, showing the state that is
actually on disk. That is a real way forward — the human sees what changed, and
if they still want their edit they make it in the panel, where `save()` writes
against the hash the panel just read — but it is a *weaker* offer than the
banner's, and the difference is honest rather than hidden:

- There is **no draft to keep**. The board mutation was reverted the moment the
  write was refused, so there is nothing for a "Keep mine" to re-apply.
- Which is just as well, because "Keep mine" from out here would be the blind
  overwrite § *Do not fix it by re-reading the hash* rules out.

Building the banner's two-way choice for a board mutation would mean holding the
refused edit somewhere it can outlive the surface that raised it, and then
offering to write it over a newer file. That is a design decision with a real
data-loss edge, and it belongs to V0-29, not to a defect fix.

### Tests, and which were red first

All three confirmed failing before the change:

- `mutations.test.ts` § "never offers Retry for a conflict, because the hash it
  would re-send is stale" — asserts `toast.retry` is undefined, the message names
  the key and the actor, `review` fires with the error, and `write` was called
  exactly once. **Red on `expected [Function retry] to be undefined`.**
- `mutations.test.ts` § "says a conflict plainly when the error names no actor
  and no key" — the swap-`NotFound` conflict, which carries only a `path`. No
  Retry, no `review` button invented out of nothing. **Red the same way.**
- `App.test.tsx` § archive "offers no Retry on a conflict, and opens the ticket
  instead" — the board-raised case end to end: the card comes back, there is no
  Retry, the toast names `LC-1` and `Claude (agent)`, and Open ticket mounts the
  panel. **Red on the Retry assertion**, which is the defect itself.

Regression guard, green before and after:
`TicketPanel.test.tsx` § "keeps a conflict on the conflict banner rather than the
failure toast" now also asserts there is no **Open ticket** button and that
`onWrite` was never called — the panel path stays exactly as it was, with the
banner as the offer and nothing reverted or toasted.

### Validation

- `npm --prefix apps/desktop run test:frontend`: 472 passed, 3 of them new.
- `npm --prefix apps/desktop run check`: green (tokens, prettier, eslint, clippy,
  tsc, tests, vite build).
- `npm run verify` was not run, per the instructions for this item.

### Left to V0-29

Deliberately not done here, and annotated on
[V0-29's backlog row](../../backlog/v0-backlog.md):

- **A board-raised conflict still has no two-way resolution.** Open ticket shows
  the file; it does not offer to keep the refused edit. Deciding whether a
  mutation raised outside the panel may hold its edit and re-apply it over a
  newer file — and what that costs — is V0-29's.
- **Rust's conflict message is still banner-shaped.** The frontend now composes
  its own copy for the out-of-panel case rather than showing it, which means the
  same error reads two ways depending on where it landed. Making the typed error
  carry copy that works everywhere is the ADR-0010-shaped fix, and it is V0-29's.
- **`permission_denied` and `io` are still generic.** They keep Retry, which is
  right, but they still say only what Rust said. V0-29 owns naming the file and
  the recovery.
- **The panel's Undo can still raise a bare conflict toast.** The inverse
  mutation `save()` builds carries no `handles` and no `review`, so a conflict on
  Undo inside the panel now states the fact and offers dismissal. That is honest
  and it is better than a dead Retry, but it is less than the banner the panel
  gives its own saves.
