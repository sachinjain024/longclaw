---
title: "LongClaw Website — Content Brief"
product: LongClaw
status: draft-for-review
ticket: LC-205
purpose: >
  Input for Claude Design. Every claim below is sourced from the repo
  (README, docs/vision.md, docs/design_brief.md, docs/user-guide.md,
  docs/release-notes/v0.1.0.md). Review, then we turn this into
  per-page Claude Design prompts.
---

# LongClaw Website — Content Brief

The website is the public home of LongClaw at **longclaw.io**: product marketing, documentation, CLI docs, blog, and changelog, generated from the existing Design System in Claude Design and implemented via Claude Code (LC-205).

---

## 1. Brand foundation

*The website must feel like the product: it is an extension of the existing Design System, not a new visual language.*

- **Name & domain:** LongClaw · `longclaw.io`
- **Mark:** the original abstract/geometric owl (watchful guardian over your work). Assets exist in `assets/brand/app-icon/` — `in-app/longclaw-mark-ochre.png`, `in-app/longclaw-mark-white.png`, `in-app/app-tile-rounded-512.png`.
- **Personality (five words):** precise, fast, calm, engineered, warm-technical. Linear's restraint, never sterile. Density with breathing room; motion communicates state, never decorates. Calm wins every tie.
- **The distinctive hook — two actors, two hues:** human accent (indigo family) for planning; agent accent (green family) for agent activity. The green agent accent is constant across all themes. The website should use this pair to tell the story visually.
- **Themes:** five presets — Indigo (default), Clay, Slate, Plum, Graphite — each defined in light and dark, all five shipped in the app. Light and dark are both first-class; the site should ship in both, system-matched.
- **Website accent — ochre, not Indigo.** The site's primary theme is ochre (the brand-mark color, #B45F06, `longclaw-mark-ochre.png`), warm and distinct from the app's default Indigo. **A separate ochre-based website Design System already exists in Claude Design** — the site is generated from it, not from the app's DS. Before page generation, run an audit pass on it (Prompt 0 in `website-prompts.md`): confirm the ochre matches the brand mark, add the constant green agent accent (#12946A) if missing, and verify light/dark completeness, the mono register, display sizes, and AA contrast.
- **Typography feel:** grotesque with character for display, workhorse sans for UI, and monospace wherever the file-on-disk nature shows through — ticket IDs, file paths, frontmatter-style metadata. Mono metadata is the file-native signature; use it on the website too.

## 2. Positioning & messaging

**Tagline — candidates (undecided; pick at prompt time):**

1. "One canvas where humans plan and agents execute." *(from vision.md — shortest, most evocative)*
2. "Local-first issue management for humans and AI agents." *(clearest description; strong as the SEO title / subline)*
3. "A project management canvas for humans & AI agents."
4. "Local-first issue tracking where humans plan and AI agents execute." *(merges 2 and 1)*

**Recommended pairing:** an evocative headline (1 or 4) with the descriptive line as the sub — a short thesis plus a plain explanation covers both the "what is this" and "why care" jobs. "The context layer for agents in spec-driven development" is not the tagline but earns its own section on the homepage (fits naturally in the "Built for agents" section, §4.1).

**Supporting line (from the README):**
> A local-first project manager for humans and AI agents. Humans plan and stay accountable for tickets; agents execute and contribute their context back to the same ticket record — stored beside the code as Markdown files you own.

**Audience:** AI-native startups (~3–15 people) doing agent-driven or spec-driven development. Solo builders using Claude Code or Cursor are the entry point.

**The problem it solves:** planning and execution have bifurcated. Humans plan in Linear/Jira/Notion — a cloud database far from the code. Agents execute in the git repo with no visibility into the plan. Tickets become stubs; agents start every session without context. LongClaw puts both on the same canvas.

**Key messages (in priority order):**

1. **Files on disk are the source of truth.** A ticket is a directory of plain Markdown inside your project — readable in an editor, diffable in review, committed with the work it describes. The record outlives the app. The quality bar is Linear; the data model is Obsidian.
2. **The format is designed for agents first.** `.longclaw/AGENTS.md` is generated into every project so an agent that has never seen LongClaw can read and edit tickets correctly. Every activity entry is attributed — human or agent, never guessed.
3. **Humans and agents are peers — but assignees are always human.** Agents comment, update descriptions, and check off checklist items; accountability stays with a person. Human and agent are visually distinct everywhere it matters.
4. **Truly local.** No account, no sign-in, no telemetry, no crash reporting, no network connection — not a mode, but what the app is capable of. Nothing about your projects leaves your machine.
5. **Linear-grade polish.** Keyboard-first (⌘K palette, full lifecycle without a pointer), a board and a dense list over the same tickets, five themes in light and dark.
6. **Open source.** Client licensed MPL 2.0, built in the open. The repo tracks its own work with LongClaw — every `LC-*` ticket in `.longclaw/tickets/` is the product being used on itself. (Great proof point for the site.)

