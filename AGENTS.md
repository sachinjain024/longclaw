## Agent skills

### Issue tracker

Issues use LongClaw local Markdown under `.longclaw/tickets/<KEY>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical triage roles map to LongClaw label slugs. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repository. See `docs/agents/domain.md`.

## Pending work

`docs/plans/active/` holds the handoff for work in flight: where the last session
stopped, what to pick up first, and what not to do. Read it before starting
something new. Finished reports move to `docs/plans/completed/` rather than being
deleted.

This directory exists because LongClaw owns ticket-key allocation and this
repository has no `.longclaw/` store yet, so an agent cannot file a ticket for
work it finds. See `docs/agents/issue-tracker.md`.

## Git workflow

Agents must always create a topic branch before making changes.

Before creating the topic branch, agents must:

1. Run `git status --short --branch`.
2. If there are unrelated local changes, preserve them and ask before moving branches if needed.
3. Update local `main` from `origin/main`.
4. Create a new topic branch from the updated `main`.

Agents may commit only on topic branches. Agents must not commit directly to `main`. Agents must not merge into `main` unless the user explicitly asks them to do so.

## Token discipline

- Prefer `rg` and targeted file ranges over broad file dumps.
- Do not inspect generated, cache, build, or dependency directories unless explicitly needed.
- Avoid sub-agents unless the user requests parallel review or the task truly benefits from it.
- Keep command output capped and summarize large results.
- For reviews, inspect the diff first before reading surrounding files.
