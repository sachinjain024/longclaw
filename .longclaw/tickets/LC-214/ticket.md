---
format: longclaw.ticket/v1
id: f77e151b-6bf8-45e0-948c-d5e28b24c582
key: LC-214
title: Update LongClaw Project Instructions for LLMs
status: todo
priority: urgent
labels:
  - release
created_at: 2026-08-11T14:56:44.953Z
updated_at: 2026-08-11T14:56:44.953Z
---

Create Agents.md & Claude.md
Create empty Project.md

Explain Schema
Explain CLI Usage

Explain how we work in LongClaw, Give a space for custom instructions.
Define version in the files and mention that in the future updates these files can be overwritten So do not update these files.

## Activity

<!-- longclaw:event
id: evt_136d3fa3
kind: create
occurred_at: 2026-08-11T14:56:44.953Z
actor:
  type: human
  id: local
-->
### You created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_a44ca542
kind: comment
occurred_at: 2026-09-07T14:24:36.075Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Raised while working LC-227, on 2026-09-07: should the repository's `CONTEXT.md` live inside `.longclaw/` rather than at the root?

For that particular file, no. `.longclaw/` holds what LongClaw parses and writes — `longclaw.yaml`, each `ticket.md`, and the generated `AGENTS.md` — and a hand-written codebase glossary would be the only file in the directory the app neither reads nor writes. It is also about a different subject: `.longclaw/` describes the *work*, `CONTEXT.md` describes the *codebase* for anyone building LongClaw. Its location is a convention with consumers, too — `docs/agents/domain.md`, the vendored `domain-modeling` skill and `README.md` all name the repository root.

The part that belongs to this ticket is the product side. **LongClaw should own a per-project context file**, generated beside the `AGENTS.md`, `CLAUDE.md` and `PROJECT.md` this ticket creates: somewhere a project states its own vocabulary — what its labels mean, what its ticket types are for, the words it wants used and the ones it does not — so an agent reads the project's language before it writes a ticket in it. This repository's root `CONTEXT.md` is the worked example of what that file is for, and LC-227 adds **Property** to it.

It wants the two rules this ticket already sets for the generated files: a version stamped in the file, and a section the human owns that a regeneration must never overwrite. A glossary is exactly the kind of file somebody edits by hand the day after it is generated.

One thing to settle when it is designed: whether the enabled ticket properties and their vocabularies are rendered into it, or stay in the generated `AGENTS.md` where LC-227 puts them. Two generated files describing one vocabulary is the failure mode, and LC-66 is already the open bug about that file churning.
<!-- /longclaw:event -->
