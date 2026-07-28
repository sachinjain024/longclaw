# LongClaw component foundations & interaction states

> Phase 0, Step 1 deliverable. Everything below consumes `--lc-*` tokens from
> `tokens/design-tokens.css`; no component hardcodes an accent hue. Pixel
> geometry comes from the approved reference
> (`docs/design/fable-design-system-v1.mhtml`); color values that were adjusted
> for WCAG AA are listed in `decisions.md`.

## The two rules everything hangs on

1. **Two actors, two hues.** The human accent (`--lc-accent-human`) marks
   planning: primary actions, selection, focus, human authorship, Done. The
   agent accent (`--lc-accent-agent`) marks execution: agent comments, agent
   edits, checklist ticks, the freshness pulse, and (Phase 2) terminal chrome.
2. **The exclusivity rule.** The agent accent appears **only** when an agent
   acted. It is never decorative, never a "success" color, never a status.
   Scarcity is what makes agent presence legible.

Hue is never the only channel separating the actors: humans are **circles**
set in the UI sans; agents are **square terminal tiles** set in mono with the
`❯` prompt glyph and an `agent` badge. This redundancy is load-bearing for
color-vision deficiency (see `accessibility.md`).

## Global interaction model

| State | Treatment | Motion |
|---|---|---|
| Hover | Background shifts one step (`--lc-wash` on quiet surfaces, `--lc-raised` + `--lc-shadow-overlay` on popovers); accent fills shift to `--lc-accent-*-hover` | `--lc-motion-fast` (80ms) |
| Active/pressed | Accent fills shift to `--lc-accent-*-active`; no scale transforms | `--lc-motion-fast` |
| Focus (keyboard) | `box-shadow: var(--lc-focus-ring)` **plus** a 1px `--lc-accent-human` border on the focused control. Focus is human-accent everywhere — focus is a planning act | none |
| Selected | `--lc-accent-human-soft` background; selection never relies on color alone (checkmark or border accompanies it) | `--lc-motion-state` (120ms) |
| Disabled | Text/glyphs `--lc-ink-disabled`; fills `--lc-wash`; no hover response; `cursor: default` | none |
| Loading | Optimistic UI first — mutations render immediately; a 500ms-delayed spinner appears only if the write hasn't settled | `--lc-motion-state` |
| Fresh (agent) | See § Agent presence — ring, border, pulse dot, footer | `lc-pulse` 900ms × 2 |

- Every pointer action has a keyboard path (§ Shortcuts).
- Motion communicates state, never decorates: 80ms hover/press, 120ms state
  change/reorder, 150ms panel/palette, ease `--lc-motion-ease`. The agent
  pulse (2 × 900ms) is the one exception, and it never loops beyond two beats.
- `prefers-reduced-motion` zeroes all motion tokens (generated in the CSS).

## Buttons

Height `--lc-size-control` (30px); small variant `--lc-size-control-sm` (24px,
banner actions). Radius `--lc-radius-control` (5px). Type `--lc-type-ui`
(13px/500). Padding 0 12px (0 9px small). Gap to kbd hint 8px. Never
pill-shaped.

| Variant | Fill | Text | Border | Hover | Active |
|---|---|---|---|---|---|
| Primary | `accent-human` | `on-accent-human` | none | `accent-human-hover` | `accent-human-active` |
| Secondary | `surface` (light) / `raised` (dark) | `ink` | 1px `line-strong` | bg `wash` (light) / lighten via `raised` hover overlay (dark) | border `ink-3` |
| Ghost | transparent | `ink-2` | none | bg `wash` | bg `line-soft` |
| Danger | `surface` (light) / `raised` (dark) | `danger` | 1px `danger-border` | bg `danger-surface` | border `danger` |

Embedded kbd hint: `--lc-type-kbd` mono on 20%-white (light primary) /
18%-ink (dark primary) chip, radius `--lc-radius-kbd`.

## Inputs

Height 30px, radius 5px, padding 0 10px, type 13px. Background `surface`
(light) / `#16171E → surface` (dark). Border 1px `line-strong`.

- **Placeholder:** `ink-3` (AA-passing).
- **Focused:** border `accent-human`, `box-shadow: var(--lc-focus-ring)`,
  caret `accent-human` (1.5px).
