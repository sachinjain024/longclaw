# LongClaw component foundations

Status: implementation-ready, pending founder approval  
Token source: [`tokens/design-tokens.json`](tokens/design-tokens.json)  
Generated CSS: [`tokens/design-tokens.css`](tokens/design-tokens.css)  
Glyph source: [`assets/glyphs.svg`](assets/glyphs.svg)

These foundations preserve the approved calm, Linear-family direction. The
distinctive signature is narrow and product-specific: file metadata uses mono,
and human planning and agent execution use different theme-routed treatments.

## Token contract

Apply one project theme and one appearance to the same app root:

```html
<main data-theme="indigo" data-appearance="dark">…</main>
```

Components may consume:

- `--lc-color-*` for appearance-dependent neutrals, feedback, status,
  priority, and labels;
- `--lc-accent-human*` for human-authored content, selection, primary
  planning actions, and focus;
- `--lc-accent-agent*` only for attributed agent activity and freshness;
- the remaining `--lc-*` properties for type, space, geometry, elevation,
  and motion.

Accent literals are forbidden in component CSS, SVG, canvas drawing code, and
inline styles. A project-theme change replaces token values only. It must not
add a theme class to a component or select a component by theme name.

The agent token is repeated inside every preset rather than promoted to a
global system token. This keeps the component contract uniform and leaves room
for a future preset-specific agent value without a component migration.

## Typography

| Role | Family | Size / line | Weight | Use |
| --- | --- | --- | --- | --- |
| Display | Familjen Grotesk | 26 / 32 | 600–700 | Welcome, empty states, rare section thesis |
| Title | Geist | 17 / 22 | 600 | Ticket panel and project titles |
| Body | Geist | 13.5 / 20 | 400 | Descriptions, comments, settings copy |
| UI | Geist | 13 / 18 | 400–600 | Buttons, menus, ticket titles, list rows |
| Small | Geist | 12.5 / 18 | 400–500 | Supporting copy and timestamps |
| Label | JetBrains Mono | 11 / 16 | 500 | Column counts, compact metadata |
| Code | JetBrains Mono | 12 / 18 | 400–500 | Ticket keys, paths, shortcuts, file data |

Use tabular numerals for timestamps, counts, and checklist progress. Ticket
keys and paths never fall back to the UI face. Product copy uses sentence case.

## Layout, geometry, and elevation

- Spacing follows the 4px scale: 4, 8, 12, 16, 20, 24, 32, and 40px.
- List rows are 36px high; standard controls are 30px; compact controls are
  26px.
- Cards use 12px internal padding. Panels use 16px compact or 24px standard
  gutters.
- Controls use a 5px radius, cards 8px, panels 10px, and modal or command
  palette surfaces 14px.
- Human avatars are circles. Agent avatars are 5px-radius terminal tiles.
  No other container is pill-shaped.
- Level 0 is flush layout; level 1 is a card; level 2 is a popover; level 3 is
  a modal or ticket panel. Borders carry ordinary grouping; elevation is
  reserved for overlap.
- Subtle borders may divide non-interactive regions. Any control whose
  boundary is required to recognize it uses `--lc-color-border-strong`, which
  reaches 3:1 against its surface.

## Icon and glyph geometry

Product glyphs use a 16×16 grid, 1.5px stroke, round caps and joins, and a
maximum 5.25px status radius. Dense metadata may render them at 14px without
redrawing. Emphasized navigation icons may use a 1.75px stroke.

The status family shares one circular skeleton:

- Backlog: broken ring.
- Todo: open ring.
- In Progress: half-filled clockwise ring.
- In Review: three-quarter clockwise ring.
- Done: ring plus check.
- Canceled: ring plus cross.

The priority family shares three rising 3px bars:

- Urgent: danger-colored diamond and exclamation; it is the only chromatic
  priority glyph.
- High: three solid bars.
- Medium: two solid bars.
- Low: one solid bar.
- None: a horizontal dash.

Status and priority always include an accessible name. Color and fill count
never carry the meaning alone.

## Interaction states

| State | Foundation |
| --- | --- |
| Rest | Neutral surface and text; one border at most |
| Hover | `80ms`; neutral surface lift or the matching `*-hover` token |
| Pressed | `80ms`; matching `*-active` token; optional 0.98 scale for pointer controls only |
| Selected | Human soft surface + human foreground; checkmark or selected semantics also present |
| Focus visible | `--lc-focus-ring`; never removed; follows the human theme token |
| Disabled | `--lc-opacity-disabled`; no hover or press response; native disabled semantics |
| Loading | Keep control width; replace leading glyph; announce status without blocking unrelated UI |
| Optimistic | Apply target state immediately; toast names the action and exposes Undo |
| Invalid | Danger foreground + explicit message + error glyph; do not rely on the border alone |
| External update | Agent rail, agent tile, “updated by agent” copy, and two 900ms pulses |
| Conflict | Warning banner with “Reload file” and “Keep mine”; keyboard focus starts on the safer reload action |

