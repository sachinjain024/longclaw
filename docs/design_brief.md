---
title: "LongClaw — Design Brief"
product: LongClaw
companion_to: vision.md
consumer: "Claude Design" # feed both docs together
status: canonical
format: markdown
scope: "design system + v0 screens + shell for Phase 2"
lineage: "final-approved uses Iteration 1 / Appendix A as its base; the discarded Clay redesign contributes only the Clay preset"
iterations_included:
  - final-approved
  - iteration-1-historical
---

# LongClaw — Design Brief

> **Canonical document.** The final approved iteration is the source of truth for design and implementation. Iteration 1 is retained at the end as historical context. The abandoned intermediate exploration is intentionally omitted.

> **Claude Design instruction.** Feed `vision.md` and `design_brief.md` together. “Iteration 1” and the earlier shorthand “v1 design system” refer to the Linear-family foundation preserved in Appendix A.

## Final approved iteration

> **Design brief for the prototype**

This document translates the vision into what a designer needs: brand direction, ticket anatomy, surfaces, flows, and states. Items marked **[decided]** are settled; items marked **[proposed]** are sensible defaults awaiting founder approval — flag them in the first design review rather than silently diverging.

**The direction is settled.** The calm, Linear-family foundation from Iteration 1 remains; the noisier full-redesign exploration is discarded. This final iteration moves every accent color into **swappable project-theme tokens** and asks for **subtle, minor departures only** — no redesigns, no new visual language.

> **Two surfaces below are cut from the v0 build.** The **terminal region** is not shown in v0 at all — no handle, no reserved geometry (LC-74, 2026-08-06) — and the **waitlist** is cut (LC-75, confirming the 2026-08-01 parking of Step 15). Both are still *designed*, and this brief still describes them, because the work is postponed rather than abandoned. Nothing below is an instruction to build either one in v0. The governing scope statement is `design/prototype/screen-specs.md` § Cut from v0.



## Brand direction

### Personality & feel

**Product name & domain:** **[decided]** **LongClaw** · `longclaw.io`.

**Logo & icon:** **[decided]** an **owl** mark — the namesake nod is Longclaw, the owl character from the Sonic universe. Design an **original, abstract/geometric owl** that channels the qualities (wise guardian, watchful, swift) rather than the character itself: no reproduction or close likeness of the Sega/Paramount design, its color scheme, or its silhouette — that character is protected IP, and the mark must stand on its own. A restrained, sharp-edged owl reads perfectly against the precise, engineered personality below, and the "watchful guardian over your work" idea gives the brand a story that fits a tracker.

**Personality in five words:** precise, fast, calm, engineered, warm-technical. The product should feel like a well-made tool — closer to Linear's restraint than Trello's playfulness, but never sterile. Density with breathing room; motion that communicates state, never decorates.

**Base direction:** **[decided]** **keep the Iteration 1 design system** — its palette structure, typography, geometry, component language, and overall calm. It is the reviewed and preferred foundation. The two changes this revision asks for: (a) accent colors become **theme tokens** (section 02), and (b) a handful of **subtle differentiators**, below.

**The one distinctive brand hook — two actors, two hues.** The product's thesis is a shared canvas for humans and agents. Encode it visually: a **human accent** for planning actions and human-authored content, and an **agent accent** for agent activity — agent comments, agent-made edits, live checklist updates, and (Phase 2) terminal chrome. Used with restraint, this makes agent presence legible at a glance and gives the brand a story no competitor has. **[decided]** The accent pair is no longer one hardcoded palette — it is a **project theme**; see section 02.

**Differentiation, lightly.** **[decided]** We are staying in Linear's family on purpose; the goal is not to look unlike Linear, it is to not be mistaken for it at a glance. That is carried by small things, not a redesign:

