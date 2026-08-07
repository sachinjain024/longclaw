---
format: longclaw.ticket/v1
id: 42085a6d-fc98-40d7-9f12-63a5dceea228
key: LC-169
title: Conflict banner is built but was never exercised — walk it against states.md:154-182
status: todo
priority: p2
labels:
  - frontend
created_at: 2026-08-07T05:42:13.679Z
updated_at: 2026-08-07T05:42:13.679Z
---

`src/ConflictBanner.tsx` exists and is wired into the panel (`TicketPanel.tsx:21`, `:614`), but the 2026-08-05 prototype comparison never exercised it: reproducing the state needs an external write to land inside an in-app edit window, which that pass could not stage. It is the one designed state in the whole comparison with no verdict recorded.

**Walk it against `states.md:154-182`:** pinned above the title, warn triangle, "Changed on disk while you were editing." with attribution and age, **Reload file** (`warn-border-strong`) and **Keep mine** (`warn-ink` ghost), no focus steal, and a save with an unresolved conflict re-raising the banner.

One known departure to confirm rather than file: `Esc` does not clear the banner, though `keyboard-focus-map.md:82` says it should. LC-12 left it that way deliberately — clearing would take "Keep mine" away from a title draft that is also pending. If that reasoning still holds, the focus map is what should move.

Anything that diverges becomes its own ticket; this one is the walk.

## Source

`docs/cc_screens_diff.md` § 18, which asks for this ticket by name ("File a follow-up ticket to walk it").

## Checklist

- [ ] Stage the conflict: open a ticket, start an edit, and write the file from outside the app inside the edit window. <!-- longclaw:item=ck_f0a1da70 -->
- [ ] Check each clause of states.md:154-182 — placement, copy, attribution and age, the two buttons and their variants, no focus steal, and a save with an unresolved conflict re-raising the banner. <!-- longclaw:item=ck_23a750fd -->
- [ ] File anything that diverges as its own ticket; confirm or move the Esc behaviour rather than leaving keyboard-focus-map.md:82 disagreeing with the code. <!-- longclaw:item=ck_9a377ca2 -->

## Activity

<!-- longclaw:event
id: evt_036e5d80
kind: create
occurred_at: 2026-08-07T05:42:13.679Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
