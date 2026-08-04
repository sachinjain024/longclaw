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

## Toolchain and the gate

The shims are not all on `PATH`. Export this before any Rust work:

```sh
export PATH="/opt/homebrew/opt/rustup/bin:$PATH"   # rustup is Homebrew's

node -v   # v26.5.0 (Homebrew). An old /usr/local/bin/node v10 is still present.
cargo -V  # 1.97.1; stable is the default toolchain
```

Two traps: Homebrew runs under Rosetta on this Mac, so installs need
`arch -arm64 brew install …`, and `apps/desktop/node_modules` may be missing — run
`npm --prefix apps/desktop ci` first.

```sh
npm run verify   # tokens, archived-spike scope, release audit, format, lint,
                 # typecheck, tests, vite build, native watcher
npm run dev      # launch the app
npm --prefix apps/desktop run test:rust     # cargo test alone
npm --prefix apps/desktop run test:frontend # vitest alone
npm --prefix apps/desktop run test:watcher  # the native watcher round trip alone
npm --prefix apps/desktop run perf:rust     # performance budgets, ignored by default
npm --prefix apps/desktop run perf:startup  # startup budgets, needs a built app
npm run perf:board                          # board interaction budgets in WebKit
npm run perf:list                           # the same, for the list surface
```

`npm run verify` must pass before you commit. CI additionally runs
`npm run build:app` (the full macOS bundle), which the local gate skips.

The interaction budgets are **enforced locally and nowhere else.** They are not in
`verify` — each trace is minutes of WebKit over 5,000 tickets, the wrong price for
a pre-commit gate — and a CI job that ran them was removed on 2026-08-01, the first
time it ever ran on a runner: a shared macOS runner is roughly 6x slower than a
developer Mac and misses the ≤50ms p95 budget even at the harness's 600-ticket
floor size. Raising the number to fit the runner would have been greening the gate.
So **run `perf:board` and `perf:list` yourself when you touch a lane, a row, a
comparator, or a selector**, and quote the numbers — nothing else will catch it.
V0-42 is the open item for a gate that works on a runner.

**If `verify` goes red on the native watcher, suspect the environment before the
code.** An npm-launched `test:watcher` once timed out while the identical direct
Cargo command passed, and it closed as *not reproducing* without a fix or an
explanation — read
[plan 10's outcome](docs/plans/completed/10-npm-native-watcher-timeout.md) before
touching the watcher, since two obvious workarounds are already recorded as
failures. The rule that must survive: `test:watcher` stays on the native adapter.
Greening the gate with the polling adapter would leave the production watcher
uncovered.

## Token discipline

- Prefer `rg` and targeted file ranges over broad file dumps.
- Do not inspect generated, cache, build, or dependency directories unless explicitly needed.
- Avoid sub-agents unless the user requests parallel review or the task truly benefits from it.
- Keep command output capped and summarize large results.
- For reviews, inspect the diff first before reading surrounding files.