**Voice & tone:** calm, precise, honest — the docs voice already in the repo ("That is not a mode; it is what the app is capable of"). No hype words, no exclamation marks. Honest about being files; honest about v0's limits (see §6).

## 3. Sitemap

| Page | Route (proposed) | Primary source |
|---|---|---|
| Home | `/` | README, vision.md |
| Product docs | `/docs` | docs/user-guide.md, docs/file_format.md, release notes |
| CLI docs | `/docs/cli` | README CLI section, docs/agents/issue-tracker.md |
| Blog | `/blog` | new content (seed ideas in §4.4) |
| Changelog | `/changelog` | docs/release-notes/v0.1.0.md |
| Roadmap | `/roadmap` | vision.md phases — *design for completeness, NOT live at launch (see §4.6)* |

**Global nav (launch):** Docs · CLI · Blog · Changelog · GitHub (icon) · **Download for Mac** (primary button). *Roadmap stays out of the nav at launch (decided: no upcoming features or pricing on the live site for now). No pricing page is designed at all — it belongs to Phase 3 and would be redesigned anyway.*
**Footer:** GitHub repo (`github.com/sachinjain024/longclaw`), MPL 2.0 license, blog/changelog/roadmap links, the owl mark.

## 4. Page-by-page content

### 4.1 Home

**Hero.** Headline: "One canvas where humans plan and agents execute." Sub: the README supporting line above. CTAs: **Download for Mac** (primary) + **View on GitHub** (secondary). Under the CTAs, mono small print: `macOS 13+ · Apple Silicon · no account required`. Hero visual: the board screenshot (see §5) — ideally shown in two themes and/or light+dark to demonstrate theming.

**Section — The problem** (two columns): "Planning — humans" (Linear/Jira/Notion, far from the code) vs "Execution — agents" (in the repo, no visibility into the plan). Close with: the ticket becomes a stub; the agent starts blind. Use human-accent / agent-accent colors on the two columns.

**Section — Your tickets are files.** Show the on-disk tree (mono, from the README):

```
your-project/
└── .longclaw/
    ├── longclaw.yaml     project identity, people, labels
    ├── AGENTS.md         the editing contract agents read
    └── tickets/
        └── LC-42/
            ├── ticket.md      the complete record
            └── attachments/
```

Copy: one file holds everything — metadata, description, checklist, comments, activity. Readable without the app, forever.

**Section — Feature grid** (from README "What it does"):

- *Two views over the same tickets* — a board grouped by status and a dense list readable at a few thousand rows; filtering, grouping, ordering.
- *A ticket panel that edits in place* — Markdown descriptions with toolbar and tables; drag-reorder checklists; archive without deleting.
- *Keyboard-first* — ⌘K command palette over every action; the whole lifecycle without a pointer; ⌘Z undo from a toast.
- *It notices when an agent edits a file* — native watcher, board updates without refresh, decaying acknowledgement ring showing actor and age, conflict banner before anything is overwritten.
- *Human and agent, visually distinct* — everywhere it matters, in five themes across light, dark, and system.
- *A real CLI* — the same crate as the app; JSON on stdout, typed errors, explicit agent attribution.

**Section — Built for agents.** `.longclaw/AGENTS.md` teaches any agent the editing contract; activity is append-only and attributed; this repo tracks itself with LongClaw. Show a short `ticket.md` excerpt with an agent activity event (agent-accent highlight).

**Section — Local-only, by construction.** No account, no telemetry, no network. The only thing stored outside your project is the list of folders you've opened. MPL 2.0, build from source if you prefer.

**Section — Principles strip** (from README): files on disk are the source of truth · format designed for agent reads/writes · humans and agents collaborate, assignees stay human · Linear-grade speed and polish · no account, no telemetry.

**Closing CTA:** Download for Mac + GitHub, repeat requirements line.

### 4.2 Product docs (`/docs`)

Structure mirrors `docs/user-guide.md` (already written in the right voice):