- **Theme tokens instead of Linear's indigo-on-dark chrome** — even the default Indigo theme is our own pair (indigo human + green agent), and it changes per project.
- **Mono metadata as the file-native signature** — IDs, file paths, timestamps, checklist counts in the monospace register. Push this slightly further than Iteration 1 did; it is true to the product and cheap.
- **The agent-accent surface** — no competitor has one; it is inherently ours wherever it appears.
- **Detail-level independence** — glyph weights, radii, spacing values are our own numbers, not pixel-matched copies. Familiar language, own handwriting.

What this explicitly does *not* ask for: a new UI typeface, inverted geometry, novel status/priority glyph systems, or any part of the abandoned redesign program. If a proposed departure makes a screen busier, drop it — **calm wins every tie**.

**Typography feel:** a grotesque with character for display, a workhorse sans for UI, and a monospace that appears wherever the file-on-disk nature shows through (ticket IDs, file paths, frontmatter-ish metadata). The mono accents are part of the identity — this is a tool that's honest about being files. The Iteration 1 choices stand.

**Appearance:** **[decided]** light and dark are both first-class from v0, system-matched by default with a manual override. Design every screen in both; neither is a derived afterthought. Appearance (light/dark) and project theme (accent pair) are independent axes — every theme preset defines both.

## Project themes

### Fixed presets, per-project, token-driven **[decided]**

Each project board carries a theme chosen from a **small fixed set of presets** — picked at project creation, changeable later. **No custom color pickers in Phase 0**; presets only. A theme is an accent pair: the human accent plus the agent accent, each with soft/tint variants, in both light and dark.

These are working reference values from the reviewed designs; final production hues remain subject to design-system validation.

| Preset | Human accent | Agent accent | Note |
|---|---:|---:|---|
| Indigo · default | `#4B4EE7` | `#12946A` | The Iteration 1 pair; this document is set in it |
| Clay | `#A9482C` | `#12946A` | Warm human accent retained from the Clay exploration |
| 2–3 additional presets | To be proposed | Green family; working value `#12946A` | Design system proposes; founder approves |

- **What varies per theme: the human accent.** **[proposed]** The **agent accent stays in the green family across all themes** so agent activity is instantly recognizable in every project — the differentiating surface never changes costume. (It also means "Clay + Green", "Indigo + Green", etc.) Flag at review if theme-specific agent hues test better; if they do, the agent hue must still never collide with status colors, especially Done-green.
- **Token architecture is a hard requirement.** Every accent usage in every component routes through theme tokens (`--accent-human`, `--accent-human-soft`, `--accent-agent`, `--accent-agent-soft`, hover/active variants). No component hardcodes a hue. Switching themes is a token swap and nothing else.
- **Neutrals, status colors, and warn/error colors are theme-independent** — they are system tokens shared by all themes, so boards stay legible and consistent regardless of preset.
- **Preset count:** **[proposed]** 4–5 total including Indigo (default) and Clay. Each must pass contrast (WCAG AA on both appearances) and must keep the human/agent pair distinguishable for common color-vision deficiencies.
- **Proof requirement:** render at least one core screen (the board) in two themes × two appearances before the system is called done. If anything breaks, the token architecture — not the screen — gets fixed.
- **Surfaces for choosing:** theme picker (preset swatches, no wheel) in project creation and project settings; **[proposed]** a `change project theme` command in the palette.

## Ticket anatomy

### The core object

| Field | Notes |
|----|----|
| ID | Short, human-readable, mono-styled (e.g. `PROJ-42`). Visible everywhere; copyable. |
| Title | Single line, the board/list anchor. |
| Description | **[decided]** Edited **in-app** with a GitHub/Trello-style markdown editor: write/preview, toolbar for common formatting, drag-in images later. Agents may also edit it; see activity rules below. |
| Checklist | **[decided]** First-class primitive, not just markdown syntax. The human→agent work interface: human writes items, agent checks them off during execution. Progress (3/7) surfaces on cards. |
| Status | **[proposed]** Backlog · Todo · In Progress · In Review · Done · Canceled. Board columns map to these. Quiet glyphs in the Iteration 1 manner; status colors are system tokens, identical across themes. |
| Priority | **[proposed]** Urgent · High · Medium · Low · None, with quiet Linear-style glyphs — monochrome except Urgent. A louder treatment was rejected as noisy; priority should be scannable, not loud. Draw the glyphs ourselves (own weights/geometry), keep the familiar language. |
| Assignee | **[decided]** **Always a human.** Agents are never assignees. |
| Labels | Free-form, colored, project-scoped. Label colors come from a fixed system ramp, not from the theme. |
| Comments & activity | Single merged timeline: human comments, agent comments, and change events (status, checklist, description edits). See next section. |
| Timestamps | Created / updated; relative display, mono-styled. |

