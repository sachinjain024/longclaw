## Agent skills

### Issue tracker

This repository tracks its own work in LongClaw, under `.longclaw/tickets/<KEY>/`.
Every `LC-*` item lives there as a directory, so a ticket named in a prompt is
read straight from disk — `LC-69` is `.longclaw/tickets/LC-69/ticket.md`. Both
backlogs were imported on 2026-08-05 as `LC-1`…`LC-58`; file new work as a ticket
rather than as a Markdown file under `docs/plans/`.

File it with the CLI, which is the one surface allowed to allocate a key — never
by writing a ticket directory by hand, and always with `--agent-id`, because an
activity entry without it says a human did the work:

```sh
cargo build --release --manifest-path apps/desktop/src-tauri/Cargo.toml --bin longclaw
apps/desktop/src-tauri/target/release/longclaw ticket create \
  --title "…" --label frontend --agent-id claude-code --agent-name "Claude Code"
```

See `docs/agents/issue-tracker.md` for the rest of the surface and the editing
rules, and [ADR 0011](docs/adr/0011-cli-is-the-creation-surface-agents-use.md)
for why it exists.

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
npm --prefix apps/desktop run probe:header  # the content header's geometry, mid-write
npm run matrix                              # theme × appearance visual regression
npm run a11y:audit                          # accessibility Part A, keyboard-only, in WebKit
npm run a11y:audit -- --self-test           # the same, expecting every row to go red
npm run audit:network                       # runtime network audit, needs a built app
npm run audit:network -- --self-test        # the same, expecting an injected peer to be caught
```

`audit:network` is the release gate's process-monitor pass. It needs a person to
drive the app — it samples, it does not click — and it needs a **quiet machine**,
because it attributes WebKit helpers by launch window and anything else that
starts a webview during the run lands in its record. Run it on a bundle, offline
and then online, with `--phase` naming which.

**Do not point `lsof` at the app's PID and conclude anything.** On macOS the
webview's traffic belongs to WebKit XPC services that are reparented to launchd,
so the app's own process shows no connections whether or not one was made. That
is the trap the harness exists to avoid, and its controls fail the run rather
than report a silence it cannot back up.

`a11y:audit` is the keyboard contract as a run rather than a memory: it drives the
real `App` over the perf stubs with **no pointer input anywhere in it**, checking
each step against the line of
[`keyboard-focus-map.md`](docs/design/prototype/keyboard-focus-map.md) it
implements. Run it when you touch focus, a key handler, a modal, or a control's
tab position. The `--self-test` inversion breaks the build on purpose and fails if
a row still passes — run that after adding a probe, because two of the first ones
were blind.

`probe:header` is the same idea for a thing no test in `verify` can see: whether
the content header is still **one row** while a write is in flight. jsdom does not
lay out, so a control row that breaks in half and strands a control is green in
`npm test` — LC-149 was found by a person looking at the app. It drives a real
write in WebKit and measures the boxes at every width the window can be, and it
carries the same `--self-test` inversion. Run it when you touch the header, its
controls, or the disk-state indicator; run `a11y:audit` alongside it when a
layout change makes the header wider, because a row that will not break is a row
that can push a control off the side of the window (its A5 row).

**A `<button>` needs an explicit `tabIndex`, and `npm run check` enforces it.**
WebKit follows the macOS *Keyboard navigation* setting, which is off by default,
and with it off Tab skips buttons entirely — which is why plan 07 gave the board
roving focus, and why the ticket panel's controls were pointer-only until Step 17.
Write `tabIndex={0}`, or `tabIndex={-1}` where a roving group owns the stop;
`scripts/tab-order-guard.mjs` fails on an absent one.

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
