# PROTOTYPE — Tauri v2 architecture spike

> Throwaway primary-source code for Phase 0 Step 4. Do not turn this directory into the production app.

## Question

Can a small Tauri v2 architecture keep LongClaw project files authoritative while reliably propagating external file edits through Rust and IPC into visible UI state, and propagating in-app edits back through atomic disk writes without watcher loops or duplicate activity?

The answer from this spike is **yes for the exercised direct-distribution macOS path**. Human M2 acceptance and formal approval of the still-draft v1 file format remain required before production promotion.

## One command

Prerequisites: macOS, Node 22+, npm, Rust 1.93+.

```sh
npm install
npm run spike
```

Choose `fixtures/representative-project` in the native picker. The app makes its state visible after every action: canonical ticket rows, index generation, the latest Rust event sequence/type, typed errors, and ordered stream frames.

Useful verification:

```sh
npm run verify
npm run perf:rust
npm run tauri build -- --no-bundle
```

If a login shell resolves the legacy `/usr/local/bin/node`, activate Node 22 before running npm. The spike declares this in `engines`.

## What is intentionally real

- Tauri v2 native window, capabilities, commands, events, and channels.
- Native folder picker.
- Application-support project registry with atomic persistence.
- Representative v1 Markdown/YAML project files.
- Rust parsing, degraded records, content hashes, conflict rejection, sibling-temp atomic writes, directory sync, and unknown-field preservation.
- macOS FSEvents through `notify`, burst coalescing, stable-file checks, exact-hash self-write receipts, removal detection, and resume/focus reconciliation.
- Disposable index deletion, full rebuild, and search.
- React rendering from a thin Zustand view cache.

## What is intentionally not production

- The parser implements only the fields needed to prove the architecture; Step 3’s full compatibility parser is not present.
- The index is in memory.
- The UI is an evidence console, not the Phase 1 board.
- There is no terminal or PTY. The channel probe establishes only the streaming shape.
- There is no signing, notarization, updater, telemetry, networking, or account state.
- A transparent placeholder icon is generated during the Rust build because Tauri requires an RGBA context icon.

## Capture and promotion

This branch is the primary source for the spike. After human review:

1. record accept/revise in the implementation ticket;
2. keep the spike on this throwaway branch;
3. promote only accepted ADRs and the deep `ProjectEngine` interface into the production foundation;
4. link this branch from the ticket rather than merging the throwaway shell into main.

See [the review report](../../docs/architecture-spike-report.md), [risk register](../../docs/architecture-spike-risk-register.md), and ADRs 0006–0010.