## Agent presence

### How agents show up — the differentiating surface

This is the design problem no reference product solves, and the reason this app isn't a Linear clone. It is also where our identity is cheapest to establish — nothing exists to imitate here, so every decision is ours by default. Rules:

- **[decided]** **Humans own, agents contribute.** Agents appear only in the activity stream: comments, description edits, checklist check-offs, status updates. They never appear in the assignee slot.
- **Agent actions are visually distinct** — agent-accent tint, an agent badge/avatar treatment clearly different from human avatars. A scanning eye should separate human and agent activity instantly. **[proposed]** The agent accent stays constant across themes, so this reads the same in every project.
- **Live external updates are a designed moment.** In v0, agents edit files on disk from outside the app; the file watcher brings changes in. When a ticket updates externally, the card/panel should acknowledge it — a subtle pulse or highlight, an unobtrusive "updated by agent" affordance. This is the product's magic moment; design it deliberately, don't let it be a silent re-render.
- **Description edits by agents** appear in the timeline as change events (who, when, expandable diff-style view later; a simple "edited the description" event is enough for v0).

## Surfaces

### The screens to design

#### App shell

Side panel + main content area. ~~**Reserve a collapsible bottom region in the shell layout for the Phase 2 terminal panel** — design its collapsed/expanded geometry now (empty in v0) so terminals later extend the shell instead of forcing a redesign.~~ **Cut from the v0 build (LC-74):** the geometry was designed and lives in the prototype, but v0 reserves nothing — the shell has no bottom region and board/list runs to the window's edge. Design the full side panel per the vision (All / Starred / Local / Teams), but v0 screens show only Local and Starred populated — no teams stubs. **[proposed]** Projects in the side panel may carry a small theme-colored marker (dot or tick) as a wayfinding cue — subtle; skip it if it adds noise.

#### Issue list

Dense, keyboard-navigable rows: ID, title, status, priority, assignee, labels, checklist progress, updated-at. Grouping by status; sort and filter affordances.

#### Board

Columns = status. Linear's density and speed, Trello's card clarity. Cards show ID, title, priority glyph, assignee avatar, labels, checklist progress, and the agent-activity indicator when fresh.

#### Ticket panel

Opens over/beside the list or board. Header (ID, title, status, priority, assignee, labels), description editor, checklist block, merged comments/activity timeline with composer. Keep the Iteration 1 calm; the rejected noisier revision is the reference for what to avoid.

#### Project creation & settings

Folder picker plus the **theme picker**: a row of preset swatches (each showing its human/agent pair), Indigo preselected. Same picker appears in project settings. No custom color affordance anywhere.

#### Command palette

**[proposed]** v0 command set: create ticket · go to project · change status · assign · search tickets · star project · toggle appearance · change project theme · new terminal *(Phase 2, design the slot)*.

#### Sign up — cut from v0 (LC-75)

A quiet, persistent button in the side panel footer → modal: value proposition ("early access to cloud sync & teams"), email, done. Never a wall, never nagging. *Designed, not built: v0 ships no footer button and no modal.*

## Key flows

### Flows to design end-to-end

#### 1. First launch — the make-or-break flow

**Welcome** → Open a folder / Create a project → native folder picker → theme preset (Indigo preselected, one click to skip) → **project appears in side panel** → empty board with a guided "create your first ticket" affordance

No account step anywhere in this flow. The time from app open to first ticket should feel under a minute, and the folder-on-disk nature should be visible, not hidden (show the chosen path). The theme step must never slow this flow — it is a preselected default, not a decision gate.

