---
format: longclaw.ticket/v1
id: 4f1fe43f-02da-42d0-bcd7-ddd11930190b
key: LC-206
title: Add Support for adding attachments
status: in_progress
priority: p1
labels:
  - ready-for-agent
due: 2026-10-16
created_at: 2026-08-11T14:38:36.097Z
updated_at: 2026-10-14T12:46:39.388Z
---

Users should be able to add attachments in description and comments: paste, drop or pick a file in the description editor, the comment composer and the create panel; see images and videos inline and other files as chips; list, open, remove and re-attach them from an Attachments section in the panel. Agents get the same operation as `longclaw ticket attach`.

**Spec:** [`docs/specs/LC-206-attachments.md`](../../../docs/specs/LC-206-attachments.md) covers the problem, user stories, implementation and testing decisions, and the two test seams: the core attach operation, shared by the app and the CLI, and the frontend render-and-insert path. It supersedes the "no attachment UI" half of ADR 0005.

**Prototype:** [`docs/ux/prototypes/LC-206-Attachments.html`](../../../docs/ux/prototypes/LC-206-Attachments.html) — ten scenes and a copy deck, up for design and copy review before any of it reaches `src/`. Open it in a browser; the Feedback scene turns review notes into one Markdown block to paste here as a comment.

Removal only unregisters; the bytes stay as a recoverable orphan. Permanent delete or trash is LC-276x.

## Activity

<!-- longclaw:event
id: evt_9f1043c2
kind: create
occurred_at: 2026-08-11T14:38:36.097Z
actor:
  type: human
  id: local
-->
### You created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_c4fa6c27
kind: update
occurred_at: 2026-09-09T02:20:08.073Z
actor:
  type: human
  id: local
changes:
  - field: labels
    from: release
    to: ""
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_59b0ad98
kind: update
occurred_at: 2026-10-13T16:31:56.965Z
actor:
  type: human
  id: local
changes:
  - field: status
    from: todo
    to: in_progress
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_598d1e47
kind: update
occurred_at: 2026-10-13T16:42:49.619Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: labels
    from: ""
    to: ready-for-agent
  - field: description
-->
### Claude Code updated this ticket

Wrote the spec to docs/specs/LC-206-attachments.md and linked it from the description. Filed LC-276x for permanently deleting or trashing removed attachments. Labelled ready-for-agent.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_8ecdde88
kind: update
occurred_at: 2026-10-13T16:47:17.454Z
actor:
  type: human
  id: local
changes:
  - field: priority
    from: p2
    to: p1
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_02b43692
kind: update
occurred_at: 2026-10-13T16:47:27.625Z
actor:
  type: human
  id: local
changes:
  - field: due
    to: 2026-10-16
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_b98fffe1
kind: update
occurred_at: 2026-10-14T12:46:39.388Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: description
-->
### Claude Code updated this ticket

UX prototype for review: docs/ux/prototypes/LC-206-Attachments.html. Ten scenes (in place, attach in the description, attach in a comment, rendering, the section in every state, remove/undo/re-attach, refusals, agent via CLI, while creating, and three placements for the Attach control) plus a 67-row copy deck. The asks that matter most: where the Attach control goes (scene J), whether Cancel after attaching should offer to remove the file (B), the words missing / not attached / unavailable (D, E), and hold-then-attach in the create surfaces (I).
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_723405c8
kind: comment
occurred_at: 2026-10-15T08:01:43.983Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Prototype review 1 (2026-10-15) applied to docs/ux/prototypes/LC-206-Attachments.html: Attachments renamed References (files + docs the description links to), collapsed by default and auto-expanding when a file lands; 5 rows then View all; one ⋮ menu per row; 'Added in a comment' links back to the comment; full-width padded images; transient Attaching/Attached row instead of a toast; no Undo; stale links read Removed or Unavailable; Git LFS warning dropped; CLI prints the link form; ⌘V paste in description, comments and create; Attach control settled as the 7th toolbar button. Kept Remove (not Delete) and Show in Finder (not Open in Finder), pending reply. Open: how doc references are recorded (derived from links vs a registry). Spec changes once settled: References, stories 25 and 28 dropped, paste/source/cap/collapse added.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_b3f18227
kind: comment
occurred_at: 2026-10-15T08:13:36.845Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Prototype review 2 (2026-10-15) applied: specs, prototypes and other docs written for a ticket become recorded references in References (after the files), added with a new 'longclaw ticket reference' verb, not links in the description: a format change, and AGENTS.md's spec-linking rule changes with it. Undo is back on Remove (toast and ⌘Z). 'Attached' stays until the next re-render. Viewer, five-row count and comment-source behaviour settled. Open: how a human adds a doc in the app, and whether a moved doc reads 'missing'.
<!-- /longclaw:event -->
