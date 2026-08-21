<img src="assets/brand/app-icon/in-app/app-tile-rounded-512.png" alt="LongClaw" width="76" align="left" hspace="14" vspace="4">

# LongClaw

**A local-first project manager for humans and AI agents.** Humans plan and stay
accountable for tickets; agents execute and contribute their context back to the
same ticket record, stored beside the code as Markdown files you own.

<br clear="left">

The record outlives the app. A ticket is a directory of plain text inside your
project — readable in an editor, diffable in review, and committed with the work
it describes. Nothing requires an account, and nothing is sent anywhere.

**Status: v0, release candidate.** The desktop app lives in `apps/desktop` and
targets Tauri v2 on macOS. See [the 0.1.0 release notes](docs/release-notes/v0.1.0.md)
for what ships and [the acceptance records](docs/acceptance/README.md) for where
the release actually stands.

## What it does

**Two views over the same tickets.** A board grouped by status, and a dense list
that stays readable at a few thousand rows. Both take filtering, grouping and
ordering; ordering is by priority by default, with a Manual mode backed by a
per-ticket rank ([ADR 0003](docs/adr/0003-priority-default-ordering-manual-option.md)).

**A ticket panel that edits in place.** Title, status, priority and labels are
edited on the ticket itself. Descriptions are Markdown with a formatting toolbar
and table support. Checklists reorder by drag, and items can be edited, checked
and removed. Archive takes a ticket off the board without deleting anything
([ADR 0004](docs/adr/0004-archive-in-v0.md)).

**Keyboard-first.** `⌘K` opens a command palette over every action; create is
`⌘↵` from a quick-create field that can stay open and file several tickets in a
row; `⌘Z` undoes the last mutation from a toast. The whole ticket lifecycle —
create, find, open, edit, move, search, archive, undo, retry — completes without
a pointer, and `npm run a11y:audit` proves it in WebKit on every run.

**It notices when an agent edits a file.** A native watcher reads external
writes and the board updates without a refresh. A ticket changed outside the app
wears a decaying acknowledgement — a ring and pulse on its card, the actor and
age, and agent-checked rows in its panel — that fades when you open the ticket
or two minutes after the change. If a write collides with one you did not see,
a conflict banner shows the file before anything is overwritten.

**Human and agent are visually distinct** everywhere it matters, in five theme
presets (Indigo, Clay, Slate, Plum, Graphite) across light, dark and system
appearance. A visual matrix regression runs over the combinations.

## The `longclaw` CLI

The same crate the window uses also ships as a command-line binary, so key
allocation, the write seams and the file format have exactly one implementation
([ADR 0011](docs/adr/0011-cli-is-the-creation-surface-agents-use.md)). This is
how an agent files and updates work:

```sh
cargo build --release --manifest-path apps/desktop/src-tauri/Cargo.toml --bin longclaw

longclaw project init --name "My Project" --key MP
longclaw label add --slug storage --name Storage
longclaw ticket create --title "Fix the retry policy" --label storage \
  --checklist "Reproduce it" --agent-id claude-code --agent-name "Claude Code"
longclaw ticket edit MP-1 --status in_progress --agent-id claude-code
longclaw ticket list
longclaw                       # the full surface
```

Every command prints JSON on stdout and exits non-zero with a typed error on
failure. A label must be defined before a ticket can carry it — the CLI refuses
a slug the project does not define, so a label cannot be created by using it.
**An agent must pass `--agent-id`**: the file format declares an actor
and never infers one, so without it the activity entry claims a human did the
work.

This repository tracks its own work this way. Every `LC-*` item under
[`.longclaw/tickets/`](.longclaw/tickets/) was filed through this CLI, and the
agent-authored entries in those files were written by agents reading the same
contract yours will.

## A project on disk

A project is any folder you choose; the `.longclaw/` directory inside it is what
makes it a LongClaw project.

```text
your-project/
└── .longclaw/
    ├── longclaw.yaml          project identity, people, label definitions
    ├── AGENTS.md              the editing contract, written for agents
    └── tickets/
        └── LC-42/
            ├── ticket.md      the complete record for one ticket
            └── attachments/
```

`ticket.md` holds the ticket's metadata, description, checklist, attachment
registry, comments and activity — everything, in one file. `.longclaw/AGENTS.md`
is generated into every project so an agent that has never seen LongClaw can
read and edit tickets correctly without being told how.

See [the file format](docs/file_format.md) for the contract and
[the user guide](docs/user-guide.md) for project folders, backups, agent setup
and recovery.

## Product principles

- Files on disk are the source of truth.
- The on-disk format is designed for reliable agent reads and writes.
- Humans and agents collaborate on the same tickets, while assignees remain human.
- The desktop experience targets Linear-grade speed and polish.
- Local use requires no account or telemetry.

## Development

Prerequisites:

- macOS 13 or newer on Apple Silicon — the only target the app is built for.
- Node.js 22 or newer.
- Rust with Cargo, Rustfmt, and Clippy.
- Tauri v2 platform prerequisites for macOS.

Install and verify from a clean checkout:

```sh
npm --prefix apps/desktop ci
npm run verify
```

Run it:

```sh
npm run dev            # launch the app
npm run dev:fixture    # launch with the development fixture registered
npm run build          # web assets
npm run build:app      # the production desktop app
```

`npm run verify` is the gate every change must pass: design-token and structural
guards, the release audit, formatting, lint, types, the frontend and Rust
suites, the Vite production build, and the watcher integration round trip. It is
described in full — including which guard rejects what — in
[CONTRIBUTING](CONTRIBUTING.md#quality-gates), which is the one place that list
lives.

Local diagnostics are stdout-only and prefixed with `LONGCLAW_LOCAL_DIAGNOSTIC`;
no telemetry or analytics are sent.

## Documentation

**Using it**

- [User guide](docs/user-guide.md) — project folders, file format, backups, agent setup, recovery
- [0.1.0 release notes](docs/release-notes/v0.1.0.md)
- [Example agent context files](examples/agent-context/)

**How it is built**

- [On-disk file format and data model](docs/file_format.md)
- [Architecture decisions](docs/adr/) — twelve ADRs, 0001–0012
- [Domain language](CONTEXT.md) — the vocabulary every surface and document uses
- [Design docs](docs/design/) — the prototype bundle the app was built from
- [Contributor setup and the quality gate](CONTRIBUTING.md)
- [App-specific notes](apps/desktop/README.md) — registry recovery, device preferences

**Working with agents**

- [Instructions for agents](AGENTS.md) — the contract an agent in this repository follows
- [Issue tracker surface](docs/agents/issue-tracker.md), [triage labels](docs/agents/triage-labels.md), [domain docs](docs/agents/domain.md)

**Planning and evidence**

- [Vision and scope](docs/vision.md)
- [Design brief](docs/design_brief.md)
- [MVP execution plan](docs/mvp_plan_order.md)
- [v0 backlog](docs/backlog/v0-backlog.md) · [post-MVP backlog](docs/backlog/post-mvp-backlog.md)
- [Acceptance scenarios and records](docs/acceptance/README.md)
- [Mid-v0 pilot protocol](docs/pilot/README.md) · [response memo](docs/pilot/response-memo.md)
- [v0 release risks](docs/release-risks.md)

## License

LongClaw source code is licensed under the [Mozilla Public License 2.0](LICENSE).
