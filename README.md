<p align="center">
  <img src="assets/brand/app-icon/in-app/app-tile-rounded-512.png" alt="" width="96">
</p>

<h1 align="center">LongClaw</h1>

<p align="center">
  <strong>Local-first issue tracker for AI coding agents.</strong><br>
  Humans plan and stay accountable for tickets. Agents execute and write their
  context back to the same record: Markdown files beside your code.
</p>

<p align="center">
  <a href="https://longclaw.io/#download"><img src="https://img.shields.io/badge/Download_for_Mac-000000?style=for-the-badge&logo=apple&logoColor=white" alt="Download for Mac"></a>
</p>

<p align="center">
  <sub>macOS 13+ · Apple Silicon only · no account required</sub>
</p>

<p align="center">
  <a href="https://github.com/sachinjain024/longclaw/releases/latest"><img src="https://img.shields.io/github/v/release/sachinjain024/longclaw?label=release" alt="Latest release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MPL--2.0-blue" alt="License: MPL-2.0"></a>
</p>

<p align="center">
  <a href="https://longclaw.io">Website</a> ·
  <a href="https://longclaw.io/docs/">Install guide</a> ·
  <a href="https://longclaw.io/changelog/">Changelog</a>
</p>

<p align="center">
  <img src="assets/readme/hero.png" alt="The LongClaw board: projects in a sidebar, tickets in To do, In progress and Done columns, and a card an agent edited, marked claude-code via file edit." width="1160">
</p>

Built for developers who hand work to coding agents such as Claude Code and
Cursor, and want the plan to live in the repository those agents already read.

The record outlives the app. A ticket is a directory of plain text inside your
project — readable in an editor, diffable in review, and committed with the work
it describes. Nothing requires an account.

**Status: early, in v0.** LongClaw tracks its own development, and it ships
often. The [changelog](https://longclaw.io/changelog/) and the
[release notes](docs/release-notes/) say what each release changed.

## Completely Secure Local-first app

**No account. No telemetry. LongClaw sends nothing about you, your projects or
your tickets.**

It makes two requests, both to its own GitHub repository and neither carrying
an identifier: a check for a newer version, and the public star count. One
switch in *Settings → Updates* turns both off. With no connection at all, every
feature works the same.

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
a pointer.

**It notices when an agent edits a file.** A native watcher reads external
writes and the board updates without a refresh. A ticket changed outside the app
wears a decaying acknowledgement — a ring and pulse on its card, the actor and
age, and agent-checked rows in its panel — that fades when you open the ticket
or two minutes after the change. If a write collides with one you did not see,
a conflict banner shows the file before anything is overwritten.

**Human and agent are visually distinct** everywhere it matters, in five theme
presets (Indigo, Clay, Slate, Plum, Graphite) across light, dark and system
appearance.

## The `longclaw` CLI

The same crate the window uses also ships as a command-line binary, so key
allocation, the write seams and the file format have exactly one implementation
([ADR 0011](docs/adr/0011-cli-is-the-creation-surface-agents-use.md)). This is
how an agent files and updates work:

**Installing the app installs the command.** The binary rides inside the signed
bundle, and one press in *Settings → Command line* links it into
`/usr/local/bin` (LC-233). Build it from a checkout only when there is no
installed app, or when the checkout has moved ahead of one — an installed
`longclaw` is the app's own build, and this tree's format is spoken only by
this tree's binary.

```sh
# from a checkout, when there is no installed app:
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

## Documentation

- [User guide](docs/user-guide.md) — project folders, file format, backups, agent setup, recovery
- [Release notes](docs/release-notes/) — what each version changed
- [Example agent context files](examples/agent-context/)
- [longclaw.io](https://longclaw.io) — product documentation, CLI reference, blog and changelog

## Contributing

Everything below is for working on LongClaw itself.
[CONTRIBUTING](CONTRIBUTING.md) is the full guide: prerequisites, filing work,
branching, and the quality gate every change must pass.

```sh
npm --prefix apps/desktop ci
npm run verify         # the gate — see CONTRIBUTING for what it runs
npm run dev            # launch the app
npm run dev:fixture    # launch with the development fixture registered
npm run build:app      # the production desktop app
```

The website, longclaw.io, is a separate static Astro package in
[`apps/website`](apps/website) with its own README, which covers its layout,
rules, agent skills and deployment.

**How it is built**

- [On-disk file format and data model](docs/file_format.md)
- [Architecture decisions](docs/adr/) — twelve ADRs, 0001–0012
- [Domain language](CONTEXT.md) — the vocabulary every surface and document uses
- [Design docs](docs/design/) — the prototype bundle the app was built from
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
