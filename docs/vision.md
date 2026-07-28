---
title: "LongClaw — Vision & Scope"
product: "LongClaw — unified PM for humans & agents"
domain: longclaw.io
status: canonical
format: markdown
supersedes: "v0.8 (Linear DS), v0.9 (Clay DS)" # v1.0 = v0.8 system + themes
lineage: "final-approved = v1.0; Iteration 1 / Appendix A = v0.8; v0.9 was discarded except for the Clay preset"
iterations_included:
  - final-approved
  - iteration-1-historical
---

# LongClaw — Vision & Scope

> **Canonical document.** The final approved iteration is the source of truth for product and implementation decisions. Iteration 1 is retained at the end as historical context. The abandoned intermediate exploration is intentionally omitted.

> **Lineage and terminology.** “Iteration 1” and the earlier shorthand “v1 design system” refer to the Linear-family foundation preserved in Appendix A. The final approved iteration is that foundation plus project-theme tokens. The discarded Clay redesign is not embedded; only its accepted Clay preset survives.

## Final approved iteration

> **One canvas where humans plan and agents execute.**

A local-first, Linear-grade issue tracker for AI-native startups — where **humans** plan work, assign tickets, and add detail, and **AI agents** execute those tickets and write their context back into the same system, stored as files on disk next to the code.

## The problem

### Planning and execution have bifurcated

In AI-native teams, the two halves of building software live in systems that don't talk to each other:

Planning — humans

Happens in Linear, Jira, or Notion. Humans decide what to build, divide the work, file bugs, and track status — in a cloud database far from the code.

Execution — agents

Happens in the git repo. Claude Code, Cursor, and other agents do the actual work, leave artifacts as files, and open PRs — with no visibility into the plan.

The ticket becomes a **stub**: it gets closed when a PR merges, but carries no fidelity on what the agent actually did, what it tried, what it discovered, or what broke downstream. Agents, meanwhile, start every session without the plan, the priorities, or the history. The coordination cost compounds as agents take on more of the work.

## The product

### What we're building

One project-management surface where humans and agents collaborate on the same tickets, with state visible to both, living next to the code.

- human  Plan work, create projects, write and assign tickets, add detail and priority, review progress on a fast, beautiful board.
- agent  Pick up tickets with full context already on disk, execute them, and update the ticket — status, notes, discoveries, links to commits — in a format designed to be read and written by LLMs.

It is a **fast, performant desktop app with beautiful, elegant styling**. The quality bar is Linear; the data model is Obsidian.

## Who it's for

### AI-native startups

Small teams (roughly 3–15 people) doing AI-native or spec-driven development — the teams for whom agents already do a meaningful share of the coding, and for whom the planning/execution split is a daily tax. Solo builders using Claude Code or Cursor are the entry point; small teams are the business.

## Principles

### What we believe

#### 1. Local-first, files on disk — the Obsidian model

Data is stored locally as markdown files (or a similarly plain, portable format) in the file system. The user selects a folder — ideally inside their GitHub repo — and that folder *is* the project. No lock-in: the files are readable without the app, forever.

#### 2. The data format is designed for agents first

We pick a data model and on-disk format that is easy for AI agents to read, query, and update reliably — not just pretty for humans. This format is the moat; it is specced deliberately, by hand, before implementation begins.

#### 3. Linear-grade polish is non-negotiable

Existing git-native trackers are CLI-first and visually spartan. Our differentiation is combining file-on-disk portability with a visual experience that feels as fast and considered as Linear. Anything that looks or feels generic is a bug.

**Visual direction (settled):** the design system stays deliberately in Linear's family of calm and restraint — that quality is what we chose it for. Differentiation comes through **subtle, minor departures**, not a redesign: our own accent palette expressed as **swappable project themes** (section 06), mono metadata as the file-native signature, and small own decisions at the detail level. An earlier fully-original Clay exploration was rejected for introducing visual noise; its palette survives as one theme preset.

#### 4. Humans and agents are peers on the same canvas

Every surface is designed for two kinds of users. A ticket must be equally legible to a person scanning a board and an agent parsing a file.

#### 5. Built in the open

