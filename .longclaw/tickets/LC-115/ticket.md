---
format: longclaw.ticket/v1
id: 2bfe07c0-35dc-4fc2-bf46-27ed794d32c3
key: LC-115
title: Quick create — status trigger is a bare ○ Todo > with a chevron — A bordered pill ○ Todo, no chevron
status: done
priority: p3
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:01.344Z
updated_at: 2026-08-07T14:24:09.226Z
---

**Prototype.** Status trigger is a bare `○ Todo >` with a chevron

**App.** A bordered pill `○ Todo`, no chevron

## Source

`docs/cc_screens_diff.md` — **D-49**, § Quick create, severity P3.

## Checklist

- [x] Strip the quick-create trigger's border, padding, and background so it reads bare, keeping `MenuButton`'s menu semantics and the D-3B chevron. <!-- longclaw:item=ck_ddd91824 -->

## Activity

<!-- longclaw:event
id: evt_29169f08
kind: create
occurred_at: 2026-08-05T15:16:01.344Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_486c7a4e
kind: update
occurred_at: 2026-08-07T13:47:24.793Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: done
  - field: checklist.ck_ddd91824.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_8b56ccb0
kind: comment
occurred_at: 2026-08-07T14:11:42.359Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Follow-up: D-49's prototype cell and checklist wording conflicted. The implemented choice is the prototype's bare quick-create trigger while retaining MenuButton's shared menu semantics and D-3B chevron; docs/cc_screens_diff.md now says that explicitly and quick-create-guard.mjs pins the scoped CSS.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_7b98e8c3
kind: update
occurred_at: 2026-08-07T14:24:09.226Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_ddd91824.text
    from: "Match the panel's meta-trigger treatment (see D-3B)."
    to: "Strip the quick-create trigger's border, padding, and background so it reads bare, keeping `MenuButton`'s menu semantics and the D-3B chevron."
-->
### Claude Code updated this ticket

Reworded the checklist item to the requirement D-49 actually carries, so the
ticket stops contradicting the code it closed.

The superseded wording — "Match the panel's meta-trigger treatment (see D-3B)."
— read as *make quick create a bordered pill like the ticket panel*, which is
the app behaviour this prototype-diff row exists to remove. D-3B is the chevron
row, not the pill: the panel's `.meta-grid .menu-trigger` adds only
`justify-self: start` over the base pill, while quick create is deliberately
bare. What shipped is `.quick-create-meta .menu-trigger { border: 0; padding: 0;
background: none }` over the shared `MenuButton`, which still renders the
chevron and `aria-haspopup="menu"` — the prototype cell, exactly.

Code, `docs/cc_screens_diff.md` D-49, `quick-create-guard.mjs`, and this
checklist now say the same thing. Nothing left.
<!-- /longclaw:event -->
