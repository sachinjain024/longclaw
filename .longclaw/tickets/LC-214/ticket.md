---
format: longclaw.ticket/v1
id: f77e151b-6bf8-45e0-948c-d5e28b24c582
key: LC-214
title: Update LongClaw Project Instructions for LLMs
status: in_progress
priority: urgent
labels:
  - release
type: chore
due: 2026-09-09
created_at: 2026-08-11T14:56:44.953Z
updated_at: 2026-09-10T06:46:00.185Z
---

## Brief

When user initializes LongClaw project in a directory. LongClaw owns that directory. LongClaw tickets live inside that directory and other things but how does LLMs / Agents understand user prompts like create a LC ticket or a LongClaw ticket or just create a ticket or Lets work on {PROJ-{ID} how does Agents understand where to look for PROJ-ID.

Do we need to create skills or just having the Claude.md and Agents.md files in a directory will give enough context to the coding agents. If yes, then we Create Agents.md & Claude.md and we also Create empty Project.md.

Infact, the first ask of this ticket is to find out how to pass the right instructions to LLM on how to work with LC project system, schema of files, etc.

How does CLI work? Would user need to install CLI separately if they have isntalled desktop app? BTW that’s also tracked in LC-233.

Explain Schema
Explain CLI Usage

Define versioning in the relevant files and mention that in the future updates these files can be overwritten So do not update these files.

Can there be a Project.md which contains project specific instructions that users own. We can take this as input in UI as well if required.

Why does CONTEXT.md live outisde the directory?

---

## Plan

When a user makes a folder a LongClaw project, LongClaw generates the files an
LLM agent reads to work there. Today it generates only `.longclaw/AGENTS.md`, a
hand-editing contract that predates the shipped CLI and LC-227's ticket
properties. This ticket updates that generated instruction set so agents drive
the project through the `longclaw` CLI, with direct file editing kept only as a
fallback.

### The brief's questions, answered

- **How does an agent know where to look for a `PROJ-ID`?** The project *is* the
  directory that holds `.longclaw/`. `longclaw.yaml` carries the project `key`,
  and a ticket named `LC-42` is `.longclaw/tickets/LC-42/`. The generated
  AGENTS.md states this project's key and the key→directory mapping explicitly,
  so "work on LC-42" resolves to this project; `longclaw ticket show`/`list`
  discover tickets, and the CLI's `--path` defaults to the working directory.
- **Skills, or do AGENTS.md/CLAUDE.md suffice?** For v0 the generated
  instruction files are enough — they give the agent the schema, the CLI and the
  rules. A packaged skill is a possible later wrapper, not part of this ticket.
- **How does the CLI work / separate install?** The CLI is the primary surface;
  installing it with the desktop app is **LC-233**, not this ticket. This ticket
  assumes it is present and teaches it.
- **Why does `CONTEXT.md` live outside the directory?** Settled on this ticket's
  2026-09-07 comment: the repository's `CONTEXT.md` describes the *codebase* and
  has external consumers (`docs/agents/domain.md`, the `domain-modeling` skill,
  `README.md`), so it stays at the repo root. `.longclaw/` holds what LongClaw
  parses and writes. See "The per-project context file" below for the product
  side.

### Decisions (settled during scope review)

- **CLI-first with a hand-edit fallback.** The generated AGENTS.md teaches the
  `longclaw` CLI as the primary surface and keeps a compact "if the CLI isn't
  available" section carrying the file-format invariants. The file format stays
  the durable contract; the CLI is the recommended path.
- **One home for the vocabulary: AGENTS.md.** LongClaw's own terms, the CLI, the
  status/priority sets, the labels, and — per **LC-227** — the project's enabled
  ticket properties and their vocabularies all reach the agent through AGENTS.md
  and `longclaw help`. No second generated glossary, because two generated files
  describing one vocabulary is the failure mode the 2026-09-07 comment named and
  LC-66 is already the churn bug for.
- **Don't duplicate the CLI's command reference or its enums.** `longclaw help`
  (`cli.rs` USAGE) already prints every command, the `status` set, the
  `priority` set, the `--agent-id` rule and the JSON/stderr contract, compiled
  into the binary so it can never drift. AGENTS.md points at it.
- **PROJECT.md is the user-owned, never-overwritten file.** Shipped empty,
  created only if absent, linked from AGENTS.md. It is the "human-owned section a
  regeneration must never overwrite" the 2026-09-07 comment asked for — the place
  a project states its own vocabulary and conventions if it wants to. Reserved
  for future use; this ticket only creates it and leaves it alone.

### The per-project context file (reconciling the 2026-09-07 comment)

That comment argued LongClaw should own a per-project context/glossary file. This
plan fills that role with **PROJECT.md** rather than a separate generated
`CONTEXT.md`, and resolves the open question the comment left — *whether enabled
properties' vocabularies render into a context file or stay in AGENTS.md* — in
favour of **AGENTS.md**, so there is exactly one generated description of the
vocabulary. PROJECT.md stays human-owned and un-generated; taking it as a UI
input is a later enhancement (out of scope here).

### The generated file set (written at `project init`)

| File | Owner | Regeneration | Purpose |
|---|---|---|---|
| `.longclaw/AGENTS.md` | LongClaw | Reprinted on every project edit | CLI-first contract + enabled properties + fallback + version banner + PROJECT.md link |
| `.longclaw/CLAUDE.md` | LongClaw | Written at init (constant content) | Thin pointer to AGENTS.md |
| `.longclaw/PROJECT.md` | User | Never — created empty only if absent | The user's own instructions and vocabulary (future use) |

### AGENTS.md content (rewrite of `render_agent_contract`)

1. **Banner:** generated file, a version string, and "LongClaw owns and rewrites
   this file — do not edit it; put your own instructions in `PROJECT.md`."
2. **This project:** its `key`, and the key→`.longclaw/tickets/<KEY>-N/` mapping
   so a natural-language "work on <KEY>-42" resolves here.
3. **Canonical files** — keep the existing list.
4. **Primary path — the CLI.** Installed with the app (LC-233). Point at
   `longclaw help` for the full command/enum surface; do not re-type commands or
   the status/priority enums.
5. **Labels and enabled properties, as CLI operations.** A ticket can only carry
   a label slug the project defines; the CLI refuses an undefined one. See them
   with `longclaw project show`, add one with `longclaw label add`. Describe the
   project's **enabled ticket properties** (LC-227 — e.g. `type`, `due`) and
   their vocabularies here, since the property set is per-project.
6. **The rules `longclaw help` does not state:** never hand-create
   `.longclaw/tickets/<KEY>/`; always pass `--agent-id`; activity is
   append-only; `id`/`key` are immutable; never silently overwrite an external
   edit.
7. **Two worked examples** — one `ticket create`, one `ticket edit`, both with
   `--agent-id`.
8. **Fallback — "if the CLI isn't available"** (an agent, editor or script on a
   machine without the app): a compressed form of today's contract — the YAML
   subset, atomic write, checklist and activity markers, the actor shape, and
   `.longclaw/longclaw.yaml` as the source of truth for defined labels, people
   and enabled properties. Status, priority and actor `type` are the fixed sets
   listed inline.
9. **Link to `PROJECT.md`** for the project's own custom instructions.
10. **Worked example ticket** — with fixed ids (see LC-66 below), so the file is
    byte-stable across reprints.

### CLAUDE.md content

A one-line pointer to AGENTS.md (the `@AGENTS.md` include convention Claude Code
already understands), plus the version banner. Content is constant, so a reprint
is a no-op diff.

### PROJECT.md content

Empty, or a bare `# Project instructions` heading. Written only when it does not
already exist, and kept out of the reprint path, so a user's edits survive every
rename, label change and property change.

### Implementation

- Rewrite `render_agent_contract` (`core/project.rs`) to the structure above;
  add a version constant, the enabled-properties section (LC-227) and the
  PROJECT.md link.
- Add a renderer + writer for CLAUDE.md, and an idempotent write-if-absent for
  PROJECT.md. Wire both into `project_initialization_paths`,
  `cleanup_failed_project_initialization` and the init flow
  (`core/storage.rs`); a pre-existing PROJECT.md must never be deleted by
  cleanup.
- Add the file-name constants and path helpers beside `AGENT_CONTRACT_FILE`.
- Confirm every reprint site (`registry.rs` project-edit path, `label_add` and
  the LC-227 property surfaces in `cli.rs`) reprints AGENTS.md and CLAUDE.md but
  never touches PROJECT.md.

### Tests / verification

- A freshly initialized project contains all three files, with PROJECT.md empty.
- Editing a project (theme, label or an enabled property) reprints AGENTS.md and
  CLAUDE.md byte-identically and leaves a user-edited PROJECT.md untouched.
- `npm run verify` passes; the run is quoted on the ticket.

### Dependencies and boundaries

- **Blocked by LC-233.** The CLI-first instructions are only truthful once the
  CLI ships installed with the app. Both are release-labeled and ship together.
- **Builds on LC-227.** The generated AGENTS.md must describe the project's
  enabled ticket properties and their vocabularies, which LC-227 introduced.
- **Distinct from LC-233's own doc item.** LC-233 updates this repository's own
  root `AGENTS.md` and `docs/agents/issue-tracker.md`. This ticket updates the
  generator whose output is a user's `.longclaw/AGENTS.md`. Different files.
- **Folds in LC-66** (fixed example ids). The generator is the same code, and a
  version banner plus reprint-on-edit makes byte-stability matter more, not
  less. This plan adopts fixed ids and the byte-identical-reprint test LC-66
  asks for; close or cross-reference LC-66 when this lands.

### Out of scope

- Bundling and PATH-installing the CLI (LC-233).
- Populating PROJECT.md with any content, and a UI to edit it.
- A packaged agent skill wrapping the CLI flows.
- Actively regenerating an older project's files on open when the version
  differs — a possible later enhancement, not required here.


## Checklist

- [ ] Generated AGENTS.md is CLI-first: it points at longclaw help for the commands and the status/priority enums and does not re-type them <!-- longclaw:item=ck_14d377c7 -->
- [ ] AGENTS.md states this project's key and the key->.longclaw/tickets/<KEY>-N mapping so a natural-language request for <KEY>-42 resolves to this project <!-- longclaw:item=ck_756d4f50 -->
- [ ] AGENTS.md describes labels and the enabled ticket properties (LC-227) as the per-project vocabulary — project show / label add for labels — with no second generated glossary file <!-- longclaw:item=ck_2563bc08 -->
- [ ] AGENTS.md carries the rules longclaw help omits: never hand-create .longclaw/tickets/<KEY>/, always pass --agent-id, activity append-only, id/key immutable, never silently overwrite an external edit <!-- longclaw:item=ck_36a50c8e -->
- [ ] AGENTS.md keeps a compact hand-edit fallback: YAML subset, atomic write, checklist/activity markers, actor shape, and longclaw.yaml as the source of truth for defined labels, people and enabled properties <!-- longclaw:item=ck_b5d4e69b -->
- [ ] AGENTS.md and CLAUDE.md carry a version marker and a do-not-edit/may-be-overwritten banner, and AGENTS.md links PROJECT.md for the user's own instructions <!-- longclaw:item=ck_53541445 -->
- [ ] project init generates .longclaw/CLAUDE.md as a thin pointer to AGENTS.md alongside the reprinted AGENTS.md <!-- longclaw:item=ck_10e46d8e -->
- [ ] project init writes an empty .longclaw/PROJECT.md only when absent, and never reprints it or deletes a pre-existing one on cleanup <!-- longclaw:item=ck_d22b1bf1 -->
- [ ] The worked example ticket uses fixed ids so AGENTS.md is byte-identical across reprints (folds in LC-66), with a test that writes the same project twice and compares <!-- longclaw:item=ck_a5c810e3 -->
- [ ] npm run verify passes and the run is quoted on the ticket <!-- longclaw:item=ck_369e5b20 -->
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
id: evt_169e3754
kind: update
occurred_at: 2026-09-07T13:35:05.500Z
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

<!-- longclaw:event
id: evt_cc57b1cc
kind: update
occurred_at: 2026-09-09T02:22:24.935Z
actor:
  type: human
  id: local
changes:
  - field: type
    to: chore
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_cc2fda9d
kind: update
occurred_at: 2026-09-09T02:23:42.261Z
actor:
  type: human
  id: local
changes:
  - field: due
    to: 2026-09-09
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_eeab8267
kind: update
occurred_at: 2026-09-09T09:43:15.034Z
actor:
  type: human
  id: local
changes:
  - field: description
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_2d9ce741
kind: update
occurred_at: 2026-09-10T06:46:00.185Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: description
  - field: checklist.ck_14d377c7.added
    to: "Generated AGENTS.md is CLI-first: it points at longclaw help for the commands and the status/priority enums and does not re-type them"
  - field: checklist.ck_756d4f50.added
    to: AGENTS.md states this project's key and the key->.longclaw/tickets/<KEY>-N mapping so a natural-language request for <KEY>-42 resolves to this project
  - field: checklist.ck_2563bc08.added
    to: AGENTS.md describes labels and the enabled ticket properties (LC-227) as the per-project vocabulary — project show / label add for labels — with no second generated glossary file
  - field: checklist.ck_36a50c8e.added
    to: "AGENTS.md carries the rules longclaw help omits: never hand-create .longclaw/tickets/<KEY>/, always pass --agent-id, activity append-only, id/key immutable, never silently overwrite an external edit"
  - field: checklist.ck_b5d4e69b.added
    to: "AGENTS.md keeps a compact hand-edit fallback: YAML subset, atomic write, checklist/activity markers, actor shape, and longclaw.yaml as the source of truth for defined labels, people and enabled properties"
  - field: checklist.ck_53541445.added
    to: AGENTS.md and CLAUDE.md carry a version marker and a do-not-edit/may-be-overwritten banner, and AGENTS.md links PROJECT.md for the user's own instructions
  - field: checklist.ck_10e46d8e.added
    to: project init generates .longclaw/CLAUDE.md as a thin pointer to AGENTS.md alongside the reprinted AGENTS.md
  - field: checklist.ck_d22b1bf1.added
    to: project init writes an empty .longclaw/PROJECT.md only when absent, and never reprints it or deletes a pre-existing one on cleanup
  - field: checklist.ck_a5c810e3.added
    to: The worked example ticket uses fixed ids so AGENTS.md is byte-identical across reprints (folds in LC-66), with a test that writes the same project twice and compares
  - field: checklist.ck_369e5b20.added
    to: npm run verify passes and the run is quoted on the ticket
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->
