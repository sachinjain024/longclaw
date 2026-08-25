---
format: longclaw.ticket/v1
id: 0812868f-47e0-4270-aa3c-71a36ba59d57
key: LC-232
title: Ticket keys carry a random suffix so two branches cannot mint the same one
status: in_review
priority: none
labels:
  - storage
  - platform
created_at: 2026-08-24T23:31:28.384Z
updated_at: 2026-08-25T00:58:58.118Z
---

Two branches off the same `main` mint the same ticket key. It happened while
filing LC-230 and LC-231 on 2026-08-25: the second ticket was created from a
branch that did not carry the first, and came out as a second `LC-230` — same
key, same directory path, different `id`.

Founder direction: give the key a **random trailing character** — `LC-211p` —
so two people, two branches or two agents landing on the same number still
produce different keys. If a collision survives that, changing the character
and updating the references is a small, mechanical fix rather than a merge
that loses a ticket.

## Why it happens

`prepare_new_ticket_as` (`core/storage.rs:985-999`) takes the highest sequence
among the ticket directories **on disk**, adds one, and claims the key with
`fs::create_dir`. The claim is genuinely atomic — `AlreadyExists` bumps the
sequence and retries, so two CLI processes in one checkout can never collide.

The uniqueness domain is the working tree. The ticket store is a git-tracked
directory, so a branch, a `git worktree`, a second clone or a cloud agent that
does not carry a sibling's ticket sees a lower maximum and re-mints its key.
Nothing in the current design can see the other branch.

At merge the two land on the same path and git raises an add/add conflict — the
loud case. The quiet case is a resolution that takes one side: the other
ticket's description, checklist and activity are gone, and every reference to
the key is now ambiguous about which of the two it meant.

## What a suffix has to touch

- **`next_sequence_of` (`core/storage.rs:1062`) breaks first, and silently.**
  It strips the `LC-` prefix and `parse()`s the rest as a `u64`. `211p` does
  not parse, so a suffixed directory returns `None` and drops out of the
  `max()`. Once every ticket carries a suffix the maximum is 0 and **every new
  ticket is allocated `LC-1`** — where `fs::create_dir` then walks it up one at
  a time through 64 attempts and gives up. Teach it to strip the suffix before
  parsing, and cover it with a test that allocates twice against a store whose
  only tickets are suffixed.
- **`valid_ticket_key` (`core/storage.rs:81-90`)** requires the whole sequence
  to be ASCII digits. It gains the optional trailing character, keeps the
  no-leading-zero rule, and keeps rejecting `lc-42`, `LC-42-1`, `LC-`, `../LC-42`.
- **`belongs_to_project`** splits on `-` and is unaffected, but its tests should
  gain a suffixed case.
- **The CLI** takes keys as arguments — `ticket show LC-42`, `edit`, the
  `--after` targets. They accept both forms.
- **`docs/file_format.md:223`** carries the grammar in prose: "a ticket key is
  `<KEY>-<n>` where `n` carries no leading zero". That file is line-cited and
  pinned by `citation-guard` — replace the sentence in place, re-point what
  cited it, then `citations:update`. Never `--update` to clear a red run.
- **`fixtures/`** holds `project-key-grammar.json`, which Rust and TypeScript
  both test against (`tests/project_key_grammar.rs`, `src/projectKey.test.ts`).
  That fixture is the *project* key and does not change; if the ticket-key
  grammar gets a shared fixture too, it belongs beside it.
- **`AGENTS.md`** and `docs/agents/issue-tracker.md` both write
  `.longclaw/tickets/<KEY>/` and show `LC-69` / `LC-42` examples.
- **The frontend needs nothing.** It carries the key as an opaque string —
  no parsing, no regex, no numeric sort — so the suffix costs it only its
  fixtures.

## Three constraints on the character itself

- **macOS is case-insensitive.** `fs::create_dir` is the claim, and on this
  filesystem `LC-211p` and `LC-211P` are the *same directory* — a
  mixed-case alphabet would make two distinct keys collide on the one platform
  the app ships on. Pick one case.
- **One character out of 26 collides about 4% of the time**, and it collides in
  exactly the situation it exists for: two branches both take max+1, so they
  agree on the number and differ only in the letter. Two characters put that at
  1-in-1296. The founder asked for one; the number is recorded here so the
  choice is made with it in view, and the fallback path below is what carries
  the remainder either way.
- **Drop the confusable letters.** `l` next to `1` and `o` next to `0` in a key
  people read aloud, type into `ticket show`, and copy into commit messages.

## Do not renumber what exists

