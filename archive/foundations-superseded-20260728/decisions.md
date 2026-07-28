# Phase 0 design decisions

Status: proposed for founder approval  
Decision date: 2026-07-28  
Source direction: final approved section of `docs/design_brief.md` and the
`fable-design-system-v1.mhtml` reference. Historical appendices were not used
to reopen the visual direction.

## DS-001 — Ship four fixed project themes

Decision: accept four presets: Indigo (default), Clay, Azure, and Orchid.

Why: two new cool proposals provide meaningful project wayfinding while
staying clear of the fixed warning, danger, and agent families. Four is enough
choice for v0 and keeps the creation flow fast.

Rejected:

- A fifth amber/ochre preset: too close to warning and In Progress.
- A rose/crimson preset: too close to danger and Urgent.
- A green human preset: directly conflicts with the agent identity.
- A neutral graphite preset: too little project identity to justify a preset.

## DS-002 — Keep the agent accent in one green family

Decision: accept. All four presets repeat the same emerald agent values for a
given appearance.

Why: an agent action should be recognizable before the project theme is known.
The values remain inside each theme token block so this policy can change
without changing a component interface.

Constraint: color is not the only actor cue. Clay and agent green approach one
another for severe deuteranopia, so agent activity must also use the terminal
tile, mono name, agent badge, provenance, and leading rail.

## DS-003 — Adopt six statuses with a shared circular glyph family

Decision: accept Backlog, Todo, In Progress, In Review, Done, and Canceled.

Why: the set matches the product flow without inventing workflow complexity.
One circular skeleton makes state progression scannable at dense sizes.

Implementation:

- Backlog: broken ring.
- Todo: ring.
- In Progress: half ring in fixed amber.
- In Review: three-quarter ring in fixed orange.
- Done: checked ring in fixed violet.
- Canceled: crossed ring in neutral gray.

Rejected:

- Green Done: green is reserved for attributed agent activity.
- Theme-colored Done: statuses must be identical across project themes.
- A new, unfamiliar glyph language: the approved direction asks for familiar,
  quiet status geometry with LongClaw's own measurements.

## DS-004 — Adopt five priorities with quiet bar geometry

Decision: accept Urgent, High, Medium, Low, and None.

Why: three ascending bars are compact and familiar. Urgent alone uses the
fixed danger color; the remaining priorities are monochrome. Text labels remain
visible in menus and accessible names remain on icon-only card uses.

Rejected: colorful priority levels and filled priority pills. Both make dense
boards noisy and compete with actor accents.

## DS-005 — Accept the keyboard set; keep terminal out of v0

Decision: accept `⌘K`, `C`, `S`, `A`, `P`, arrow or J/K navigation, `Enter`,
`Esc`, and `⌘Enter`. Bare keys are suspended while typing.

The palette includes Create ticket, Go to project, Change status, Assign,
Search tickets, Star or unstar project, Toggle appearance, and Change project
theme.

Rejected for v0: New terminal. Its command slot is reserved for Phase 2, but
showing an unavailable command in v0 would create a false affordance.

## DS-006 — Use a two-actor project marker

Decision: accept a supplemental marker in the side panel: one circular human
dot plus one square agent dot, 10×4px overall.

Why: the pair communicates the theme more truthfully than a single human-color
dot and reinforces LongClaw's shared-canvas thesis at negligible visual cost.

Constraint: the project name and selected row remain the primary wayfinding
cues. The marker never communicates project health, sync, or reachability.

Rejected: a large color stripe, colored project icon, or single unlabeled
status-like dot.

## DS-007 — Use Geist, Familjen Grotesk, and JetBrains Mono

Decision: accept the reference's three-family system.

Why: Geist preserves dense UI clarity without falling back to the generic
Inter default. Familjen adds controlled character only at display scale.
JetBrains Mono makes the files-on-disk model visible in ticket keys, paths,
counts, and shortcuts.

Constraint: production builds should bundle reviewed, subsetted font files
under their open licenses; the Phase 0 proof uses safe local fallbacks.

## DS-008 — Use the terminal-tile agent avatar

Decision: accept a 5px-radius tile with the `>` prompt glyph.

Why: it reads as a process rather than a person at 16–20px and cannot be
mistaken for the circular human assignee avatar.

Rejected: a circular bot portrait, dashed circle, or star/sparkle motif.

## DS-009 — Select the geometric “Talon” owl

Decision: accept the first reference construction as the production mark.

Why: it remains legible at 16px and expresses watchfulness and the “claw”
without feathers, wings, character colors, or a borrowed character silhouette.
The production SVG is rebuilt as a monochrome negative-space asset.

Rejected: the horned-tuft, barn-owl, and eyes-only variants. They either become
more illustrative or lose the name's claw point.

IP constraint: the mark is an original arrangement of basic geometry and must
not be altered toward the protected Longclaw character's likeness, palette, or
silhouette.

## DS-010 — Reserve color motion for meaningful state

Decision: hover 80ms, state changes 120ms, panels 150ms, and external agent
freshness two 900ms pulses.

Why: the reference calls for motion that communicates state, with the agent
round-trip as the sole longer moment. Reduced-motion preferences remove all
foundation animation.

Rejected: ambient animation, looping freshness indicators, and layout motion
during a project-theme change.

## Approval checklist

- [ ] Approve Indigo, Clay, Azure, and Orchid as the fixed v0 set.
- [ ] Approve the invariant green agent family with mandatory non-color cues.
- [ ] Approve the status and priority sets and glyphs.
- [ ] Approve the keyboard and command-palette set.
- [ ] Approve the two-actor side-panel marker.
- [ ] Approve the Talon owl mark.
- [ ] Approve the token system for use in the Step 2 prototype.