Theme changes crossfade only color and shadow for 120ms. Component size,
position, border width, and typography do not animate or change. Panel and
palette transitions complete within 150ms. `prefers-reduced-motion: reduce`
sets foundation durations to zero and removes the agent pulse.

## Component specifications

### Buttons

- Primary button: human solid background and `human-on-solid`; planning and
  mutation actions only.
- Secondary button: neutral surface, strong border, primary text.
- Ghost button: transparent surface; neutral hover.
- Destructive button: danger token. Destructive actions are never themed.
- Minimum target is 30×30px for dense pointer use; the clickable target grows
  to 44×44px on coarse pointers without changing visible geometry.
- The shortcut hint is mono and supplemental; it does not replace the label.

### Fields and editors

- Resting fields use the surface and strong border. Hover strengthens text,
  not border width.
- Focus uses the human focus ring regardless of field content.
- File paths and raw content use the mono family.
- Invalid fields retain the entered value and add danger text plus a glyph.
- Read-only and disabled are distinct: read-only remains fully legible and
  selectable; disabled uses disabled opacity.

### Ticket cards

- Default: surface, subtle border, 8px radius, 12px padding, level-1
  elevation.
- Focused or selected: human focus ring or human soft surface.
- Fresh agent activity: agent-colored 2px inset leading rail, agent tile, and
  explicit “updated by agent · time” copy. Do not tint the entire card.
- Card metadata order: ticket key, title, labels, then priority/checklist/
  assignee/activity footer.
- A degraded ticket replaces metadata with the parse-error glyph and error
  summary but remains openable. Never hide or rewrite it.

### Status and priority

Status appears as glyph + label in controls and as glyph + label + count in
board headers. Priority appears as glyph + accessible label in menus; cards
may show the glyph alone only when the accessible name remains available.
Neither uses theme tokens.

### Labels

Labels use one of the eight fixed foreground/background pairs. Assignment is
project-scoped but the palette is system-owned. A label uses color plus its
text; no unlabeled color dot is permitted.

### Actor identity and timeline

Human activity:

- circular avatar;
- UI-face human name;
- ordinary neutral entry surface;
- human accent only when the human action itself needs emphasis.

Agent activity:

- rounded terminal tile with the `>` prompt glyph;
- mono agent name and a visible `agent` badge;
- 2px leading rail and soft agent surface on the activity header;
- provenance such as `via file edit` when known.

Agent avatars never occupy the assignee slot. In accessibility names, use
“Agent, {name}” and “Human, {name}” where actor type is not already explicit
in nearby text.

### Side-panel project marker

The accepted marker is a quiet 10×4px actor pair: one 4px circular human dot,
a 2px gap, then one 4px square agent dot. It appears before local project names
and uses the two theme tokens. The project name and selected row carry
wayfinding; the marker is supplemental and never signals status, sync, or
reachability.

### Owl mark

Use [`assets/owl-mark.svg`](assets/owl-mark.svg) as a monochrome `currentColor`
asset. It is the selected “Talon” construction from the reference: two pointed
ears, two circular eye cuts, and a face tapering to one claw point. The asset
uses negative space rather than a white fill, so it works in both appearances
and at 16, 24, and 32px.

The two-color eye variant is reserved for marketing. In-product chrome stays
monochrome so actor accents retain their semantic scarcity. Do not add
feathers, wings, character colors, or a character-like silhouette.

## Keyboard and focus map

Bare-letter shortcuts are active only when focus is on a navigable collection,
never in a field, editor, menu, or modal.

| Shortcut | Action |
| --- | --- |
| `⌘K` | Open command palette |
| `C` | Quick-create ticket |
| `S` | Change focused ticket status |
| `A` | Assign focused ticket |
| `P` | Change focused ticket priority |
| `J` / `K`, `↓` / `↑` | Move through tickets |
| `←` / `→` | Move between board columns |
| `Enter` | Open focused ticket or confirm menu choice |
| `Esc` | Close the topmost transient surface |
| `⌘Enter` | Save editor or post comment |

The v0 palette contains Create ticket, Go to project, Change status, Assign,
Search tickets, Star or unstar project, Toggle appearance, and Change project
theme. “New terminal” remains a reserved Phase 2 command and is absent in v0.

