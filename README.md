<p align="center">
  <img src="assets/brand/app-icon/in-app/app-tile-rounded-512.png" alt="" width="96">
</p>

<h1 align="center">LongClaw</h1>

<p align="center">
  <strong>A local-first issue tracker for developers working with coding agents.</strong><br>
  Plan work on a Mac board. Let your agent update the same tickets.<br>
  Descriptions, checklists, and activity stay in Markdown files beside your code.
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

## Install

1. **Download** LongClaw for Mac from [longclaw.io](https://longclaw.io/#download),
   or take the `.dmg` from the [latest release](https://github.com/sachinjain024/longclaw/releases/latest).
   Open it and drag LongClaw into Applications.
2. **Open it once.** The app is signed and notarized, so macOS asks one question
   about an app downloaded from the internet. Click **Open**, and it won't ask
   again.
3. **Choose a folder**, usually the repository you already work in. LongClaw
   stores your project's tickets in `.longclaw/` inside that folder.
4. **Put `longclaw` on your `PATH`** so agents can file and update tickets. The
   app offers this on first launch, and again any time in *Settings › Command
   line*. Nothing is installed until you press **Install**.

The [install guide](https://longclaw.io/docs/) covers checksums, the dialogs you
should never see, and building from source.

## How it works

**Humans plan, agents execute, and both write to the same file.** An agent
reads a ticket, does the work, and records what it did in that ticket's
`ticket.md`, through the CLI or a plain edit. Here is one, trimmed, from the
ticket that tracks this README:

```markdown
- [x] (Header) Add license and latest-version badges <!-- longclaw:item=ck_d5047e2e -->

<!-- longclaw:event
kind: update
occurred_at: 2026-09-25T10:30:01.427Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_d5047e2e.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->
```

**LongClaw notices the write without a refresh.** The card rings, names who
changed it (`AGENT claude-code`), and fades when you open it. If an
agent's write collides with one you haven't seen, a conflict banner shows the
file before anything is overwritten.

## What it does

- **Board and list over the same tickets.** Filter, group and order either one;
  the list stays readable at a few thousand rows.
- **A ticket panel that edits in place.** Markdown descriptions with tables,
  checklists you reorder by drag, and an archive that deletes nothing.
- **Ticket properties when you want them.** Type, due date, start date and
  estimate, each off until a project turns it on.
- **Every project in one sidebar.** Star the ones you live in, drag them into
  order, and jump to any of the first nine with `⌘1`–`⌘9`.
- **Keyboard-first.** `⌘K` reaches every action, `⌘Z` undoes the last one, and
  the whole ticket lifecycle works without a pointer.
- **Human and agent, told apart.** Wherever it matters, you can see who did
  what, in five theme presets across light and dark.
- **Updates from inside the app.** It checks for a new version and downloads
  nothing until you press **Update**.

## How it compares

| | Where tickets live | How an agent works with it | Runs on | Accounts and sync |
|---|---|---|---|---|
| **LongClaw** | Markdown files in your repo | Reads the files; writes through the CLI or a plain edit, and each change names the agent | macOS app, Apple Silicon | None |
| **GitHub Issues, Linear** | A hosted service | Through an API or an integration | Web and apps | Accounts, sync and teams |
| **Backlog.md** | Markdown files in your repo | CLI and MCP | macOS, Linux and Windows, with a board in the browser | None |
| **A `TODO.md`** | One file in your repo | Reads and edits it | Anywhere | None |

Backlog.md is the closest neighbour, and it runs on more platforms. LongClaw is
a native Mac app, and every ticket records which human or agent changed what.
A `TODO.md` needs nothing installed, and is fine until you want statuses,
priorities, a board, or a record of what the agent changed.

**Think of LongClaw as a local-first alternative to Linear.** Agents read ticket
context directly from your repository, without an API integration. Each ticket
keeps its description, checklist, and human feedback in one file.

## The `longclaw` CLI

**The app ships with `longclaw`, a CLI for agents.** Agents use it to create
tickets, update progress, and record their work. Those changes appear in the
app. Enable the command in [Install](#install), then run it in your project folder:

```sh
longclaw ticket create --title "Fix the retry policy" --agent-id claude-code

# Replace MP-1a with the returned ticket key, including its trailing letter.
longclaw ticket edit MP-1a --status in_progress --agent-id claude-code
```

See the [CLI reference](https://longclaw.io/docs/cli/) for all commands and
[agent setup examples](examples/agent-context/) for `AGENTS.md` and `CLAUDE.md`.

## A project on disk

A project is any folder you choose. The `.longclaw/` directory inside it is what
makes it a LongClaw project, and each ticket is one directory holding one
`ticket.md`. This is the ticket that tracks this README, trimmed:

```markdown
---
format: longclaw.ticket/v1
id: c5710220-c278-4a24-9467-477cda87698b
key: LC-274e
title: "Refine the GitHub README: current status, install path, and a user-first order"
status: in_progress
priority: none
labels:
  - product
created_at: 2026-09-25T08:46:18.691Z
---

The repository README is the first page a visitor to the GitHub repo reads, and
it has drifted from what the project is now. …

## Checklist

- [x] (Header) Add license and latest-version badges <!-- longclaw:item=ck_d5047e2e -->
- [ ] (Comparison) Add a short "How it compares" section … <!-- longclaw:item=ck_5412a4be -->

## Activity

<!-- longclaw:event
id: evt_39afbd02
kind: create
occurred_at: 2026-09-25T08:46:18.691Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
```

That one file is the whole record: metadata in the frontmatter, the description
in Markdown, a checklist whose items keep their ids, comments, and an activity
log in which every entry names a human or an agent. Attachments sit beside it in
`attachments/`. The rest of `.longclaw/` is `longclaw.yaml`, holding the
project, its people and its labels, and `AGENTS.md`, generated into every
project so an agent that has never seen LongClaw can edit tickets correctly.

See [the file format](docs/file_format.md) for the contract and
[the user guide](docs/user-guide.md) for project folders, backups, agent setup
and recovery.

## Privacy and network access

**No account. No telemetry. Your project and ticket data stay on your machine.**

LongClaw checks GitHub for updates and its public star count in the background.
Turn off **Check for updates automatically** in *Settings → Updates* to disable
both. You can still check for updates manually; downloads start only when you
choose **Update**.

Ticket management works offline. Update checks, update downloads, and fetching
the star count require a connection.

## Product principles

- Files on disk are the source of truth.
- The on-disk format is designed for reliable agent reads and writes.
- Humans and agents collaborate on the same tickets, while assignees remain human.
- The desktop experience targets Linear-grade speed and polish.
- Local use requires no account or telemetry.

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

The architecture decisions, domain language, design docs, agent instructions
and release evidence are indexed in
[docs/README.md](docs/README.md).

## Acknowledgements

LongClaw is built with coding agents, and much of how they work in this
repository comes from skills other people wrote and shared.

- **[Matt Pocock](https://github.com/mattpocock)**, for
  [mattpocock/skills](https://github.com/mattpocock/skills). Nearly every skill
  in [`.agents/skills/`](.agents/skills/) comes from it, among them `tdd`,
  `diagnosing-bugs`, `domain-modeling`, `code-review` and `grilling`. They
  shaped how this codebase is designed, tested, reviewed and tracked, and much
  of its quality is owed to them.
- **[Julius Brussee](https://github.com/JuliusBrussee)**, for
  [caveman](https://github.com/JuliusBrussee/caveman).

Every vendored skill and its source is listed in
[`skills-lock.json`](skills-lock.json).

## License

LongClaw source code is licensed under the [Mozilla Public License 2.0](LICENSE).
