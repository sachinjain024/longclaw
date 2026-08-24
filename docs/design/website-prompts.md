---
title: "LongClaw Website — Claude Design Prompts"
product: LongClaw
status: ready
ticket: LC-205
companion: website-content-brief.md
---

# LongClaw Website — Claude Design Prompts

Run these **in order, inside the "LongClaw Website" design system** in Claude Design — the separate ochre website DS (updated 13 Aug), NOT "LongClaw DS v3 — system", which is the app's. Prompt 0 audits and aligns the website system once; every page prompt after it assumes the audit passed. Attach the listed assets with each prompt. Review each page before running the next — the homepage sets the visual direction for everything downstream.

All copy inside the prompts is final-reviewed from the repo (see `website-content-brief.md` for sources). Paste each prompt verbatim; edit copy in the brief first if something reads wrong.

**Product visuals policy (decided):** the website embeds **no screenshots**. Every product visual — the board, the ticket panel, file trees, terminal blocks — is **recreated as a native HTML component** inside the design system, styled with its tokens. Attached app screenshots are *reference material for fidelity only*, never assets to place. This makes product visuals crisp at any DPI, theme-aware (light/dark and the five-preset demo become token swaps), and tiny; the exported components hand straight to Claude Code as reusable site components. Keep recreations *simplified and idealized* — legible at marketing scale, faithful in structure and accent usage, not pixel-perfect replicas that drift from the app.

---

## Prompt 0 — Audit & align the ochre website design system