#### 2. Ticket creation

Two speeds: **quick create** (palette or `C`: title + status, enter, done) and **full create** (opens the ticket panel for description, checklist, labels).

#### 3. Agent round-trip (the demo flow)

Human writes ticket + checklist → agent (external, e.g. Claude Code) edits files on disk → watcher ingests → **board card pulses, checklist ticks, agent comment appears** → human reviews activity, moves to Done

#### 4. Change project theme

Settings or palette → preset swatches → selection applies instantly (optimistic, animated only as a soft crossfade of accent surfaces). Nothing moves; only accents change.

#### 5. Sign up → waitlist — cut from v0 (LC-75)

Button → modal → confirmation state. Nothing in the app changes afterward except the button becoming a subtle "you're on the list." *This flow does not exist in v0.*

## States

### Empty, error & conflict states

A files-on-disk app earns trust in its failure states. Design these, don't default them:

- **No projects yet** — the welcome state doubles as this.
- **Empty project** — board with guided first-ticket affordance.
- **Folder missing/moved** — project stays listed, marked unreachable, with "locate folder" and "remove" actions. Never silently delete.
- **Unparseable ticket file** — a user or agent hand-edited a file into an invalid state. Show the ticket as a degraded card with an error affordance; opening it reveals the raw file content and the parse error. **Non-destructive always** — the app never rewrites or discards a file it can't parse.
- **External edit during in-app editing** — the watcher detects the open ticket changed on disk mid-edit. Design the conflict affordance (e.g. banner: "changed on disk — reload / keep mine"). Exact merge behavior is an engineering call; the UI pattern is a design call, make it now.

## Interaction quality

### The Linear-grade bar, operationalized

- **Keyboard-first:** `Cmd+K` palette, single-key actions on focused tickets (**[proposed]** `C` create, `S` status, `A` assign, `P` priority), arrow/j-k navigation. Every pointer action has a keyboard path.
- **Perceived speed:** optimistic UI on every mutation; motion under ~150ms and always meaningful (state change, external update, theme change), never ornamental.
- **Density with hierarchy:** lists and boards hold a lot without feeling crowded; mono metadata + restrained color carry the hierarchy.

## Out of scope

### Do not design

- Teams UI internals, sync settings, billing — Phase 3.
- The terminal panel — Phase 2. Its position in the shell is *designed*, but v0 reserves no geometry for it and shows no handle (LC-74).
- Custom theme colors, a theme builder, or per-user theme overrides — presets only.
- A new visual identity — the Iteration 1 system is the base; the broader redesign program is retired.
- Onboarding for accounts — there is none. The waitlist modal is designed but cut from v0 (LC-75), so v0 has no account-adjacent surface at all.
- Windows/Linux chrome — macOS only.

## Process

### Order of work in Claude Design

1.  **Design system first — starting from Iteration 1, not from scratch.** Refactor the Iteration 1 palette into the theme-token architecture; define the preset set (Indigo default + Clay + 2–3 proposals, each light + dark); apply the subtle differentiators from section 01. Anchor everything here before any screen.
2.  **Theme proof** — render the board in two themes × two appearances. Fix the tokens, not the screen, if anything breaks.
3.  **Screens** — shell → board → ticket panel → issue list → palette → flows & states above. Design in the default Indigo theme; spot-check key screens in Clay. Iterate until the experience is settled; this is the cheap place to change minds.
4.  **Handoff bundle** — export tokens (system + all theme presets) + component specs and commit to the repo alongside the vision doc.

------------------------------------------------------------------------

## Appendix A — Iteration 1 (historical)

> This appendix preserves the original design brief for decision history only. When it conflicts with the final approved iteration above, the final iteration wins.

> **Design brief for the prototype**

This document translates the vision into what a designer needs: brand direction, ticket anatomy, surfaces, flows, and states. Items marked **[decided]** are settled; items marked **[proposed]** are sensible defaults awaiting founder approval — flag them in the first design review rather than silently diverging.

