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
- The binary is not bundled. `tauri build` ships `longclaw-desktop`; `longclaw` is built by `cargo build` and run from the repository. Shipping it to users is a separate decision, and it would need one — a CLI in the bundle is a surface the release audit's boundary claims do not currently cover. (Revised for LC-233 — see below. The first sentence was never true, and the decision the rest asks for is taken there.)
- P9 and P11 in [the post-MVP backlog](../backlog/post-mvp-backlog.md) are closed by this, ahead of their tier.

## Revised for LC-233: the binary is bundled, and always was

**Status:** accepted on 2026-09-10, during [LC-233](../../.longclaw/tickets/LC-233/ticket.md).

The consequence above is wrong in its first sentence and right in its last, and
the halves have to be answered separately.

**It was never true that `tauri build` ships only the window.** The Tauri CLI
enumerates every `[[bin]]` the crate declares, builds each one, and the macOS
bundler copies each into `Contents/MacOS/` with the target triple stripped. The
CLI is a `[[bin]]` in this same crate — which is the whole point of the decision
above, since sharing the crate is what keeps it from being a second
implementation — so it has been sealed inside every signed bundle this
repository has ever produced. A baseline bundle was built off `main` and opened
before any of LC-233 was written, to be sure the claim being overturned was this
document's and not the ticket's.

That is why LC-233 adds no `bundle.externalBin` entry, which is the obvious way
to ship a second binary and is the wrong one here: naming it there copies a
*second* copy in beside the one the bundler already placed, and two copies of
the CLI in one bundle is a build that can disagree with itself about the file
format.

**The decision the bullet asks for is taken here: the CLI ships.** What it
warned about was a surface the release audit did not cover, and being unbundled
was never what made that safe — the file was in the bundle the whole time and
nothing had ever looked at it. So the cover is what changes, not the shipping.
`binary-audit.mjs` now reads both Mach-O files in `Contents/MacOS/`, with its
own controls for each, because the no-network claim in
[the release-candidate checklist](../acceptance/release-candidate.md) is a claim
about two processes and the CLI is the one it had never opened. The window's
watcher symbol is not demanded of the CLI, which starts no engine (above); what
stands in for it is a positive read of the CLI's own symbols, so a pass cannot
come from having audited the wrong file twice.

**Being in the bundle is still not being on `PATH`.** Nothing installs itself.
The app offers once on first launch and thereafter from *Settings → Command
line*, and a press writes one symlink into `/usr/local/bin`. That is outside the
folder the human chose, which is why it is asked for rather than done — and it
is the single exception to the first consequence above, which is otherwise still
exactly true: every command but `project init` and `project register` touches
nothing outside the project folder. It escalates nothing. A refused write is
answered with the `sudo` line to paste, never with an authorization prompt,
because `release-audit.mjs` forbids the subprocess that would ask for one.

**The rule this puts at risk, and what holds it.** The bundled CLI is the app's
own build, so the command and the window can never disagree about the file
format — that is the reason to ship it rather than a side effect. A checkout
that has moved ahead of the installed app is the one case that breaks it, and
there is no `--version` to detect it with, so `AGENTS.md` makes it a rule about
the branch instead: build from source when the working tree touches `cli.rs`,
`core/` or `file_format.md`.