*The ochre website DS already exists in Claude Design as **"LongClaw Website"**. This prompt does not create a palette — it verifies that system carries everything the LongClaw brand story requires, and adds only what is missing. (The app's "LongClaw DS v3 — system" is untouched by all of this.)*

**Attach:** `assets/brand/app-icon/in-app/longclaw-mark-ochre.png`, `longclaw-mark-white.png`, `app-tile-rounded-512.png`, plus one app screenshot (`board-clay-light.png`) so the DS can be checked for kinship with the product.

```
Audit this design system against the LongClaw brand requirements below and fix
only the gaps — no redesign of what already works. This system will generate
the longclaw.io marketing site and docs; the app has its own separate design
system, and the two must read as siblings, not strangers.

Check each item; where the system already satisfies it, leave it alone; where
it does not, add the missing tokens or rules:

1. BRAND OCHRE. The brand mark's ochre is #B45F06 (the attached app icon is
   white on #B45F06). Confirm the system's primary accent matches it or is a
   deliberate, close derivation — if it drifts noticeably, align the brand-hue
   token to #B45F06 and keep the system's adjusted steps for text and buttons.

2. THE AGENT ACCENT. LongClaw's one distinctive brand hook is two actors, two
   hues: a human accent and a GREEN agent accent (working value #12946A) that
   stays constant everywhere. On the website, ochre plays the human side. Add
   an agent-green token pair (light + dark, plus a soft wash) if the system
   lacks one — it marks agent activity in ticket excerpts, code annotations,
   and the two-actor problem section on the homepage.

3. LIGHT AND DARK, BOTH FIRST-CLASS. Every token must be defined in both
   appearances, system-matched. If the system is single-appearance today,
   complete the missing side.

4. THE MONO REGISTER. The file-native signature: ticket IDs, file paths,
   terminal/code blocks, small metadata rows set in monospace. Confirm a
   monospace face and usage rule exist; add them if not.

5. DISPLAY SCALE. Marketing pages need larger display sizes than product UI.
   Confirm the type scale reaches hero-headline sizes; extend it if not.

6. ACCESSIBILITY. Ochre-on-surface text and white-on-ochre buttons must pass
   WCAG AA in both appearances. If raw #B45F06 fails as a text color, keep the
   brand hue for large marks and washes and provide passing text/button steps.

Personality guardrails throughout: precise, fast, calm, engineered,
warm-technical. Linear-family restraint; density with breathing room; calm
wins every tie. No gradients-for-drama, no decorative motion.

Deliver: a short gap report (what was already right, what was added), the
final token set for light + dark, and one sample marketing section rendered in
both appearances to prove the tokens.
```

---

## Prompt 1 — Homepage

**Attach (reference only — see product visuals policy):** `longclaw-mark-ochre.png`, `longclaw-mark-white.png`, `apps/desktop/dist-matrix/board-clay-light.png`, `board-clay-dark.png`, `board-indigo-light.png`, `board-indigo-dark.png`, plus 2–3 more theme boards (`board-slate-*`, `board-plum-*`) so the recreated board component is faithful across themes.

```
Design the LongClaw homepage (longclaw.io) using the website marketing palette
(ochre primary, green agent accent) in BOTH light and dark. Desktop-first,
responsive down to mobile. Calm, precise, engineered — Linear-family restraint
with our own ochre handwriting. Use the monospace register for ticket IDs, file
paths, code, and small metadata everywhere it appears.

STRUCTURE AND COPY (use this copy verbatim):

1. NAV: owl mark + "LongClaw" · Docs · CLI · Blog · Changelog · GitHub icon ·
   primary button "Download for Mac" (ochre).

2. HERO:
   Headline: One canvas where humans plan and agents execute.
   Sub: A local-first project manager for humans and AI agents. Humans plan and
   stay accountable for tickets; agents execute and write their context back to
   the same ticket record — stored beside the code as Markdown files you own.
   CTAs: [Download for Mac] (primary, ochre) · [View on GitHub] (secondary).
   Under CTAs, mono small print: macOS 13+ · Apple Silicon · no account required
   Visual: NOT a screenshot — recreate the LongClaw board as a simplified HTML
   component in a macOS window frame, built from design-system tokens: three
   status columns, a handful of ticket cards with mono IDs (LC-42 style),
   priority glyphs, label chips, one card wearing the agent-edit
   acknowledgement ring in agent green. Use the attached screenshots as the
   fidelity reference. It must re-render correctly in light and dark from
   tokens alone.

3. THE PROBLEM — two columns, human accent vs agent accent:
   Left (ochre, "Planning — humans"): Happens in Linear, Jira, or Notion.
   Humans decide what to build, file bugs, and track status — in a cloud
   database far from the code.
   Right (green, "Execution — agents"): Happens in the git repo. Claude Code,
   Cursor, and other agents do the actual work and open PRs — with no
   visibility into the plan.
   Closing line, full width: The ticket becomes a stub. The agent starts every
   session blind. LongClaw puts both on the same canvas.

4. YOUR TICKETS ARE FILES — split section: left copy, right a mono file tree:
   Copy: A ticket is a directory of plain Markdown inside your project —
   readable in an editor, diffable in review, committed with the work it
   describes. One file holds everything: metadata, description, checklist,
   comments, activity. The record outlives the app.
   File tree (mono, real):
   your-project/
   └── .longclaw/
       ├── longclaw.yaml     project identity, people, labels
       ├── AGENTS.md         the editing contract agents read
       └── tickets/
           └── LC-42/
               ├── ticket.md      the complete record
               └── attachments/

5. FEATURE GRID — six cards, short titles + 1–2 lines each:
   · Two views over the same tickets — A board grouped by status and a dense
     list that stays readable at a few thousand rows. Filtering, grouping,
     ordering.
   · A ticket panel that edits in place — Markdown descriptions with a
     formatting toolbar and tables. Checklists reorder by drag. Archive
     without deleting.
   · Keyboard-first — ⌘K opens a palette over every action. The whole ticket
     lifecycle completes without a pointer. ⌘Z undoes from a toast.
   · It notices when an agent edits a file — A native watcher updates the board
     without a refresh, attributed to whoever made the change. Conflicts are
     shown before anything is overwritten.
   · Human and agent, visually distinct — Everywhere it matters, in five themes
     across light, dark, and system appearance.
   · A real CLI — The same crate as the app. JSON on stdout, typed errors,
     explicit agent attribution.

6. BUILT FOR AGENTS — section heading: The context layer for spec-driven
   development. Copy: .longclaw/AGENTS.md is generated into every project, so
   an agent that has never seen LongClaw can read and edit tickets correctly
   without being told how. Activity is append-only and attributed — human or
   agent, never guessed. Agents create tickets through the longclaw CLI, which
   allocates the key and requires --agent-id.
   Proof line: This repository tracks its own work with LongClaw. Every LC-*
   ticket in it was filed through the same contract your agents will read.
   Visual: a short ticket.md excerpt (mono) with one agent activity event
   highlighted in the green agent accent.

7. LOCAL-ONLY, BY CONSTRUCTION — quiet, confident section:
   LongClaw works with no account and no network connection. That is not a
   mode; it is what the app is capable of. No sign-in, no cloud, no telemetry,
   no crash reporting. Nothing about your projects leaves your machine.
   Footer of section: Open source under MPL 2.0. Build it from source if you
   prefer.

8. THEMES STRIP — the SAME recreated board component rendered across the five
   theme presets (Indigo, Clay, Slate, Plum, Graphite) as accent-token swaps —
   no screenshots. One line: Five themes, light and dark, per project. This
   strip doubles as proof that the component is fully token-driven.

9. CLOSING CTA: Download for Mac + View on GitHub, repeat the mono
   requirements line.

10. FOOTER: owl mark · Docs · CLI · Blog · Changelog · GitHub
    (github.com/sachinjain024/longclaw) · MPL 2.0.

DO NOT include: pricing, upcoming features, roadmap links, terminals, sync,
teams, accounts, Windows/Linux. The site sells what v0.1.0 does today, nothing
more. No testimonials, no fake logos, no invented metrics.
```

---

## Prompt 1a — "Built for agents" as an interactive feature tour (v2, 2026-08-23)

*Run after Prompt 1's homepage exists. Supersedes the section-6 copy above. v1 of this prompt (a static full-ticket card) is retired: one card could not carry the whole anatomy at readable scale. v2 is a four-state feature tour — left tiles select which facet of the ticket the right card shows; states auto-advance until the user takes over. The generated heading "The context layer for your AI agents" is kept. Design delivers the four states + interaction spec; the timer/click behavior itself is implemented by Claude Code from that spec.*

```
Revise the "Built for agents" section (heading: The context layer for your AI
agents) into an INTERACTIVE FEATURE TOUR. Keep the heading, eyebrow, and
two-column layout. One claim drives it: the ticket is the source of truth for
the complete picture.

Lead line under the heading:
  Everything an agent needs — and everything it learns — lives on the ticket.
  Product plan, wireframes, implementation details, nuances, what got
  descoped. Not scattered across chat threads and doc tools: structured
  Markdown, in your repo.

LEFT COLUMN — four selectable tiles (tab semantics, vertical stack). Each is
a quiet card: short title + one-line sub. Active tile: ochre left rail +
subtle progress fill showing time to auto-advance. Inactive: neutral.

  1. A living description
     Agents update the description as their understanding evolves.
  2. References
     Commits, PRs, product plans, wireframes — linked from the ticket.
  3. Execution plan
     Agents build the checklist and check items off as they work.
  4. Humans and agents, collaborating
     Feedback flows through the ticket, both directions.

RIGHT COLUMN — one constant mono card shell (header: tickets/LC-42/ticket.md,
fixed height, token-driven, light + dark). Only the card BODY swaps per
selected tile. Design all four states:

  State 1 — Description: frontmatter row (LC-42 · in-progress · high), then a
  short agent-written description that clarifies the ticket: scope, approach,
  one nuance, one line noting what was descoped. Attribution row in agent
  green: "description updated by claude-code".

  State 2 — References: same description body, now ending in a refs block of
  mono link rows: PR #214 · docs/product-plan.md · ux/wireframe-v2.png ·
  docs/execution-plan.md. Links in ochre.

  State 3 — Execution plan: a checklist: two items checked in agent green,
  one unchecked, and one reading "HUMAN GATE: approve copy tone" highlighted
  in the ochre human accent — decisions that stay yours.

  State 4 — Collaboration: a comment thread: sachin leaves feedback,
  claude-code replies with what it changed (attributed with the AGENT chip in
  green), sachin confirms. Close with one appended activity line.

Closing line under the section:
  The ticket is committed with the code. The full context gets structure,
  attribution, and permanence.

INTERACTION SPEC (annotate for implementation): states auto-advance 1→2→3→4→1
every ~6s with the progress fill; hover pauses; a manual tile click selects
that state and STOPS auto-advance permanently; body swap is a ~250ms
cross-fade, no slide theatrics; honor prefers-reduced-motion by disabling
auto-advance and fading instantly; tiles are keyboard-operable tabs. State 1
is the default and must render without JavaScript.

Calm wins every tie: no screenshot imagery, no second visual, no type
shrinking — if a state feels dense, trim its content.
```

---

## Prompt 2 — Docs page template + Getting started

**Attach:** none required (optionally `panel-indigo-light.png` from `docs/design/prototype/renders/` as reference if a ticket-panel component is recreated for illustration).

```
Design the documentation layout for longclaw.io/docs using the website
marketing palette, light and dark: left sidebar nav, readable measure content
column, right-hand on-this-page rail on wide screens. Docs voice is calm and
honest; code and file paths in mono; ochre links; notes/warnings as quiet
bordered blocks, not colored alarms.

Sidebar sections: Getting started · Your project folder · What a ticket is ·
Backups and version control · Working with agents · When something goes wrong ·
File format reference · CLI.

Design the GETTING STARTED page as the worked example, with this real content:
- Requirements: macOS 13 or later, Apple Silicon. Mono callout.
- Download: LongClaw_0.1.0_aarch64.dmg from GitHub Releases.
- "Opening the app the first time": step-by-step block explaining the unsigned
  build honestly — macOS will warn; click Done (never "Move to Bin"); System
  Settings → Privacy & Security → Open Anyway; macOS remembers the decision.
  Include the warning-styled note: Do not disable Gatekeeper system-wide; both
  routes approve this one app only.
- End with: point LongClaw at a folder; it creates .longclaw/ and writes
  nowhere else. Show the mono file tree.
```

---

## Prompt 3 — CLI docs page

```
Using the docs layout, design the CLI reference page (longclaw.io/docs/cli).
Terminal-flavored but calm: mono-heavy, command blocks with copy buttons,
output shown as JSON. Real content:

Intro: The same crate the app uses ships as a command-line binary — key
allocation, the write seams, and the file format have exactly one
implementation. This is how an agent files and updates work.

Command walkthrough (one block each, with a one-line explanation):
  longclaw project init --name "My Project" --key MP
  longclaw label add --slug storage --name Storage
  longclaw ticket create --title "Fix the retry policy" --label storage \
    --checklist "Reproduce it" --agent-id claude-code --agent-name "Claude Code"
  longclaw ticket edit MP-1 --status in_progress --agent-id claude-code
  longclaw ticket list

Rules section (three short cards):
· JSON on stdout — every command prints JSON and exits non-zero with a typed
  error on failure.
· Labels are defined before use — the CLI refuses a slug the project does not
  define.
· Agents pass --agent-id — the file format declares an actor and never infers
  one; without it, the activity entry claims a human did the work. The CLI is
  the creation surface agents use: it allocates the ticket key, so an agent
  never invents one.
```

---

## Prompt 4 — Blog index + post template

```
Using the site's language, design longclaw.io/blog: an index page and a post
template. Index: simple reverse-chronological list — title, date (mono), one-
line summary. No cards-with-thumbnails; text-forward, Linear-blog restraint.
Post template: readable measure, mono metadata row (date · author), ochre
links, code blocks in mono, optional full-width screenshot slot.

Populate the index with the first planned post only:
  "Introducing LongClaw" — One canvas where humans plan and agents execute.
  The v0.1.0 announcement.
```

---

## Prompt 5 — Changelog page

```
Design longclaw.io/changelog: one page, reverse-chronological releases, each
with a mono version anchor, date, and grouped bullets. Quiet, factual, docs
voice. Populate with the real 0.1.0 entry:

0.1.0 — the local core
· Create, edit, and organise tickets on a board and a dense list, with a
  keyboard path through the whole lifecycle.
· Search and filter across the project, with a command palette on ⌘K.
· Watch the project folder, so an edit made by an agent or an editor appears
  without a refresh, attributed to whoever made it.
· Recover visibly from unparseable files, conflicting edits, moved folders,
  and a corrupt project list — always without overwriting your file.
· Five themes across light and dark, following your system appearance.
Known limitations: links open outside the app · attachment removal keeps bytes
recoverable, no purge yet · agents create tickets via the CLI, not in-app.
Requirements: macOS 13+, Apple Silicon.
```

---

## Prompt 6 — Roadmap page (designed, NOT published)

```
Design longclaw.io/roadmap for completeness — this page will NOT be linked or
published at launch. Simple static page, four quiet columns or rows:
Shipped (v0 local core — the app described on the homepage) · Next (integrated
terminals: launch an agent run for a ticket from inside the app) · Later
(cloud sync and teams, opt-in per project — local stays free forever) ·
Someday (Windows and Linux, custom themes).
No dates, no percentage bars, no committed promises — statements of sequence,
not schedule.
```

---

## After design review

Export the approved pages from Claude Design and hand them to Claude Code with the implementation half of LC-205: implement in the repo, deploy, then build the maintenance skills (docs, changelog, website changes). Keep the exported bundle committed under `docs/design/` like the app's handoff bundle. The implementation prompt should treat the recreated product visuals (board, panel, file tree, terminal blocks) as **reusable components** — extracted once, token-driven, rendered wherever a page needs them — not as per-page markup to copy around.
