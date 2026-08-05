---
format: longclaw.ticket/v1
id: 460a3809-eac7-49ed-bf09-452418b1e844
key: LC-26
title: Unsupported and newer schema versions as a first-class read-only state
status: done
priority: p3
labels:
  - frontend
  - v0-backlog
created_at: 2026-08-05T14:23:03Z
updated_at: 2026-08-05T14:23:04Z
---

~~Unsupported and newer schema versions as a first-class read-only state~~ **Done 2026-08-01** — newer-version degraded tickets remain visible on the board and list as `newer format` / `Newer format`, and the ticket panel now says `Newer format, shown read-only`, shows the raw file and diagnostic, and states that this build will not rewrite it. Ordinary parse failures still say `Shown without repair` and point the user back to an editor/watcher reload. [Plan 36](../../../docs/plans/completed/36-newer-version-read-only.md)

## Must-pass

Passed: board, list, and panel regression tests pin the first-class read-only state; the panel test proves there is no title, archive, status, or edit control and the write path is not called. Storage and watcher behavior were unchanged because the parser/write path already refused unsupported versions safely

## Source

`docs/backlog/v0-backlog.md` — **V0-26**, Wave 3, step 14, owner Frontend.

## Checklist

- [x] Passed: board, list, and panel regression tests pin the first-class read-only state; the panel test proves there is no title, archive, status, or edit control and the write path is not called. Storage and watcher behavior were unchanged because the parser/write path already refused unsupported… <!-- longclaw:item=ck_6983ef9b -->

## Activity

<!-- longclaw:event
id: evt_d99260c5
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
id: evt_355009c3
kind: update
occurred_at: 2026-08-05T14:23:04Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_6983ef9b.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Imported from `docs/backlog/v0-backlog.md`. The must-pass verification for V0-26 is recorded there as passed.
<!-- /longclaw:event -->
