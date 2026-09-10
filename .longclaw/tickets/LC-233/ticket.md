---
format: longclaw.ticket/v1
id: 4438c039-2753-4c63-8500-8af0ea2ed05f
key: LC-233
title: Installing the app installs the longclaw CLI
status: in_progress
priority: urgent
labels:
  - platform
  - release
created_at: 2026-08-24T23:40:32.472Z
updated_at: 2026-09-10T10:47:21.963Z
---

Installing the desktop app should be all it takes to get the `longclaw` command.
Today the CLI exists only as a second `[[bin]]` in the desktop crate
(`Cargo.toml:24-26`) that a person builds from source with cargo — which is what
`AGENTS.md` tells every agent to do, and it is a toolchain, a checkout and a
30-second build away from a user who only downloaded a `.dmg`.

Two halves:

1. **The binary ships inside the signed bundle**, built and sealed with the app,
   so it is always exactly the app's own build and the two can never disagree
   about the file format.
2. **One click puts it on `PATH`** — offered on first launch and available again
   from settings, VS Code's "Install 'code' command in PATH". Not silent: the
   symlink lands outside the folder the user picked, and the v0 promise that the
   app touches nothing outside it is worth more than the two seconds the prompt
   costs. Target `/usr/local/bin`, which is on `PATH` on every Mac by default.

## The constraint that shapes the whole thing

**`release-audit.mjs:254` fails the build on `Command::new(` anywhere under
`src-tauri/src`.** No shelling out — so `osascript -e 'do shell script … with
administrator privileges'`, the usual way an app gets an auth prompt, is not
available.

There is already a precedent for reaching the OS without a subprocess, and it
was written for this exact reason: `platform/macos.rs` opens a ticket in the
user's editor through `NSWorkspace`/LaunchServices, and its doc comment says why
— "the release boundary forbids a shell or process-launch plugin and the audit
fails the build on `Command::new`". Follow it.

Which makes the install a plain `std::os::unix::fs::symlink`, and the design
question **what happens when it returns `EACCES`**:

- On most developer Macs `/usr/local/bin` is admin-writable — Homebrew chowned
  it for years — so the symlink simply succeeds and there is no prompt at all.
- On a clean Apple Silicon machine `/usr/local/bin` may **not exist**, and
  creating it needs root.
- When the write is refused, the app cannot escalate without either a
  `Command::new` exemption or an `SMAppService` privileged helper. Neither is
  worth it here. Say what happened and offer the exact `sudo ln -s …` line to
  copy, with the path already filled in.

Decide the escalation question only if the plain symlink proves insufficient in
practice; do not build a helper on speculation.

## Getting the binary into the bundle

- `tauri build` builds `default-run = "longclaw-desktop"` only
  (`Cargo.toml:12`). The CLI has to be built and handed to the bundler —
  `bundle.externalBin` is the mechanism, and it expects a target-triple-suffixed
  file on disk before the bundle step.
- **It must land in `Contents/MacOS/`, not `Contents/Resources/`.** A Mach-O
  under `Resources` is the classic notarization rejection; `externalBin` places
  sidecars in `MacOS/` for this reason.
- Architecture has to match the app's, and a universal build needs a universal
  CLI. Whatever `build:app` produces, the CLI is produced the same way.
- **`binary-audit.mjs` should inspect it too.** It reads the built binary's
  symbols and linked frameworks to back the no-network claim; that claim covers
  the CLI, which is a separate process the audit currently never looks at.
  `codesign --verify --deep --strict` will start covering it automatically —
  which is a second reason the placement has to be right.
- `release-audit.mjs` reads the **host cargo tree**, and the CLI is in the same
  crate, so the dependency half needs nothing new.

## The capability file does not change

A new Tauri command is app-defined, and app commands run under `core:default` —
the permission list `release-audit.mjs` pins exactly stays as it is. But the
capability's own description says the webview has "no frontend filesystem,
shell, network, or process capability", and this adds a command that writes a
symlink outside the project. The webview still names no path — it asks, Rust
decides — which is the same shape as `open_ticket_file`. Say so in the
description rather than leaving it to be read as a contradiction.

## What agents get

