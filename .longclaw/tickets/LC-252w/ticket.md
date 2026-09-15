---
format: longclaw.ticket/v1
id: 228c90ad-2033-465d-a4e1-51426c858a12
key: LC-252w
title: AGENTS.md's toolchain block describes a machine that no longer exists
status: todo
priority: p2
labels:
  - platform
type: chore
created_at: 2026-09-14T06:59:42.128Z
updated_at: 2026-09-14T06:59:42.128Z
---

`AGENTS.md` § Toolchain and the gate opens with the line every agent is told to
run before any Rust work:

```sh
export PATH="/opt/homebrew/opt/rustup/bin:$PATH"   # rustup is Homebrew's

node -v   # v26.5.0 (Homebrew). An old /usr/local/bin/node v10 is still present.
cargo -V  # 1.97.1; stable is the default toolchain
```

None of that is true on the build machine as of 2026-09-14.

| Claim | Actually |
|---|---|
| `rustup` is Homebrew's, at `/opt/homebrew/opt/rustup/bin` | `cargo` resolves to `~/.cargo/bin/cargo` — a rustup-managed install, not Homebrew's. The exported `PATH` entry changes nothing. |
| `node -v` → v26.5.0 (Homebrew) | v22.15.1, from `~/.nvm/versions/node/v22.15.1/bin/node`. **There is no `/opt/homebrew/bin/node` at all.** |
| an old `/usr/local/bin/node` v10 is still present | not what `which node` resolves to; nvm is ahead of it |
| `cargo -V` → 1.97.1 | 1.93.1 (083ac5135 2025-12-15) |

## Why this is worth fixing rather than ignoring

Nothing is broken today. `npm run verify` passes on v22.15.1 / 1.93.1, and
`engines` asks only for node >= 22, so the versions in use are legitimate. This
is a documentation defect, and it has the shape that costs an afternoon rather
than a minute:

- **The export line reads as load-bearing and is not.** An agent that hits a
  Rust problem will trust it, re-run it, and conclude the environment is set up
  when it has not changed anything. A stale instruction that appears to work is
  worse than a missing one.
- **nvm is per-shell.** A node that arrives from `~/.nvm` is a function of shell
  init, so a non-interactive or differently-launched shell can resolve a
  different node — including the v10 the file warns about. `AGENTS.md` currently
  offers no way to tell which one you got, because the version it prints as
  expected is one no shell on this machine produces.
- **It is the first thing a new agent reads about this repo's environment**, and
  it is the section that decides whether they trust the rest of the file.

## What to do

Re-derive the block from the machine rather than editing the numbers, and say
where each tool comes from — nvm and rustup, not Homebrew — so the next drift is
legible as drift. Then decide whether the versions should be pinned: an
`.nvmrc`, or a `rust-toolchain.toml`, would make the question answerable instead
of observed. Note that `apps/desktop/package.json` `engines` says `>=22` and the
root says `>=22`, while the CI workflow pins `node-version: 22` — so CI and this
machine agree and only the prose disagrees with both.

Found while cutting the 0.1.0 release (LC-234i), where the versions have to go
into the acceptance record and the record has to name what actually built the
artefact.

## Checklist

- [ ] Re-derive the node/cargo/rustup block in AGENTS.md from the machine, naming nvm and rustup as the sources <!-- longclaw:item=ck_1b9cc902 -->
- [ ] Decide whether to pin: .nvmrc and/or rust-toolchain.toml, or document that the floor is engines >=22 <!-- longclaw:item=ck_4fc85fa0 -->
- [ ] Check the same block in CONTRIBUTING.md and apps/desktop/README.md for the same drift <!-- longclaw:item=ck_f1e5f149 -->

## Activity

<!-- longclaw:event
id: evt_f8933033
kind: create
occurred_at: 2026-09-14T06:59:42.128Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
