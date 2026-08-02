# ARCHIVED PROTOTYPE — Tauri v2 architecture spike

> Archival evidence for Phase 0 Step 4. This directory may remain under `spikes/` on `main`, but it is not production code and must not become the production app.

## Question

Can a small Tauri v2 architecture keep LongClaw project files authoritative while reliably propagating external file edits through Rust and IPC into visible UI state, and propagating in-app edits back through atomic disk writes without watcher loops or duplicate activity?

The answer from this spike is **yes for the exercised direct-distribution macOS path**. M1 human review accepted the v1 file-format contract and M2 human review accepted the architecture on 2026-07-29. Focused real-file compatibility tests protect the v0 contract; a comprehensive canonical conformance-fixture corpus is deferred to the post-MVP product v1.

## Archived dependency manifests

The npm and Cargo manifests in this archived spike are stored with an
`.archived` suffix so GitHub does not treat the spike as a live dependency
surface. The reviewed, directly runnable snapshot is preserved by the annotated
Phase 0 spike tag. To replay the spike from this directory, copy the archived
manifest names back first:

```sh
cp package.json.archived package.json
cp package-lock.json.archived package-lock.json
cp src-tauri/Cargo.toml.archived src-tauri/Cargo.toml
cp src-tauri/Cargo.lock.archived src-tauri/Cargo.lock
```

Do not commit the restored manifest names on `main`; they would re-enable
dependency alerts for this non-shipping evidence.

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
- macOS FSEvents through `notify`, burst coalescing, stable-file checks, exact-hash self-write receipts, removal detection, and frontend focus/visibility reconciliation. A native wake notification remains Phase 1 work.
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

M2 is accepted. Preserve the exact reviewed snapshot with an annotated tag; the directory may also remain on `main` for discoverability. For production promotion:

1. keep this directory under `spikes/` and label it as archived evidence;
2. promote the accepted ADRs and deep `ProjectEngine` interface into the production foundation, while implementing the production parser/write path against the focused compatibility tests instead of copying the spike parser;
3. link the annotated spike tag from the implementation ticket.

See [the review report](../../docs/architecture-spike-report.md), [risk register](../../docs/architecture-spike-risk-register.md), and ADRs 0006–0010.
