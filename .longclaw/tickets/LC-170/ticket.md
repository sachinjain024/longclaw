---
format: longclaw.ticket/v1
id: 9b37287f-34af-4d81-85b6-785e109a0e2b
key: LC-170
title: "Folder picker: a folder that already holds a project should open it, not walk the create form"
status: todo
priority: p2
labels:
  - frontend
created_at: 2026-08-07T06:41:10.439Z
updated_at: 2026-08-07T06:41:17.038Z
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

- [ ] Add a command that reports whether a folder already holds a LongClaw project <!-- longclaw:item=ck_2399bae5 -->
- [ ] Create a project: an initialised folder opens directly, skipping the create form <!-- longclaw:item=ck_0f355a65 -->
- [ ] Open a folder: a plain folder falls through to the create form rather than erroring <!-- longclaw:item=ck_24926588 -->

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
