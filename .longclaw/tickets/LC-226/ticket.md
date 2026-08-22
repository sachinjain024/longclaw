---
format: longclaw.ticket/v1
id: 8c3d0db7-378f-460b-b9be-d7429be83076
key: LC-226
title: A menu is up, and the window's single-key shortcuts still fire under it
status: todo
priority: p3
labels:
  - frontend
created_at: 2026-08-22T06:19:02.188Z
updated_at: 2026-08-22T06:19:02.188Z
---

With any anchored menu open — status, priority, or a ticket's context menu — the
window's own shortcuts still answer keys the menu did not handle.

`App`'s guard is `menuOpen = settingsMenuOpen || projectMenu !== undefined`
(`App.tsx`), which knows about the two settings menus and nothing else. `Menu`
and `MenuList` stop the keys they use — the arrows, `Enter`, `Escape` — and
leave everything else to bubble, so with the status menu standing on a card:

- `c` opens quick create *behind* the menu, and the comment on that branch says
  a menu row is exactly the case it means to skip.
- `⌘K` opens the command palette over it.

Pre-existing for `S`/`P`; LC-222 adds a third menu with the same hole rather
than a new one, which is why it is filed rather than fixed there.

The decision this wants is where the guard lives. Either the menus declare
themselves open to `App` the way settings does — a third and fourth flag, which
does not scale — or `singleKeyShortcutAllowed` learns that focus inside a
`.menu-popover` is not somewhere a single-key shortcut applies, which is one
place and covers every menu the app grows. The second is the shape
`keyContext.ts` already has for text fields.

## Where it shows

- `apps/desktop/src/App.tsx` — the `menuOpen` guard and the `c` branch.
- `apps/desktop/src/keyContext.ts` — `singleKeyShortcutAllowed`.
- `apps/desktop/src/Menu.tsx`, `apps/desktop/src/MenuList.tsx` — what each menu
  stops and what it lets past.

## Activity

<!-- longclaw:event
id: evt_e15bc2d4
kind: create
occurred_at: 2026-08-22T06:19:02.188Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