The product is **open source**: the client is developed publicly under MPL 2.0. Open source is both a trust signal for a privacy-sensitive, local-first audience and the distribution engine for the free solo tier. The hosted sync backend — the paid layer — remains closed source.

## Core experience

### The app

#### Side panel

The primary navigation surface. Users see:

- **All projects** — everything they have access to
- **Starred projects** — pinned favorites
- **Local projects** — folders on this machine, no account/team attachment
- **Teams** — each team listed with its team projects nested under it

#### Board & views

Design inspiration from **Linear** (density, speed, keyboard-first interaction, refinement) and **Trello** (approachable card/board mental model). Core primitives: issue list, board, ticket side panel, command palette. Each project board carries a **theme** — one of a small fixed set of accent presets (section 06) — so different projects are distinguishable at a glance without any change to layout or behavior.

#### Tickets

Humans author scope, priority, and detail, and **assignees are always humans** — accountability stays with a person. Agents contribute as actors on the ticket: they **comment, update the description, and check off checklist items** as they execute, so the ticket accumulates a living record — plan, execution notes, discoveries, links to commits/PRs — instead of becoming a stub. Descriptions are edited **in-app with a GitHub/Trello-style markdown editor**; tickets include **checklists** as a first-class primitive (the natural human→agent work interface).

## Project themes

### Fixed themes, chosen per project **[decided]**

The two-actor accent pair (human accent + agent accent) is not a single hardcoded palette — it is a **theme applied per project board**. Phase 0 ships a **small fixed set of theme presets**; users pick one when creating a project (and can change it later). **No custom color pickers** — presets only. Custom colors are explicitly deferred.

These are working reference values from the reviewed designs; final production hues remain subject to design-system validation.

| Preset | Human accent | Agent accent | Note |
|---|---:|---:|---|
| Indigo · default | `#4B4EE7` | `#12946A` | The system this document is set in |
| Clay | `#A9482C` | `#12946A` | Warm human accent retained from the Clay exploration |
| 2–3 additional presets | To be proposed | Green family; working value `#12946A` | Design system proposes; founder approves |

- **The human accent is what varies per theme** (Indigo default, Clay, and a few more). **[proposed]** The **agent accent stays in the green family across every theme**, so agent activity reads identically in every project — the differentiating surface never changes costume. Flag at design review if a theme-specific agent hue tests better.
- **Every preset defines both light and dark values.** Theme (accent pair) and appearance (light/dark) are independent axes.
- **Architecturally, a theme is a token swap.** The design system routes every accent usage through tokens; no component hardcodes a hue. This is a Phase 0 design-system requirement, not a later retrofit.

## Integrated execution

### Terminals inside the tracker post-v0 · before team sync

Planned as the next major capability after v0 — and sequenced **before** cloud sync and teams: users can open a terminal alongside the product, in the style of VS Code or Cursor, and **start an agent execution for a ticket directly from it**. The tracker stops being a place you look at work and becomes the place work is launched from.

- **Multiple terminals, tabbed UI** — users can open several terminals at once, presented as tabs.
- **Terminals are linked to tickets** — each terminal session is bound to a ticket, and users can navigate between a ticket and its terminal (and across running sessions) fluidly.
- **Launch from the ticket** — kick off execution for a ticket without leaving the app; the agent picks up the ticket's full context from disk.

This closes the loop of the core thesis on one screen: humans plan on the board, agents execute in the attached terminal, and the ticket accumulates the execution record — plan, run, and result in a single surface.

