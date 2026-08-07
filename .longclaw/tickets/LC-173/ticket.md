---
format: longclaw.ticket/v1
id: 68093908-9bfe-4c6b-b0b7-9a20a2f6bea6
key: LC-173
title: "Docs: link a plan to the ticket it belongs to, with the plan living as an .md file in the repo"
status: todo
priority: p1
labels:
  - format
  - product
  - post-mvp
created_at: 2026-08-07T06:56:54.956Z
updated_at: 2026-08-07T06:56:54.956Z
---

**Post-MVP.** Filed now because it is the shape the repo already works in, not because it goes in v0.

A ticket says what to do; a plan says how, and it is long. Today those plans live wherever someone puts them — this repo has `docs/plans/`, and until 2026-08-07 it had two plan documents that drifted until every line in them had to be re-filed as a ticket. That is the failure this prevents: a plan nobody can reach from the ticket it is about stops being read, and then stops being true.

The constraint is the product's own claim (`screen-specs.md:93-94`, the trust line): a plan is a file you can read, edit, and commit without LongClaw. So the plan is an `.md` file in the repo, not a blob in `ticket.md`, and the ticket holds a **link** to it.

## What this has to decide

- **Where the link lives in the format.** `ticket.md` is authoritative for structured ticket data (`docs/file_format.md`), so a doc link is a new bounded record or a new frontmatter field — either way it is a format change and wants an ADR.
- **Repo-relative, and refusing to leave.** The path is relative to the project root, and resolving it obeys the same rule `Open in editor` already does: the webview names a document, never a path, and `storage::resolve_ticket_path`'s proof is the model (`engine.rs:412-419`).
- **Whether the plan lives inside `.longclaw/` or beside the code.** Beside the code is the point — a plan under `docs/` is reviewed in the same PR as the change — but then the link crosses out of the directory LongClaw owns, and a project folder that is not a repo has nowhere to put it.
- **What a broken link does.** Non-destructive and never silent (`states.md:5-12`): a plan that has moved is said out loud and never rewritten.
- **Reading, not editing.** Rendering a linked plan in the panel is enough; editing it is the editor's job.

## Not in this

Bidirectional sync, a plan that owns tickets, and anything that copies the plan's text into `ticket.md`. One link, one direction, one file on disk.

## Checklist

- [ ] ADR for how a ticket names a document <!-- longclaw:item=ck_cae6c862 -->
- [ ] A ticket links one or more .md plans by repo-relative path <!-- longclaw:item=ck_6fd1220d -->
- [ ] The path cannot resolve outside the project, on the Open-in-editor model <!-- longclaw:item=ck_5fc54554 -->
- [ ] A linked plan renders in the ticket panel <!-- longclaw:item=ck_936af76e -->
- [ ] A plan that has moved is reported, never repaired <!-- longclaw:item=ck_3e6e6bbf -->

## Activity

<!-- longclaw:event
id: evt_126a5994
kind: create
occurred_at: 2026-08-07T06:56:54.956Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
