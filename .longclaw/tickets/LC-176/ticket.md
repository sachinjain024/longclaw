---
format: longclaw.ticket/v1
id: 91b30db0-78d0-425b-82e8-96463e797b2d
key: LC-176
title: D-47 credits LC-113 with a fix that was already on main
status: todo
priority: p3
rank: a2
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-07T14:38:25.000Z
updated_at: 2026-08-08T23:56:19.585Z
---

`docs/cc_screens_diff.md` D-47 reads **Fixed 2026-08-07 (LC-113)**, but the CSS
it credits — `.quick-create-title { border: none; padding: 0; background: none;
font-size: 15px }` — was already on `main` before the
`fix/lc-113-lc-115-quick-create` branch started. `git show
9ea38c2:apps/desktop/src/styles.css` carries it at line 3266.

What the branch actually contributed for D-47 is `quick-create-guard.mjs`, which
pins that CSS in the gate. Worth recording — but it is not the fix, and the note
dates the wrong change.

LC-113 was also flipped to `done` with its checklist ticked and an empty
activity body, where LC-111, LC-112, and LC-175 each carry an account of what
landed. `.longclaw/AGENTS.md` asks an entry for "what you did and what is left".

## Source

A two-axis review (standards + spec) of `fix/lc-113-lc-115-quick-create` against
`main`, 2026-08-07. The sibling finding about `quick-create-guard.mjs` is filed
separately.

## Checklist

- [ ] Correct D-47's note to credit quick-create-guard.mjs rather than a fix that predates the branch, and name the change that actually made the input borderless. <!-- longclaw:item=ck_14605b1a -->
- [ ] Give LC-113's closing activity entry a body saying what landed, as LC-111, LC-112, and LC-175 do. <!-- longclaw:item=ck_33c8ff73 -->

## Activity

<!-- longclaw:event
id: evt_4b431df4
kind: create
occurred_at: 2026-08-07T14:38:25.000Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_69811a8d
kind: update
occurred_at: 2026-08-08T23:56:19.585Z
actor:
  type: human
  id: local
changes:
  - field: rank
    to: a2
-->
### You updated this ticket
<!-- /longclaw:event -->