`AGENTS.md` and `docs/agents/issue-tracker.md` both open with a `cargo build`
line. Once the CLI ships, an agent on a machine with the app installed can use
`longclaw` directly. Update the instruction to prefer it and keep the build as
the fallback — with the caveat stated: an installed CLI is the *app's* version,
and a checkout whose format has moved ahead of the installed app should be
driven by the freshly built binary, not the one on `PATH`.

## Later platforms

v0 is macOS only. Windows and Linux both make this easier rather than harder —
an NSIS/MSI installer can amend `PATH` at install time and a `.deb` can drop a
binary in `/usr/bin`, so on both the install is genuinely automatic and the
one-click step is a macOS-shaped answer to a macOS-shaped problem. The half that
carries over is the binary riding inside the package. Keep the install action
behind the same `platform/` seam `macos.rs` already establishes, so the shared
code does not assume a symlink.

## Checklist

- [x] The longclaw binary is built alongside the app and bundled via externalBin into Contents/MacOS/, matching the app's architecture; a Mach-O under Contents/Resources/ is the notarization trap to avoid <!-- longclaw:item=ck_4f1ae7bf -->
- [x] codesign --verify --deep --strict passes on the bundle with the CLI inside it, and binary-audit.mjs inspects the CLI's symbols and linked frameworks the way it does the app's — the no-network claim covers both processes <!-- longclaw:item=ck_00d67bc8 -->
- [x] A Tauri command symlinks the bundled binary to /usr/local/bin/longclaw with std::os::unix::fs::symlink and no subprocess anywhere — release-audit.mjs:254 fails the build on Command::new, and platform/macos.rs is the precedent for reaching the OS without one <!-- longclaw:item=ck_df85c6d3 -->
- [x] A refused write is handled in words, not silence: the directory missing or not writable produces the exact sudo ln -s line with the path filled in, and no privileged helper is built on speculation <!-- longclaw:item=ck_570d6dc9 -->
- [x] The app offers the install on first launch and from settings, reports when the command is already linked and pointing at this bundle, and re-links a stale symlink from a previous install location <!-- longclaw:item=ck_9491f7cf -->
- [x] The capability description is amended to say the install command writes a symlink outside the project the same way open_ticket_file reaches the editor, and release-audit.mjs's pinned permission list is unchanged <!-- longclaw:item=ck_e2a056c4 -->
- [x] AGENTS.md and docs/agents/issue-tracker.md prefer the installed longclaw and keep the cargo build as the fallback, stating that a checkout ahead of the installed app must use the freshly built binary <!-- longclaw:item=ck_763f9051 -->
- [x] The install action sits behind the platform/ seam macos.rs establishes, so the Windows and Linux packages can install the CLI their own way without the shared code assuming a symlink <!-- longclaw:item=ck_294c4b21 -->
- [x] The release notes document the command, and npm run verify plus a built-bundle release:binary-audit both pass with the run quoted <!-- longclaw:item=ck_edb121bf -->

## Activity

<!-- longclaw:event
id: evt_46e7e078
kind: create
occurred_at: 2026-08-24T23:40:32.472Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_ccea5975
kind: update
occurred_at: 2026-09-10T06:26:42.029Z
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
id: evt_97e4a2f3
kind: update
occurred_at: 2026-09-10T06:27:14.805Z
actor:
  type: human
  id: local
changes:
  - field: priority
    from: none
    to: urgent
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_d7295ade
kind: update
occurred_at: 2026-09-10T10:47:21.963Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_4f1ae7bf.checked
    from: "false"
    to: "true"
  - field: checklist.ck_00d67bc8.checked
    from: "false"
    to: "true"
  - field: checklist.ck_df85c6d3.checked
    from: "false"
    to: "true"
  - field: checklist.ck_570d6dc9.checked
    from: "false"
    to: "true"
  - field: checklist.ck_9491f7cf.checked
    from: "false"
    to: "true"
  - field: checklist.ck_e2a056c4.checked
    from: "false"
    to: "true"
  - field: checklist.ck_763f9051.checked
    from: "false"
    to: "true"
  - field: checklist.ck_294c4b21.checked
    from: "false"
    to: "true"
  - field: checklist.ck_edb121bf.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_3837a4eb
