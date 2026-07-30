# Example agent context files

LongClaw generates `.longclaw/AGENTS.md` inside every project it creates. That
file is the editing contract, and it is the only instruction file LongClaw
writes — it never touches a repository-root `AGENTS.md` or `CLAUDE.md`, because
those belong to the repository, not to the tracker.

Some agents will not look inside `.longclaw/` on their own. These examples are
what to add so they do.

| File | Copy it to | Why |
|---|---|---|
| [`AGENTS.md`](AGENTS.md) | your repository root's `AGENTS.md` or `CLAUDE.md` (merge, don't overwrite) | points the agent at the generated contract and the ticket directory |
| [`prompt.md`](prompt.md) | nowhere — paste it into the agent | the task prompt used by the acceptance scenario |

The full manual scenario these support is
[`docs/acceptance/agent-round-trip.md`](../../docs/acceptance/agent-round-trip.md).
