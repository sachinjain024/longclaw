---
format: longclaw.ticket/v1
id: 568ef771-5d66-4231-b818-925a24668335
key: LC-241q
title: Can’t edit or delete a comment
status: in_review
priority: none
created_at: 2026-08-30T01:25:03.574Z
updated_at: 2026-08-30T08:19:10.608Z
---

## Activity

<!-- longclaw:event
id: evt_63601925
kind: create
occurred_at: 2026-08-30T01:25:03.574Z
actor:
  type: human
  id: local
-->
### You created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_526f00e2
kind: update
occurred_at: 2026-08-30T07:36:55.461Z
actor:
  type: human
  id: local
changes:
  - field: title
    from: Can’t edit a comment
    to: Can’t edit or delete a comment
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_571c6aa2
kind: update
occurred_at: 2026-08-30T08:19:10.608Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: in_review
-->
### Claude Code updated this ticket

Implemented on `feat/lc-241q-edit-delete-comment`, PR #15.

Your own comment now carries a pencil and a cross under Comments. Rewording rewrites the record in place — same id, same instant, same place in the stream — and stamps `edited_at`, which the entry shows as "edited" beside its age. Deleting takes the record out whole, and ⌘Z puts it back at the instant it was said.

Two decisions were yours before any code, because the ticket carried none: mutate in place rather than append a correction (which amends the append-only rule at `file_format.md:186`), and your own comments only — an agent's is read-only, so the app never offers to put words in an agent's mouth. Rust enforces both, not just the surface that draws the buttons.

Not offered in the CLI, for the reason `restoreChecklistItem` is not: these exist so the app's own gestures can be written and undone.
<!-- /longclaw:event -->
