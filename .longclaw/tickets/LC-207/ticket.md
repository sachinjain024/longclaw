---
format: longclaw.ticket/v1
id: 2ec163ec-78fe-4470-b4ad-f0e2e49e07ef
key: LC-207
title: Remove Secondary Header that says Generation Folder / .longclaw / tickets
status: in_review
priority: urgent
labels:
  - frontend
created_at: 2026-08-11T14:43:32.131Z
updated_at: 2026-08-11T18:36:01.553Z
---

I really don’t understand the intent of this secondary header. If this is not required, let’s remove this.

## Activity

<!-- longclaw:event
id: evt_61afe763
kind: create
occurred_at: 2026-08-11T14:43:32.131Z
actor:
  type: human
  id: local
-->
### You created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_14897f3b
kind: update
occurred_at: 2026-08-11T18:36:01.553Z
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

The trace strip and its generation stamp are gone, with their CSS and the visible-UI probe's traceText, whose only source was the strip's status line. The board's height reserve is now the same in a dev build and a release one. Ready for a look: run npm run dev and confirm nothing above the board is missed.
<!-- /longclaw:event -->
