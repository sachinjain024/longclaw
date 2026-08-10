---
format: longclaw.ticket/v1
id: 9b37287f-34af-4d81-85b6-785e109a0e2b
key: LC-170
title: "Folder picker: a folder that already holds a project should open it, not walk the create form"
status: done
priority: p2
labels:
  - frontend
created_at: 2026-08-07T06:41:10.439Z
updated_at: 2026-08-10T05:52:55.197Z
---

`screen-specs.md:98-100` gives the picker a branch the app does not have: "Picking a folder that already contains `.longclaw/` opens the project directly (no create form); a plain folder proceeds to the create form." The prototype handles both in one place (`prototype.js:1370-1387`).

Today each button owns one half and neither falls through:

- **Create a project** sets the chosen folder unconditionally (`App.tsx`, `Welcome`), so an already-initialised repo walks the user through name, key and theme and then fails on `This folder already holds a LongClaw project` — after they have answered three questions that were never going to be used.
- **Open a folder** calls `chooseAndRegisterProject`, and `read_project` errors on a plain folder rather than offering to create one there.

Nothing is written either way — `initialize_project` refuses before it creates (`core/storage.rs:1103-1111`) — so this is wasted work and a late refusal, not data loss.

Not filed by `cc_screens_diff.md`: § 2 walked this screen and raised D-10 → D-16 without it, so it is new work rather than a missed row. It needs a way to ask whether a folder holds a project before choosing which screen to show — a small command beside `register_project`, since the answer is a fact about the folder and the frontend has no filesystem capability.

## Source

`docs/design/prototype/screen-specs.md:98-100`, § Welcome / first launch. Surfaced by the code review of LC-76 → LC-82 on 2026-08-07.

## Checklist

- [x] Add a command that reports whether a folder already holds a LongClaw project <!-- longclaw:item=ck_2399bae5 -->
- [x] Create a project: an initialised folder opens directly, skipping the create form <!-- longclaw:item=ck_0f355a65 -->
- [x] Open a folder: a plain folder falls through to the create form rather than erroring <!-- longclaw:item=ck_24926588 -->

## Activity

<!-- longclaw:event
id: evt_9e2983f6
kind: create
occurred_at: 2026-08-07T06:41:10.439Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_c7409273
kind: update
occurred_at: 2026-08-07T06:41:17.038Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: priority
    from: none
    to: p2
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_5b42bdd0
kind: update
occurred_at: 2026-08-10T05:43:42.500Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: in_progress
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_cdcd38b9
kind: update
occurred_at: 2026-08-10T05:52:55.197Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: in_progress
    to: done
  - field: checklist.ck_2399bae5.checked
    from: "false"
    to: "true"
  - field: checklist.ck_0f355a65.checked
    from: "false"
    to: "true"
  - field: checklist.ck_24926588.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Implemented on fix/lc-170-folder-picker-branch.

The picker's branch is now one question asked in one place: `folder_holds_project` over `storage::holds_project`, which is the same predicate `initialize_project` refuses on — the two are wired to the same function so they cannot drift.

Two decisions worth recording:

- **The predicate is `.longclaw/longclaw.yaml`, not `.longclaw/`.** `screen-specs.md:100` says "already contains `.longclaw/`", but taking that literally would call the residue directory of a failed create a project and send the user to `read_project`, which has nothing to read. Pinned by a test.
- **The sidebar's quick create was in scope after all.** It asks name, key and theme *before* the folder, so it met the same refusal this ticket was filed over, three wasted answers and all — just in the other order. Its picker now runs the same branch, so an initialised folder opens there too.

The ticket cited `screen-specs.md:98-100`; the sentence is on 99-101. Cited 99-101 in the source and re-pinned the lock, so the "a plain folder proceeds to the create form" clause is held still too.

Gate: `npm run verify` green (834 frontend tests, 139 Rust unit tests, citation-guard 424 clean). `npm run a11y:audit` green on all five rows — run because the fall-through makes the sidebar form take the caret for the first time.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_931ac16b
kind: comment
occurred_at: 2026-08-10T06:19:44.274Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

PR #9 review follow-up.

Four findings, all addressed:

- **`pickProjectFolder` renamed `pickFolderAndOpenIfProject`.** The old name said only "pick a folder" for a function whose main effect is that a project may be open when it returns.
- **`folder_holds_project` does not canonicalize, and now says why.** ADR 0009 ties canonicalization to *persisting* a root; this persists nothing, answers the same either way (`exists()` resolves symlinks and `..` in the syscall), and has no containment boundary to enforce, because the folder is whichever one the human just chose in the picker. Recorded at the command rather than argued in a PR thread.
- **The predicate divergence is closed at the spec, not in a comment.** `screen-specs.md:99-101` said "already contains `.longclaw/`"; it now names `.longclaw/longclaw.yaml`, which is what ADR 0009 already called the thing Rust validates. Two lines replaced by two, so no cited line below moved; the lock was re-pointed for line 101, the only pin the edit touched.
- **The sidebar stays in scope**, by founder decision: it asks the three questions before the folder, so it met the identical refusal in the other order, and reverting would leave a known instance of the bug this ticket closes.

Gate after the amendment: `npm run verify` green (834 frontend tests, citation-guard 425 clean).
<!-- /longclaw:event -->
