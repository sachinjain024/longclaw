## Agent skills

### Issue tracker

Issues use LongClaw local Markdown under `.longclaw/tickets/<KEY>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical triage roles map to LongClaw label slugs. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repository. See `docs/agents/domain.md`.

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