### Brand direction

#### Personality & feel **[proposed]**

**Product name & domain:** **[decided]** **LongClaw** · `longclaw.io`.

**Logo & icon:** **[decided]** an **owl** mark — the namesake nod is Longclaw, the owl character from the Sonic universe. Design an **original, abstract/geometric owl** that channels the qualities (wise guardian, watchful, swift) rather than the character itself: no reproduction or close likeness of the Sega/Paramount design, its color scheme, or its silhouette — that character is protected IP, and the mark must stand on its own. A restrained, sharp-edged owl reads perfectly against the precise, engineered personality below, and the "watchful guardian over your work" idea gives the brand a story that fits a tracker.

**Personality in five words:** precise, fast, calm, engineered, warm-technical. The product should feel like a well-made tool — closer to Linear's restraint than Trello's playfulness, but never sterile. Density with breathing room; motion that communicates state, never decorates.

**The one distinctive brand hook — two actors, two hues.** The product's thesis is a shared canvas for humans and agents. Encode it visually: a **human accent** (indigo family) for planning actions and human-authored content, and an **agent accent** (green family) for agent activity — agent comments, agent-made edits, live checklist updates, and (Phase 2) terminal chrome. Used with restraint, this makes agent presence legible at a glance and gives the brand a story no competitor has. Exact hues are the design system's to choose.

**Typography feel:** a grotesque with character for display, a workhorse sans for UI, and a monospace that appears wherever the file-on-disk nature shows through (ticket IDs, file paths, frontmatter-ish metadata). The mono accents are part of the identity — this is a tool that's honest about being files.

**Theming:** **[decided]** light and dark are both first-class from v0, system-matched by default with a manual override. Design every screen in both; neither is a derived afterthought.

### Ticket anatomy

#### The core object

| Field | Notes |
|----|----|
| ID | Short, human-readable, mono-styled (e.g. `PROJ-42`). Visible everywhere; copyable. |
| Title | Single line, the board/list anchor. |
| Description | **[decided]** Edited **in-app** with a GitHub/Trello-style markdown editor: write/preview, toolbar for common formatting, drag-in images later. Agents may also edit it; see activity rules below. |
| Checklist | **[decided]** First-class primitive, not just markdown syntax. The human→agent work interface: human writes items, agent checks them off during execution. Progress (3/7) surfaces on cards. |
| Status | **[proposed]** Backlog · Todo · In Progress · In Review · Done · Canceled. Board columns map to these. |
| Priority | **[proposed]** Urgent · High · Medium · Low · None, with Linear-style glyphs. |
| Assignee | **[decided]** **Always a human.** Agents are never assignees. |
| Labels | Free-form, colored, project-scoped. |
| Comments & activity | Single merged timeline: human comments, agent comments, and change events (status, checklist, description edits). See next section. |
| Timestamps | Created / updated; relative display. |

### Agent presence

#### How agents show up — the differentiating surface

This is the design problem no reference product solves, and the reason this app isn't a Linear clone. Rules:

- **[decided]** **Humans own, agents contribute.** Agents appear only in the activity stream: comments, description edits, checklist check-offs, status updates. They never appear in the assignee slot.
- **Agent actions are visually distinct** — agent-accent tint, an agent badge/avatar treatment clearly different from human avatars. A scanning eye should separate human and agent activity instantly.
- **Live external updates are a designed moment.** In v0, agents edit files on disk from outside the app; the file watcher brings changes in. When a ticket updates externally, the card/panel should acknowledge it — a subtle pulse or highlight, an unobtrusive "updated by agent" affordance. This is the product's magic moment; design it deliberately, don't let it be a silent re-render.
- **Description edits by agents** appear in the timeline as change events (who, when, expandable diff-style view later; a simple "edited the description" event is enough for v0).

### Surfaces

#### The screens to design

##### App shell

Side panel + main content area. **Reserve a collapsible bottom region in the shell layout for the Phase 2 terminal panel** — design its collapsed/expanded geometry now (empty in v0) so terminals later extend the shell instead of forcing a redesign. Design the full side panel per the vision (All / Starred / Local / Teams), but v0 screens show only Local and Starred populated — no teams stubs.

