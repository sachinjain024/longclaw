---
format: longclaw.ticket/v1
id: a9f2c292-eb1d-428d-965a-5bbc1b93cc78
key: LC-25
title: Shortcut reference
status: backlog
priority: p2
labels:
  - design
  - v0-backlog
created_at: 2026-08-05T14:23:03Z
updated_at: 2026-08-05T15:14:39.654Z
---

Shortcut reference

## Why it exists

A keyboard-first product that never states its keys is keyboard-first only for the person who wrote it.

## Source

`docs/backlog/v0-backlog.md` — **V0-25**, Wave 2, step 12, owner Design.

## Checklist

- [ ] Every shortcut the app implements appears in the reference, and nothing appears that is not implemented <!-- longclaw:item=ck_a4cafab0 -->

## Activity

<!-- longclaw:event
id: evt_139338fd
kind: create
occurred_at: 2026-08-05T14:23:03Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_273d1743
kind: update
occurred_at: 2026-08-05T15:14:39.654Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: backlog
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_e2a5e1da
kind: comment
occurred_at: 2026-08-11T14:04:41.750Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Left open in a backlog sweep on 2026-08-11, unlike LC-20 through LC-24. Recording why, because the paperwork says this one is closed and the tree does not agree.

Its five siblings all close cleanly: `docs/plans/active/README.md:36` declares Step 12 complete, each names its plan, and each is verifiable in the code. This one is the exception.

`docs/plans/completed/29-shortcut-reference.md` contradicts itself inside its own `## Outcome`. One paragraph says "The two-way shortcut binding test and explicit owner/decision record remain open" and that `components.md:300-301` — "Every shortcut is discoverable in the palette" — is **not** met and not claimed, since `⌘K`, `⌘F`, `⌘Z`, `Enter` and `Esc` appear in no palette row because none of them is a command. A later paragraph in the same section says the reference "is now generated from the declared binding set and its two-way test covers the positive and negative sets", and the README row repeats that.

What is actually there:

- A reference exists as documentation — `components.md:311-324` § Shortcuts (v0 set) — and its ten rows do match what the app binds.
- No declared binding set, no generated surface and no two-way test exist in the tree. There is no shortcuts/bindings module in `src/`, and no guard for it among the eighteen in `apps/desktop/scripts/`.
- `components.md:326-327` still asserts the palette-discoverability claim that plan 29's outcome says is unmet.

So the second half of the must-pass — "nothing appears that is not implemented", enforced rather than promised — is unmet, and the reference is maintained by hand. Note that LC-197, guarding the `components.md` contract in both directions, is open and overlaps this; whoever picks either should read both. Someone with the authority to decide should settle whether this closes or narrows.
<!-- /longclaw:event -->
