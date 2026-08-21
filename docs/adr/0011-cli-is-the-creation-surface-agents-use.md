# The CLI is the creation surface agents use, and it is not a second implementation

**Status:** accepted 2026-08-05, on [a recorded scope decision](../pilot/response-memo.md#scope-decisions); the CLI shipped the same day.

Ticket and project creation are reachable from a `longclaw` command-line binary as well as from the app's window. The binary links the same crate the window does, so key allocation, the write seams, and the file format have exactly one implementation; the CLI adds argument parsing, a JSON projection of the records it touched, and one thing the app never needed — a way for a writer to declare that it is an agent.

It exists because the alternative was worse than the rule it broke. The issue-tracker rules give key allocation to LongClaw and forbid an agent creating `.longclaw/tickets/<KEY>/` directly, which is right; with the window as the only creation surface, the consequence was that a defect found while building LongClaw was written into `docs/plans/` and this repository could not track its own work. That was recorded as [the CLI caveat](../backlog/v0-backlog.md#the-cli-caveat-recorded-rather-than-resolved) and deferred as P9 and P11. The founder accepted it on 2026-08-05; the decision is [in the memo](../pilot/response-memo.md#scope-decisions), which is where the caveat said it had to be.

## What keeps it from being a second implementation

- **It allocates nothing.** `storage::prepare_new_ticket_as` scans canonical directory names and claims the next key with `create_new` semantics — the same call the app makes, and the reason two racing creations cannot land on one key. Nothing in the CLI composes a key.
- **It writes through the same seams.** A create goes out through `atomic_write`; an edit through `atomic_replace`, carrying the hash of the bytes it read. A stale command is a typed conflict rather than a silent overwrite, which is what makes it safe to run beside an open app.
- **It starts no engine.** No watcher, no index, no event stream. A short-lived process has nothing to keep in sync, and a running app sees these writes as what they are: an external edit, which it already notices and absorbs.

## Attribution is the one thing it adds

`render_event` used to write `actor: {type: human, id: local}` unconditionally. That is correct for the person at the keyboard (ADR 0001) and wrong for anything else, and [the format contract](../file_format.md#embedded-activity) is explicit that actor type is declared and never inferred. So the rendering and storage seams gained author-carrying variants — `apply_as`, `render_new_ticket_as`, `prepare_new_ticket_as`, `prepare_ticket_edit_as` — and the existing names became what they always meant: the app's own write, by the local human.

An agent passes `--agent-id`; without it a command is what it looks like, which is a person editing their own project. The frontend needed no change to show the result: `attribution.ts` has always rendered an `agent` actor with its own glyph and accent, and `eventProse` has always stripped the record's heading precisely because "an agent's heading is free text that must never become the app's own claim about who did something". v0 shipped a reader for agent-authored activity and no writer for it. This is the writer.

## Consequences

- The CLI reaches the project registry for `project init` and `project register` only, so a project it creates appears in the app's list. Every other command works from `--path` and touches nothing outside the project folder. A CLI write while the app is open is an external edit, not a registry conflict.
- Labels a ticket carries must already be defined in `longclaw.yaml`. The app cannot produce an undefined slug either, and one renders as a bare slug in the fallback hue; refusing here keeps that state to files LongClaw did not write.
- Unknown options are refused rather than ignored. A dropped `--descriptoin` writes an empty description into every ticket of an import run and says nothing.
- The binary is not bundled. `tauri build` ships `longclaw-desktop`; `longclaw` is built by `cargo build` and run from the repository. Shipping it to users is a separate decision, and it would need one — a CLI in the bundle is a surface the release audit's boundary claims do not currently cover.
- P9 and P11 in [the post-MVP backlog](../backlog/post-mvp-backlog.md) are closed by this, ahead of their tier.