kind: comment
occurred_at: 2026-09-10T10:47:51.283Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Two things in the plan turned out to be wrong, both in the same direction, so
the shipped shape is smaller than the ticket describes.

**`externalBin` is not needed, and the binary was already in the bundle.**
`tauri build` does not build `default-run` only: the Tauri CLI enumerates every
`[[bin]]` the crate declares, `cargo build --release` builds them all, and the
bundler copies each into `Contents/MacOS/`. A bundle built on `main` before any
of this work already carried `Contents/MacOS/longclaw`, arm64, ad-hoc signed
with the hardened-runtime flag, and `codesign --verify --deep --strict` already
passed with it inside. Adding `externalBin` would have built the CLI a second
time and shipped a duplicate.

So the first two checklist items were true and nothing said so — which means
nothing would have said so when they stopped being true. A `default-run` edit,
or a bundler that stops enumerating bins, and the app ships with an Install
button pointing at a file that is not there. `binary-audit.mjs` now audits both
binaries: the CLI must be present at `Contents/MacOS/longclaw`, must carry the
same architectures as the window (`lipo -archs`), and gets the same
symbol/framework checks with its own controls — no `_FSEventStreamCreate`,
because it starts no watcher, and a positive read of its own
`longclaw_desktop_lib::cli` symbols in place of it, so an absence claim read off
the wrong file fails instead of passing. Both inversions were run: hiding the
CLI exits non-zero, and copying the window's binary over it fires the positive
control and the codesign seal check.

**What was built.** `platform/command_line.rs` holds the vocabulary — five
states (`linked`, `stale`, `occupied`, `absent`, `unavailable`) and the status
DTO — and dispatches `status`/`install` to the platform whole rather than
composing them out of a link path and a symlink call, so Windows and Linux can
answer the same question their own way. `platform/macos.rs` owns
`/usr/local/bin`, the `std::os::unix::fs::symlink`, and the `sudo mkdir -p … &&
sudo ln -sf …` line, shell-quoted so a path with a space in it still pastes.
No subprocess anywhere; `release-audit.mjs` is green.

Three refusals rather than one: a directory that cannot be created, a directory
that cannot be written, and a file the app did not create — the last is never
replaced, because the link that would stand in its place remembers nothing about
the bytes it displaced. The replacement is a symlink built under a temporary
name and `rename`d over the destination, so a working install is never removed
before its replacement exists.

**Two decisions worth flagging.**

- The offer is a `ConfirmDialog` that *stays up* after a refusal, because the
  refusal is where the line to paste appears. Dismissing to a toast would strand
  a first-launch user on the welcome screen, which has no settings to go back
  to. `Not now` becomes `Close`.
- The settings pane is in the project settings panel and is not project data.
  It says so in its own closing note, the way the Theme pane does for the
  appearance (D-42); `screen-specs.md:334` was amended in place.

**Not built, on purpose.** No uninstall (removing a link the app made is a
second write to design, and nothing asked for one), and no guard against
installing while the app runs from the mounted `.dmg` — the `stale` state
already detects and re-links that afterwards, and the release notes and user
guide now say to move the app to `/Applications` first. There is also no
`--version` on the CLI, so the agent docs settle "installed or freshly built" on
the branch rather than on the binary.

**Runs.** `npm run verify` passes. `npm run build:app` then
`npm run release:binary-audit`: "426 imported symbols and 26 linked libraries
across 2 bundled binaries clean". `npm run a11y:audit` Part A passes (A1–A5), run
because this touches a modal. 21 new tests: 8 Rust over a temp directory, 12 over
the pane and the offer, 5 at the App level for first launch, 2 for the
preference — the last two verified to fail when the `isEmpty` fix is reverted.

**The one step not driven.** Pressing Install in the packaged app: the window
opened on another Space and could not be captured, and the press writes
`/usr/local/bin/longclaw` on this machine, which is not mine to do unasked. The
backend path is covered by the Rust tests against a temp directory, and the
`absent` state the app reports is itself proof that `bundled_command()` resolved
the sibling inside the bundle.
<!-- /longclaw:event -->