##### Issue list

Dense, keyboard-navigable rows: ID, title, status, priority, assignee, labels, checklist progress, updated-at. Grouping by status; sort and filter affordances.

##### Board

Columns = status. Linear's density and speed, Trello's card clarity. Cards show ID, title, priority glyph, assignee avatar, labels, checklist progress, and the agent-activity indicator when fresh.

##### Ticket panel

Opens over/beside the list or board. Header (ID, title, status, priority, assignee, labels), description editor, checklist block, merged comments/activity timeline with composer.

##### Command palette

**[proposed]** v0 command set: create ticket · go to project · change status · assign · search tickets · star project · toggle theme · new terminal *(Phase 2, design the slot)*.

##### Sign up

A quiet, persistent button in the side panel footer → modal: value proposition ("early access to cloud sync & teams"), email, done. Never a wall, never nagging.

### Key flows

#### Flows to design end-to-end

##### 1. First launch — the make-or-break flow

**Welcome** → Open a folder / Create a project → native folder picker → **project appears in side panel** → empty board with a guided "create your first ticket" affordance

No account step anywhere in this flow. The time from app open to first ticket should feel under a minute, and the folder-on-disk nature should be visible, not hidden (show the chosen path).

##### 2. Ticket creation

Two speeds: **quick create** (palette or `C`: title + status, enter, done) and **full create** (opens the ticket panel for description, checklist, labels).

##### 3. Agent round-trip (the demo flow)

Human writes ticket + checklist → agent (external, e.g. Claude Code) edits files on disk → watcher ingests → **board card pulses, checklist ticks, agent comment appears** → human reviews activity, moves to Done

##### 4. Sign up → waitlist

Button → modal → confirmation state. Nothing in the app changes afterward except the button becoming a subtle "you're on the list."

### States

#### Empty, error & conflict states

A files-on-disk app earns trust in its failure states. Design these, don't default them:

- **No projects yet** — the welcome state doubles as this.
- **Empty project** — board with guided first-ticket affordance.
- **Folder missing/moved** — project stays listed, marked unreachable, with "locate folder" and "remove" actions. Never silently delete.
- **Unparseable ticket file** — a user or agent hand-edited a file into an invalid state. Show the ticket as a degraded card with an error affordance; opening it reveals the raw file content and the parse error. **Non-destructive always** — the app never rewrites or discards a file it can't parse.
- **External edit during in-app editing** — the watcher detects the open ticket changed on disk mid-edit. Design the conflict affordance (e.g. banner: "changed on disk — reload / keep mine"). Exact merge behavior is an engineering call; the UI pattern is a design call, make it now.

### Interaction quality

#### The Linear-grade bar, operationalized

- **Keyboard-first:** `Cmd+K` palette, single-key actions on focused tickets (**[proposed]** `C` create, `S` status, `A` assign, `P` priority), arrow/j-k navigation. Every pointer action has a keyboard path.
- **Perceived speed:** optimistic UI on every mutation; motion under ~150ms and always meaningful (state change, external update), never ornamental.
- **Density with hierarchy:** lists and boards hold a lot without feeling crowded; mono metadata + restrained color carry the hierarchy.

### Out of scope

#### Do not design

- Teams UI internals, sync settings, billing — Phase 3.
- The terminal panel's interior — Phase 2; only its reserved position in the shell is designed now.
- Onboarding for accounts — there is none; only the waitlist modal.
- Windows/Linux chrome — macOS only.

### Process

#### Order of work in Claude Design

1.  **Design system first** — palette (including the human/agent accent pair, light + dark), typography, spacing, core components. Anchor everything here before any screen.
2.  **Screens** — shell → board → ticket panel → issue list → palette → flows & states above. Iterate until the experience is settled; this is the cheap place to change minds.
3.  **Handoff bundle** — export tokens + component specs and commit to the repo alongside the vision doc.