**Architecture:** **[decided]** the terminal is **embedded in the app**, VS Code–style — xterm.js rendering in the webview, backed by a real Rust PTY (portable-pty / tauri-plugin-pty, the Tauri-native equivalent of VS Code's node-pty). Terminal↔ticket linkage lives in **app state only** — it is not part of the on-disk file format.

## Data & storage

### Where the data lives

Each project maps to a folder the user selects on their machine — ideally inside the project's git repository, so tickets travel with the code. The approved source-of-truth contract uses one directory per ticket, a canonical Markdown ticket record, and ticket-owned attachments. The app builds a disposable local index for speed on top of those files.

The canonical contract is [On-Disk File Format & Data Model](file_format.md).

## Sync & collaboration

### Cloud sync — the paid layer

Sync is **opt-in per project** and is what we charge for. When a user enables sync on a project:

- Data **stays on the local machine** and is additionally synced to the cloud in real time for team collaboration.
- The app shows a message advising the user to add the project directory to `.gitignore`, so real-time sync updates don't conflict with git version control.

Local-only projects remain fully functional and free, forever.

## Accounts & platform

### How you get in

#### Accounts — the pure Obsidian model

**No account is required to use the product locally.** No signup wall, no telemetry — download it, point it at a folder, start working. The app surfaces an optional **Sign up** button in the UI (positioned around early access to cloud sync and team features); engaged users will convert voluntarily, and the sync waitlist becomes the primary signal of demand and reachable users.

An account becomes required only at the moment it delivers value: **when the user enables cloud sync** — the same pattern Obsidian users already accept.

#### Platform

Initially a **macOS desktop app**, built with **Tauri v2**. Cross-platform (Windows, Linux) follows once the Mac experience is excellent.

## Business model

### Free for one, paid for teams

- **Free:** full local product for solo use — the client is open source (MPL 2.0).
- **Paid:** cloud sync and team projects — the sync backend is closed source and hosted by us.

## Decisions

### Settled vs. delegated

To keep the implementation agent from re-litigating settled questions — and to make its freedoms explicit:

| Already made — do not reopen | Rationale |
|----|----|
| Tauri v2, macOS first | Performance + small bundle; native feel over Electron. |
| Files-on-disk as source of truth (Obsidian model) | Portability and agent access are the thesis. |
| On-disk file format and data model | One directory per ticket; `ticket.md` is the v0 structured record; text, image, and video attachments live with their ticket. See [file_format.md](file_format.md). |
| Open-source client (MPL 2.0), closed paid sync backend | Trust + distribution for the client; revenue on collaboration. |
| No account for local use (pure Obsidian model) | Optional signup button in the UI; account required only when enabling cloud sync. No telemetry. |
| v0 is local projects only | Sync and teams come later; see sequencing layer. |
| Embedded terminal (xterm.js + Rust PTY) | VS Code–style, in-app; not an external terminal launch. Sequenced post-v0, before team sync. |
| Terminal↔ticket linkage in app state only | Session bindings are runtime state, not part of the on-disk file format. |
| Humans assign, agents contribute | Assignee is always a human; agents act via comments, description edits, and checklist updates. |
| In-app markdown editor for descriptions | GitHub/Trello-style editing experience; checklists are a first-class primitive. |
| Light + dark themes, system-matched, from v0 | Both are first-class; neither is an afterthought. Every project-theme preset defines both. |
| Visual direction: the Iteration 1 (Linear-family) system, with subtle departures only | The Clay full-redesign exploration is retired — calm over novelty. Identity comes from theme tokens + mono metadata, not a new visual language. |
| Fixed project themes, not custom colors | Each project board uses one of a small set of preset accent themes (Indigo + Green default; Clay + Green among the presets). Presets are designed in Phase 0; no custom color pickers. |
| Linear-grade quality bar; Linear + Trello as board inspiration | Polish is the differentiation. |

| Delegated to the implementation agent | Constraint |
|----|----|
| Internal architecture: state management, IPC patterns, indexing strategy | Built on the hand-reviewed Tauri foundation spike. |
| Component implementation details | Must match the design-system handoff bundle exactly — including routing all accent color through theme tokens. |
| Test strategy, tooling, CI setup | PR-level human review; manual deploys. |

**Kept in human hands regardless:** the approved [on-disk file format and data model](file_format.md), and the initial Tauri architecture spike. Both are manually specified and reviewed before mass ticket execution.

## Non-goals

### What v0 is not

- No cloud sync, no team projects, no billing — v0 is local-only.
- No integrated terminals yet — they arrive after v0, ahead of team sync.
- No custom theme colors — fixed presets only; a theme builder is explicitly deferred.
- No Windows/Linux builds yet.
- No web or mobile client.
- Not a git host, code review tool, or chat product.
- Not a generic PM tool for non-technical teams — the repo-adjacent, agent-first workflow is the point.

## Open questions

### Tensions to resolve

**1. "In the repo" vs. `.gitignore` on sync — parked.** The founding thesis is "tickets live in your git repo" — diffable, versioned, traveling with the code — while enabling cloud sync advises git-ignoring the folder, which removes those properties for synced teams. **Decision deferred to the team-sync phase.** One constraint carries forward now: the v0 file format spec should avoid choices that foreclose a git-friendly, merge-tolerant answer later.

*Resolved:* exact file format and data model — [canonical contract](file_format.md). Project theme storage — on-disk in `longclaw.yaml`. Product name — **LongClaw**. Signup model — pure Obsidian. Visual direction — Iteration 1's Linear-family system with theme tokens; Clay retired as a direction, kept as a preset. See Principles and Themes.

## Sequencing

### Phasing & MVP boundary

The vision above explains *why*; this layer says *what order*. Anything not listed in the current phase is out of scope for that phase's tickets, even if the vision describes it — this is the guard against gold-plating early work with future-phase concerns.

#### Phase 0  Foundations — human-led, before mass ticket execution

Ordered — design comes first, and the format spec follows the reviewed prototype:

1.  **Design system → screens → handoff bundle** — brand/design system in Claude Design first, then the core screens; iterate until the prototype is reviewed and settled; export the handoff bundle and commit it to the repo alongside this doc. **Includes the theme architecture:** accent-as-token throughout, and the fixed preset set (Indigo default + Clay + 2–3 more, each in light and dark). Prove the swap by rendering at least one core screen in two themes.
2.  **File format & data model spec** — hand-specced and reviewed *after* the design prototype review (the reviewed screens reveal what the data model must express), and *before* mass ticket execution. Carries the one constraint from the parked sync question: don't foreclose a git-friendly, merge-tolerant answer later. Decides where the project theme setting lives.
3.  **Tauri v2 architecture spike** — project structure, state management, IPC patterns, file watcher ↔ index interaction. Leave room in the IPC design for streaming PTY channels, so Phase 2 terminals extend this skeleton rather than fight it.

#### Phase 1  v0: Local core — the MVP boundary

- macOS app (Tauri v2), **local projects only**: select a folder, create a project, work.
- File format read/write, local index, and file watcher — the app and any external agent editing the files stay in sync.
- Side panel with local and starred projects. Teams/cloud entries: not built, not stubbed.
- Issue list, board, ticket side panel, command palette — at the Linear-grade bar.
- **Per-project theme selection from the fixed presets** — set at project creation, changeable later. No custom colors.
- Optional **Sign up** button wired to the sync waitlist. No account required, no telemetry.

**Ship point (mandatory milestone, mid-v0):** as soon as the first vertical slice works — one project, one board, tickets round-tripping through the file format with a real agent — put it in front of a handful of Claude Code / Cursor users. Their reaction reshapes the remaining ticket list before the rest of the backlog executes. The vision layer stays stable; this sequencing layer is what absorbs the feedback.

#### Phase 2  Integrated execution — terminals

- Embedded terminal panel (xterm.js + Rust PTY), multiple terminals in a tabbed UI.
- Terminal↔ticket linkage (app state only) with fluid navigation between a ticket and its session.
- Launch an agent execution for a ticket directly from the app; context read from disk, results written back to the ticket.

#### Phase 3  Sync & teams — the paid layer

- Accounts become functional beyond the waitlist; cloud sync opt-in per project; billing.
- Teams and team projects appear in the side panel; `.gitignore` guidance shown on sync enable.
- **Gate:** resolve the parked "in the repo vs. `.gitignore`" question before building sync — it determines the sync architecture.

#### Someday  Explicitly deferred

- Windows and Linux builds — after the Mac experience is excellent (note the Rust-PTY Windows rough edges for the terminal port).
- Custom theme colors / a theme builder — only if fixed presets prove limiting.
- Anything else the vision doesn't name — integrations, web/mobile, automations — requires a deliberate addition to this doc first.

------------------------------------------------------------------------

## Appendix A — Iteration 1 (historical)

> This appendix preserves the original iteration for decision history only. When it conflicts with the final approved iteration above, the final iteration wins.

> **One canvas where humans plan and agents execute.**

A local-first, Linear-grade issue tracker for AI-native startups — where **humans** plan work, assign tickets, and add detail, and **AI agents** execute those tickets and write their context back into the same system, stored as files on disk next to the code.

### The problem

#### Planning and execution have bifurcated

In AI-native teams, the two halves of building software live in systems that don't talk to each other:

Planning — humans

Happens in Linear, Jira, or Notion. Humans decide what to build, divide the work, file bugs, and track status — in a cloud database far from the code.

Execution — agents

Happens in the git repo. Claude Code, Cursor, and other agents do the actual work, leave artifacts as files, and open PRs — with no visibility into the plan.

The ticket becomes a **stub**: it gets closed when a PR merges, but carries no fidelity on what the agent actually did, what it tried, what it discovered, or what broke downstream. Agents, meanwhile, start every session without the plan, the priorities, or the history. The coordination cost compounds as agents take on more of the work.

### The product

#### What we're building

One project-management surface where humans and agents collaborate on the same tickets, with state visible to both, living next to the code.

- human  Plan work, create projects, write and assign tickets, add detail and priority, review progress on a fast, beautiful board.
- agent  Pick up tickets with full context already on disk, execute them, and update the ticket — status, notes, discoveries, links to commits — in a format designed to be read and written by LLMs.

It is a **fast, performant desktop app with beautiful, elegant styling**. The quality bar is Linear; the data model is Obsidian.

### Who it's for

#### AI-native startups

Small teams (roughly 3–15 people) doing AI-native or spec-driven development — the teams for whom agents already do a meaningful share of the coding, and for whom the planning/execution split is a daily tax. Solo builders using Claude Code or Cursor are the entry point; small teams are the business.

### Principles

#### What we believe

##### 1. Local-first, files on disk — the Obsidian model

Data is stored locally as markdown files (or a similarly plain, portable format) in the file system. The user selects a folder — ideally inside their GitHub repo — and that folder *is* the project. No lock-in: the files are readable without the app, forever.

##### 2. The data format is designed for agents first

We pick a data model and on-disk format that is easy for AI agents to read, query, and update reliably — not just pretty for humans. This format is the moat; it is specced deliberately, by hand, before implementation begins.

##### 3. Linear-grade polish is non-negotiable

Existing git-native trackers are CLI-first and visually spartan. Our differentiation is combining file-on-disk portability with a visual experience that feels as fast and considered as Linear. Anything that looks or feels generic is a bug.

##### 4. Humans and agents are peers on the same canvas

Every surface is designed for two kinds of users. A ticket must be equally legible to a person scanning a board and an agent parsing a file.

##### 5. Built in the open

The product is **open source**: the client is developed publicly under MPL 2.0. Open source is both a trust signal for a privacy-sensitive, local-first audience and the distribution engine for the free solo tier. The hosted sync backend — the paid layer — remains closed source.

### Core experience

#### The app

##### Side panel

The primary navigation surface. Users see:

- **All projects** — everything they have access to
- **Starred projects** — pinned favorites
- **Local projects** — folders on this machine, no account/team attachment
- **Teams** — each team listed with its team projects nested under it

##### Board & views

Design inspiration from **Linear** (density, speed, keyboard-first interaction, refinement) and **Trello** (approachable card/board mental model). Core primitives: issue list, board, ticket side panel, command palette.

##### Tickets

Humans author scope, priority, and detail, and **assignees are always humans** — accountability stays with a person. Agents contribute as actors on the ticket: they **comment, update the description, and check off checklist items** as they execute, so the ticket accumulates a living record — plan, execution notes, discoveries, links to commits/PRs — instead of becoming a stub. Descriptions are edited **in-app with a GitHub/Trello-style markdown editor**; tickets include **checklists** as a first-class primitive (the natural human→agent work interface).

### Integrated execution

#### Terminals inside the tracker post-v0 · before team sync

Planned as the next major capability after v0 — and sequenced **before** cloud sync and teams: users can open a terminal alongside the product, in the style of VS Code or Cursor, and **start an agent execution for a ticket directly from it**. The tracker stops being a place you look at work and becomes the place work is launched from.

- **Multiple terminals, tabbed UI** — users can open several terminals at once, presented as tabs.
- **Terminals are linked to tickets** — each terminal session is bound to a ticket, and users can navigate between a ticket and its terminal (and across running sessions) fluidly.
- **Launch from the ticket** — kick off execution for a ticket without leaving the app; the agent picks up the ticket's full context from disk.

This closes the loop of the core thesis on one screen: humans plan on the board, agents execute in the attached terminal, and the ticket accumulates the execution record — plan, run, and result in a single surface.

**Architecture:** **[decided]** the terminal is **embedded in the app**, VS Code–style — xterm.js rendering in the webview, backed by a real Rust PTY (portable-pty / tauri-plugin-pty, the Tauri-native equivalent of VS Code's node-pty). Terminal↔ticket linkage lives in **app state only** — it is not part of the on-disk file format.

### Data & storage

#### Where the data lives

Each project maps to a folder the user selects on their machine — ideally inside the project's git repository, so tickets travel with the code. Files use markdown (or the chosen agent-friendly format) as the source of truth; the app builds whatever local index it needs for speed on top of them.

**Open design work:** the exact format (markdown + frontmatter? a fast local index? a CLI that emits JSON for agents?) is the core design decision of the product and is specced by hand before agent-driven implementation. See "Decisions" below.

### Sync & collaboration

#### Cloud sync — the paid layer

Sync is **opt-in per project** and is what we charge for. When a user enables sync on a project:

- Data **stays on the local machine** and is additionally synced to the cloud in real time for team collaboration.
- The app shows a message advising the user to add the project directory to `.gitignore`, so real-time sync updates don't conflict with git version control.

Local-only projects remain fully functional and free, forever.

### Accounts & platform

#### How you get in

##### Accounts — the pure Obsidian model

**No account is required to use the product locally.** No signup wall, no telemetry — download it, point it at a folder, start working. The app surfaces an optional **Sign up** button in the UI (positioned around early access to cloud sync and team features); engaged users will convert voluntarily, and the sync waitlist becomes the primary signal of demand and reachable users.

An account becomes required only at the moment it delivers value: **when the user enables cloud sync** — the same pattern Obsidian users already accept.

##### Platform

Initially a **macOS desktop app**, built with **Tauri v2**. Cross-platform (Windows, Linux) follows once the Mac experience is excellent.

### Business model

#### Free for one, paid for teams

- **Free:** full local product for solo use — the client is open source (MPL 2.0).
- **Paid:** cloud sync and team projects — the sync backend is closed source and hosted by us.

### Decisions

#### Settled vs. delegated

To keep the implementation agent from re-litigating settled questions — and to make its freedoms explicit:

| Already made — do not reopen | Rationale |
|----|----|
| Tauri v2, macOS first | Performance + small bundle; native feel over Electron. |
| Files-on-disk as source of truth (Obsidian model) | Portability and agent access are the thesis. |
| Open-source client (MPL 2.0), closed paid sync backend | Trust + distribution for the client; revenue on collaboration. |
| No account for local use (pure Obsidian model) | Optional signup button in the UI; account required only when enabling cloud sync. No telemetry. |
| Open source | The product is built in the open; client licensed MPL 2.0. Paid sync backend stays closed. |
| v0 is local projects only | Sync and teams come later; see sequencing layer. |
| Embedded terminal (xterm.js + Rust PTY) | VS Code–style, in-app; not an external terminal launch. Sequenced post-v0, before team sync. |
| Terminal↔ticket linkage in app state only | Session bindings are runtime state, not part of the on-disk file format. |
| Humans assign, agents contribute | Assignee is always a human; agents act via comments, description edits, and checklist updates. |
| In-app markdown editor for descriptions | GitHub/Trello-style editing experience; checklists are a first-class primitive. |
| Light + dark themes, system-matched, from v0 | Both are first-class; neither is an afterthought. |
| Linear-grade quality bar; Linear + Trello as board inspiration | Polish is the differentiation. |

| Delegated to the implementation agent | Constraint |
|----|----|
| Internal architecture: state management, IPC patterns, indexing strategy | Built on the hand-reviewed Tauri foundation spike. |
| Component implementation details | Must match the design-system handoff bundle exactly. |
| Test strategy, tooling, CI setup | PR-level human review; manual deploys. |

**Kept in human hands regardless:** the on-disk file format & data model spec, and the initial Tauri architecture spike. Both are specced/reviewed manually before mass ticket execution.

### Non-goals

#### What v0 is not

- No cloud sync, no team projects, no billing — v0 is local-only.
- No integrated terminals yet — they arrive after v0, ahead of team sync.
- No Windows/Linux builds yet.
- No web or mobile client.
- Not a git host, code review tool, or chat product.
- Not a generic PM tool for non-technical teams — the repo-adjacent, agent-first workflow is the point.

### Open questions

#### Tensions to resolve

**1. "In the repo" vs. `.gitignore` on sync — parked.** The founding thesis is "tickets live in your git repo" — diffable, versioned, traveling with the code — while enabling cloud sync advises git-ignoring the folder, which removes those properties for synced teams. **Decision deferred to the team-sync phase.** One constraint carries forward now: the v0 file format spec should avoid choices that foreclose a git-friendly, merge-tolerant answer later.

**2. Exact file format.** Markdown + frontmatter vs. alternatives; index and CLI story. **Timing:** **[decided]** hand-specced after the design prototype is built and reviewed, and before mass ticket execution begins.

*Resolved:* product name — **LongClaw**. Signup model — settled as pure Obsidian (no account for local use, optional signup in UI, account required only for sync). See Accounts.

### Sequencing

#### Phasing & MVP boundary

The vision above explains *why*; this layer says *what order*. Anything not listed in the current phase is out of scope for that phase's tickets, even if the vision describes it — this is the guard against gold-plating early work with future-phase concerns.

##### Phase 0  Foundations — human-led, before mass ticket execution

Ordered — design comes first, and the format spec follows the reviewed prototype:

1.  **Design system → screens → handoff bundle** — brand/design system in Claude Design first, then the core screens; iterate until the prototype is reviewed and settled; export the handoff bundle and commit it to the repo alongside this doc.
2.  **File format & data model spec** — hand-specced and reviewed *after* the design prototype review (the reviewed screens reveal what the data model must express), and *before* mass ticket execution. Carries the one constraint from the parked sync question: don't foreclose a git-friendly, merge-tolerant answer later.
3.  **Tauri v2 architecture spike** — project structure, state management, IPC patterns, file watcher ↔ index interaction. Leave room in the IPC design for streaming PTY channels, so Phase 2 terminals extend this skeleton rather than fight it.

##### Phase 1  v0: Local core — the MVP boundary

- macOS app (Tauri v2), **local projects only**: select a folder, create a project, work.
- File format read/write, local index, and file watcher — the app and any external agent editing the files stay in sync.
- Side panel with local and starred projects. Teams/cloud entries: not built, not stubbed.
- Issue list, board, ticket side panel, command palette — at the Linear-grade bar.
- Optional **Sign up** button wired to the sync waitlist. No account required, no telemetry.

**Ship point (mandatory milestone, mid-v0):** as soon as the first vertical slice works — one project, one board, tickets round-tripping through the file format with a real agent — put it in front of a handful of Claude Code / Cursor users. Their reaction reshapes the remaining ticket list before the rest of the backlog executes. The vision layer stays stable; this sequencing layer is what absorbs the feedback.

##### Phase 2  Integrated execution — terminals

- Embedded terminal panel (xterm.js + Rust PTY), multiple terminals in a tabbed UI.
- Terminal↔ticket linkage (app state only) with fluid navigation between a ticket and its session.
- Launch an agent execution for a ticket directly from the app; context read from disk, results written back to the ticket.

##### Phase 3  Sync & teams — the paid layer

- Accounts become functional beyond the waitlist; cloud sync opt-in per project; billing.
- Teams and team projects appear in the side panel; `.gitignore` guidance shown on sync enable.
- **Gate:** resolve the parked "in the repo vs. `.gitignore`" question before building sync — it determines the sync architecture.

##### Someday  Explicitly deferred

- Windows and Linux builds — after the Mac experience is excellent (note the Rust-PTY Windows rough edges for the terminal port).
- Anything else the vision doesn't name — integrations, web/mobile, automations — requires a deliberate addition to this doc first.