- **Path/mono inputs** (folder pickers, IDs): `--lc-type-code`, folder glyph
  in `ink-3`, text `ink-2`. The disk shows through in mono — part of the
  identity, push it wherever a value is really a file.
- **Invalid:** border `danger`, message `danger` in `--lc-type-small` below;
  never color-only (icon + text).

## Chips & labels

- **Label chip:** height 22px (19px on cards), pill radius (`radius-full` —
  the one pill exception, chips are content not containers), border 1px
  `line` , bg `surface` (light) / `raised` (dark), text 11.5px/500 `ink-2`,
  7px dot (6px on cards) in a fixed `--lc-label-*` ramp color. Dots are
  reinforcement; the text is the identifier.
- **Ticket ID chip:** mono 11px/500, `accent-human-text` on
  `accent-human-soft`, radius 5px. Copyable everywhere; click copies.
- **Agent chip:** mono 11px/500, `accent-agent-text` on `accent-agent-soft`,
  radius 5px, leading `❯` at weight 600. Used for `claude-code · agent`
  attribution.
- **kbd chip:** mono 10px/500 on `wash`, radius 3px, border 1px `line`.

## Status — color dot + text

**Revised by founder direction (2026-07-28, decisions.md D3):** a status is a
**color dot plus its text label** — one geometry for every status, built-in
or user-created. The reference's bespoke pie/check/X glyphs are retired.

**Dot geometry** (from the old Todo ring): 14×14 viewBox, circle r=5, 13px at
card size. Two fill states:

- **Unfilled ring** (1.6px stroke) — the default state. Today that is Todo,
  and it is the default look of any newly created status (grey).
- **Filled dot** (r=5 fill + 1.6px same-color stroke, so the visual weight
  matches the ring) — every non-default state, filled with the status color.

| Status | Dot | Color token |
|---|---|---|
| Backlog | grey ring, dashed `2.1 2.5` — pre-default | `--lc-status-backlog` |
| Todo | grey ring — **the default state** | `--lc-status-todo` |
| In Progress | filled, amber | `--lc-status-in-progress` |
| In Review | filled, orange | `--lc-status-in-review` |
| Done | filled, **human accent** — completion is a human call | `--lc-status-done` |
| Canceled | filled, grey | `--lc-status-canceled` |

**User-created statuses.** Statuses are project data, not a fixed set.
Creating one always assigns a color: default is the grey ring; the picker
offers the eight label-ramp hues (`--lc-label-*`) as filled dots plus the
grey default. **Green is never offered** — the exclusivity rule extends to
statuses — and the human accent stays reserved for Done. Creation row
anatomy: name input (30px, standard field) + a row of 9 selectable dot
swatches (grey ring preselected), selected dot gets the focus-ring
treatment.

**Color is never the only channel:** the label always accompanies the dot —
in list rows, pickers, palettes and the ticket panel the text sits beside it;
on the board the column header names it. Built-in dot colors clear 3:1 on bg
and surface; user-ramp dots lean on the mandatory label exactly like label
chips. Backlog's dash survives every CVD type. Master shapes:
`assets/glyphs.svg`.

## Priority — set & glyph geometry

Six levels, scannable not loud: monochrome except Urgent. **Revised by
founder direction (2026-07-28, decisions.md D4):** the reference's
High/Medium/Low bar glyphs are retired; the middle levels are now four
numbered chips, P1–P4, with a simple border. The number carries the level —
no fill hierarchy, nothing louder.

| Priority | Glyph | Tokens |
|---|---|---|
| Urgent | 12×12 rx3 square + exclamation (14×14 viewBox) — unchanged | fill `--lc-priority-urgent`, mark `--lc-priority-urgent-mark` |
| P1 · P2 · P3 · P4 | bordered mono chip: 14px tall (13px on cards), min-width 21px, padding 0 3px, radius `--lc-radius-kbd` (3px), 1px border, transparent fill, label `P1`–`P4` in mono 9px/500 (8.5px on cards), uppercase | text `--lc-priority-chip-text`, border `--lc-priority-chip-border` |
| None | 9×1.6 rx0.8 dash (14×14 viewBox) — unchanged | `--lc-priority-none` |

The chip label is real text and is held to the 4.5:1 text gate on both bg and
surface (see `accessibility.md`); the border is a decorative container and
carries no meaning on its own. Chips never take the theme accent and never
gain a fill — a filled P-chip would compete with the ID chip and the agent
chip, which own the soft-fill register.