1. **Getting started** — download, and the honest Gatekeeper walkthrough from the release notes (unsigned build: Done → Privacy & Security → Open Anyway; never disable Gatekeeper system-wide). Requirements: macOS 13+, Apple Silicon only.
2. **Your project folder** — the `.longclaw/` layout; LongClaw writes inside `.longclaw/` and nowhere else.
3. **What a ticket is** — ticket.md anatomy: frontmatter, description, checklist, attachments, activity. Status set: backlog/todo/in_progress/in_review/done/canceled. Priorities: urgent/p1–p4/none.
4. **Backups and version control** — tickets travel with the repo.
5. **Working with agents** — the AGENTS.md contract, `--agent-id` attribution, watcher acknowledgements, conflict handling.
6. **When something goes wrong** — visible recovery: unparseable files shown raw with a diagnostic, never auto-repaired or overwritten.
7. **File format reference** — condensed from `docs/file_format.md` (the canonical contract).

### 4.3 CLI docs (`/docs/cli`)

From the README CLI section and `docs/agents/issue-tracker.md`. Cover: build instructions; `project init`, `label add`, `ticket create`, `ticket edit`, `ticket list`; JSON on stdout, non-zero typed errors; labels must be defined before use; **agents must pass `--agent-id`** or the activity claims a human did it. **Agents create tickets through the CLI** (ADR 0011: the CLI is the creation surface agents use) — the CLI allocates the key and attributes the work, so an agent never invents a ticket key.

### 4.4 Blog (`/blog`)

No posts exist yet. Design: index + post template (title, date, author, mono metadata). Seed ideas for launch: "Introducing LongClaw" (v0.1.0 announcement) · "Why your tickets should live in your repo" (the thesis) · "Designing a file format agents can't corrupt" (from file_format.md) · "LongClaw tracks itself" (dogfooding story).

### 4.5 Changelog (`/changelog`)

Reverse-chronological entries. First entry: **0.1.0** from `docs/release-notes/v0.1.0.md` — the local core; board + list, ⌘K, watcher, visible recovery, five themes light and dark, local-only boundary; known limitations. *(Note: the release notes are still draft with three named blockers — the site copy stays draft until acceptance clears.)*

### 4.6 Roadmap (`/roadmap`) — designed, not live

**Decided:** the live site shows no upcoming features and no pricing at launch. Still design this page for completeness (it costs little while the design system is open, and LC-205 lists it): a simple static page from vision.md phasing — **Shipped** v0 local core → **Next** Phase 2 integrated terminals → **Later** Phase 3 sync & teams → **Someday** Windows/Linux, custom themes. It ships unlinked/unpublished until we decide to go public with the roadmap (hosting question also parked).

## 5. Assets

- **Logo/marks:** `assets/brand/app-icon/in-app/` (ochre + white marks, rounded 512 tile); full icon set in `assets/brand/app-icon/icons/`.
- **App screenshots — reference only (decided):** the website embeds no screenshots; product visuals (board, ticket panel, file trees, terminal blocks) are recreated as token-driven HTML components in the design system, with `apps/desktop/dist-matrix/` shots attached as fidelity reference. This makes visuals crisp, theme-aware (five-preset demo = accent-token swap), and lightweight. *The missing Graphite shots in dist-matrix no longer block anything — the recreated component renders Graphite from tokens.*
- **Design-prototype renders (richer states):** `docs/design/prototype/renders/` — welcome, panel, agent-acknowledged, conflict, raw-file screens.
- **Links:** GitHub `https://github.com/sachinjain024/longclaw` · Download `LongClaw_0.1.0_aarch64.dmg` (URL TBD — GitHub Releases assumed) · License MPL 2.0.

## 6. Honesty constraints (do not oversell)

The site must not promise what v0 doesn't do: no terminals yet (Phase 2), no sync/teams/accounts/billing (Phase 3), no Windows/Linux/Intel builds, no custom themes, no hard deletion; the app doesn't open links in a browser; the build is unsigned (documented openly, as the release notes do). Release notes are draft until the three acceptance blockers clear — the Download CTA should go live only when a real release exists.

## 7. Decisions taken · open items

**Decided (2026-08-22):** five theme presets (Graphite included) — repo docs corrected · agents DO create tickets, via the CLI — repo docs corrected · website primary accent is ochre, generated from the existing separate ochre website Design System in Claude Design (audited via Prompt 0, not created) · no upcoming features or pricing on the live site at launch; roadmap page designed for completeness but not linked or published · no pricing page designed at all · tagline candidates listed in §2, final pick at prompt time.

**Still open:**

1. **Sync waitlist:** vision.md wires an optional sign-up to a sync waitlist. An email capture leans "upcoming feature" — likely skip at launch to stay consistent with the no-upcoming-features call. Confirm.
2. **Download link:** GitHub Releases, or a hosted download? Affects the CTA.
3. **Docs depth at launch:** full file-format reference on the site, or link to the repo doc for v1 of the site?
4. **Blog at launch:** ship with the announcement post only, or design-only until a post exists?