`LC-1` … `LC-231` stay exactly as they are. The grammar accepts both forms; the
suffix applies to keys minted from here on. Renaming 231 directories would
break several hundred references across the design docs, source comments,
completed plans and commit history, and `file_format.md:347` already holds that
a key is never reused.

## The fallback, when a collision still happens

Changing the character by hand contradicts the editing rule that a ticket's
`key` and directory path are immutable, so it needs a command:
`longclaw ticket renumber <KEY> --id <uuid>` re-keys one of the two, moves the
directory, rewrites the `key` field, appends an activity entry naming what it
was, and reports every path in the repo that still mentions the old key so the
references can follow. It refuses a key that is already taken.

A guard is the other half: `verify` should fail when two ticket directories
claim the same `key`, or when a `key` field disagrees with its directory name.
The add/add conflict catches the common case; the guard catches the resolution
that quietly kept one side.

## Checklist

- [x] The alphabet and length are decided and written into file_format.md: one case only because macOS folds LC-211p and LC-211P onto one directory, confusable letters dropped, and the collision odds of the chosen length stated <!-- longclaw:item=ck_9418c4d4 -->
- [x] valid_ticket_key accepts an optional trailing suffix and still rejects lc-42, LC-42-1, LC-, LC-0 and ../LC-42; belongs_to_project gains a suffixed case <!-- longclaw:item=ck_15ffa4d3 -->
- [x] next_sequence_of strips the suffix before parsing, with a test that allocates twice against a store whose only tickets are suffixed — the untaught version drops every suffixed directory from max() and hands out LC-1 <!-- longclaw:item=ck_f19874ae -->
- [x] Newly minted keys carry the suffix; LC-1 through LC-231 are left untouched and both forms parse everywhere <!-- longclaw:item=ck_54b4cc02 -->
- [x] The CLI takes both forms as arguments — ticket show, edit, --after — and its output and errors quote keys whole <!-- longclaw:item=ck_58284d47 -->
- [x] longclaw ticket renumber <KEY> --id <uuid> re-keys one of a colliding pair: moves the directory, rewrites the key field, appends an activity entry naming the old key, refuses a key already taken, and reports every path in the repo still mentioning the old one <!-- longclaw:item=ck_14e7fb20 -->
- [x] A guard in verify fails when two ticket directories claim the same key, or when a key field disagrees with its directory name <!-- longclaw:item=ck_6de97504 -->
- [x] file_format.md:223's grammar sentence is replaced in place, AGENTS.md and docs/agents/issue-tracker.md show the new shape, and npm run citations:check is green after re-pinning <!-- longclaw:item=ck_3c38883e -->
- [x] npm run verify passes, including cargo tests for the allocator against a suffixed store <!-- longclaw:item=ck_e589a0ad -->

## Activity

<!-- longclaw:event
id: evt_4ed5786a
kind: create
occurred_at: 2026-08-24T23:31:28.384Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_253a8db9
kind: update
occurred_at: 2026-08-25T00:58:58.118Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: in_review
  - field: checklist.ck_9418c4d4.checked
    from: "false"
    to: "true"
  - field: checklist.ck_15ffa4d3.checked
    from: "false"
    to: "true"
  - field: checklist.ck_f19874ae.checked
    from: "false"
    to: "true"
  - field: checklist.ck_54b4cc02.checked
    from: "false"
    to: "true"
  - field: checklist.ck_58284d47.checked
    from: "false"
    to: "true"
  - field: checklist.ck_14e7fb20.checked
    from: "false"
    to: "true"
  - field: checklist.ck_6de97504.checked
    from: "false"
    to: "true"
  - field: checklist.ck_3c38883e.checked
    from: "false"
    to: "true"
  - field: checklist.ck_e589a0ad.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Implemented on feat/lc-232-ticket-key-suffix. The alphabet is the 24 lowercase letters minus l and o, written into file_format.md:223 in place. valid_ticket_key takes an optional trailing character and next_sequence_of strips it; LC-1..LC-233 keep their keys and both forms are accepted everywhere, including the palette and the index's key order. longclaw ticket renumber re-keys one of a pair, and ticket-keys:check is in verify with a --self-test.

Three things this turned up that the ticket did not anticipate. The frontend was said to need nothing; it parsed keys in two places, and both were broken by the suffix. The index's key comparator became intransitive once a key stopped parsing as a u64, which sort_by may answer with a panic. And putting the letter in the claimed directory name quietly cost the property the ticket records as true — that two CLI processes in one checkout can never collide — so the number is now claimed under its bare name and the letter arrives by renaming the claim.

npm run verify passes, including the native watcher.
<!-- /longclaw:event -->