## Avatars — humans are circles, agents are not

- **Human:** circle, 26px (20px on cards), initials 10.5px/600 (8.5px small).
  Tint recipe: hash the person to one of the eight `--lc-label-*` hues, then
  bg `color-mix(in oklab, hue 18%, var(--lc-surface))`, initials in the hue's
  dark/light text tone. The ramp contains no agent-green band, so no human
  can ever wear the agent's color.
- **Agent:** square tile, 26px, radius `--lc-radius-tile` (4px), bg
  `--lc-tile` (near-black in both appearances — a terminal window in
  miniature), `❯` in mono 11px/600 `accent-agent`, ring 1.5px
  `accent-agent-avatar-ring`. **Never appears in the assignee slot.**

## Board card

Width min `--lc-size-card-width-min` (240px), padding 10px 12px, radius 8px,
bg `surface`, border 1px `line`, shadow `--lc-shadow-card` (none in dark).
Rows: mono ID (11px, `ink-3`) + spacer + priority glyph · title (13px/500
`ink`, 1.35, max 2 lines) · footer: status glyph, labels, checklist `3/7`
(mono 10.5px) + 44×3px progress track (`wash` track, fill see below), spacer,
assignee avatar 20px.

| State | Treatment |
|---|---|
| Resting | as above |
| Hover | border `line-strong`, shadow `--lc-shadow-overlay` at 40% opacity feel (light); bg `raised` (dark) |
| Focused (keyboard) | focus ring + 1px `accent-human` border |
| Selected | 1px `accent-human` border + `accent-human-soft` header wash |
| Dragging | lift with `--lc-shadow-overlay`, 2° nothing — no rotation; drop targets show 2px `accent-human` insertion line |
| **Fresh agent activity** | border `accent-agent-fresh-border`, `box-shadow: 0 0 0 3px var(--lc-accent-agent-fresh-ring)`, 8px pulse dot (`accent-agent`, `lc-pulse` 900ms × 2) beside the ID, footer line `❯ updated by agent · 12s` (mono 10.5px `accent-agent-text`) above a `line-soft` divider. Checklist fraction + progress fill switch to `accent-agent` while fresh. Decays to resting when the ticket is opened or after 2 minutes |
| Degraded (unparseable file) | border 1px `danger-border`, ID row shows warn triangle in `danger`, title falls back to filename in mono, single action: "View raw file". **Non-destructive always** |

Checklist progress fill when not fresh: `ink-3`. The 3/7 fraction surfaces on
the card only when a checklist exists.

## Checklist (the human→agent interface)

Row: 15px checkbox + 13px text, 6px gap between rows. Checkbox geometry:
12×12 rx3.5 (filled) / 11×11 rx3 1.5px stroke (empty, `line-strong`;
hover `ink-3`).

| State | Box | Text |
|---|---|---|
| Unchecked | stroke `line-strong` | `ink` |
| Checked (settled) | fill `ink-3`, mark `surface` | `ink-3`, line-through |
| **Checked by agent (fresh)** | fill `accent-agent`, mark `on-accent-agent` | `ink`, row bg `accent-agent-wash` (radius 6, -6px margin bleed), trailing mono `❯ just now` in `accent-agent-text` |

Agent-fresh rows settle to the standard checked state once the ticket is
viewed. Checking animates at `--lc-motion-state`.

## Timeline (one merged stream, two voices apart)

- **Human entry:** 26px circle avatar · name 12.5px/600 `ink` · relative time
  mono 10.5px `ink-3` · body 13px/1.5 `ink`. Plain — no rail, no tint.
- **Agent entry:** 26px agent tile · **2px rail** `accent-agent-rail` with
  12px padding on the content block · name in mono 12px/600
  `accent-agent-text` · `AGENT` badge (mono 9.5px/500, uppercase, 0.06em, on
  `accent-agent-soft`, radius 3) · meta `12s · via file edit` mono 10.5px
  `ink-3` — the app stays honest about where the change came from · body 13px
  `ink`. Inline paths/code on `wash` chips (mono 12px, radius 4).
- **Change events** (status, checklist, description edits): single 12px glyph
  + one line 12px `ink-2`, actor name in its accent text color. Agent
  description edits log as events ("edited the description"); expandable
  diff later.
- Composer: standard input foundations; posting is optimistic.

## Toast & banners

- **Toast:** bg `inverse-surface`, text 12.5px `inverse-ink`, secondary
  `inverse-ink-2`, radius 8px, shadow `--lc-shadow-overlay`, kbd chip for
  undo (`⌘Z`). Bottom-center, single stack, auto-dismiss 5s.
- **Conflict banner** ("Changed on disk while you were editing"): bg
  `warn-surface`, border 1px `warn-border`, warn triangle glyph, text
  `ink`/strong lead, actions: small secondary button ("Reload file", border
  `warn-border-strong`) + small ghost ("Keep mine", text `warn-ink`). This is
  the designed conflict affordance — never a silent re-render, never data
  loss.
- **Folder unreachable:** same warn anatomy at panel level, actions "Locate
  folder…" / "Remove from list". Never silently delete.
- **Parse error:** danger anatomy (`danger-surface`/`danger-border`), opens
  raw file view with the parse error in mono.

## App shell & side panel

- Side panel 240px, bg `bg`, main content on `surface` panels, gutters
  16/24px. Rows 28px: section headers mono 10.5px uppercase `ink-3`; project
  rows 13px `ink-2`, active row `accent-human-soft` bg + `ink` text.
- **Project theme marker:** 6px dot (`--lc-size-theme-dot`) in the project's
  own `accent-human`, sitting left of the project name. Subtle wayfinding —
  the only place another project's theme leaks into the current window. The
  same swatch anatomy scales up in the theme picker.
- Footer: quiet ghost button "Get early access" → waitlist modal; after
  joining, it becomes static `ink-3` text "You're on the list". Never a wall,
  never nagging.
- **Terminal slot (Phase 2 reservation):** the shell grid reserves a bottom
  region — collapsed 0px with a 28px reveal handle on hover at the window's
  bottom edge; expanded 240–420px, resizable. Interior is out of scope; only
  the geometry ships in v0. When it arrives, its chrome is the one other
  place the agent accent lives.

## Theme picker

Row of preset swatches (no wheel, no custom colors): 44×28px, radius 5px,
each showing the pair — left ⅔ human accent, right ⅓ agent accent — with the
preset name in `--lc-type-micro` below. Selected: 1px `accent-human` border +
focus ring. Appears in project creation (Indigo preselected — never a
decision gate) and project settings. Switching applies instantly: a 150ms
crossfade of accent surfaces only; nothing moves.

## Command palette

Modal 560px, radius `--lc-radius-modal` (14px), shadow `--lc-shadow-modal`,
scrim backdrop. Input row 44px (15px type); result rows 36px: glyph 14px,
name 13px `ink`, kbd hint right-aligned. Selected row `accent-human-soft`.
v0 commands: create ticket · go to project · change status · assign · search
tickets · star project · toggle appearance · change project theme · new
terminal *(Phase 2 slot, present but disabled)*.

## Shortcuts (v0 set)

| Key | Action |
|---|---|
| `⌘K` | Command palette |
| `C` | Create ticket (quick create) |
| `S` | Change status of focused ticket |
| `A` | Assign focused ticket |
| `P` | Set priority of focused ticket |
| `↑↓` / `J K` | Move focus in lists and columns |
| `←→` / `H L` | Move focus across board columns |
| `Enter` | Open focused ticket |
| `Esc` | Close panel / palette / modal |
| `⌘Z` | Undo last mutation (paired with toast) |
| `⌘F` | Filter within view |

Single-key shortcuts suspend while any input has focus. Every shortcut is
discoverable in the palette; kbd chips render in primary buttons and palette
rows.

## Empty & first-run states

- **Welcome / no projects:** display type (`--lc-type-display`, Familjen
  Grotesk) greeting, one primary button ("Open a folder"), path preview in
  mono once picked. No account step, ever.
- **Empty project:** board scaffold stays visible; first column hosts a
  guided "create your first ticket" card (dashed `line-strong` border, ghost
  affordance, `C` kbd hint).

## Do / don't

- **Do** route every accent through `--lc-accent-*` tokens. `grep` for hex
  values in component code should hit nothing but `tokens/`.
- **Do** pair every color signal with a shape/type signal.
- **Don't** use the agent green for success, confirmations, or Done.
- **Don't** pill-shape containers (chips only), round corners past 14px, or
  animate anything that isn't a state change.
- **Don't** let an external edit re-render silently — it earns the pulse, the
  footer, or a timeline event.
