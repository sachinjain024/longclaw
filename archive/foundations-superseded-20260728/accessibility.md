# Accessibility and contrast results

Audit date: 2026-07-28  
Token version: 1.0.0  
Result: automated token checks pass; visual proof pending founder review

Run:

```sh
node docs/design/foundations/scripts/build-tokens.mjs
node docs/design/foundations/scripts/verify-design-system.mjs
```

The verifier currently runs 536 assertions, including 184 contrast
comparisons, the fixed-preset contract, invariant agent tokens, proof coverage,
literal-color checks, and actor-accent simulations.

## WCAG 2.2 AA checks

Thresholds:

- 4.5:1 for normal text.
- 3:1 for required control boundaries and focus indicators.
- Disabled controls and decorative borders are excluded from contrast
  requirements; their state or grouping is not conveyed by color alone.

Result:

- Minimum normal-text contrast: **4.53:1** — light agent foreground on its
  soft-hover surface.
- Minimum required non-text contrast: **3.32:1** — dark strong control border
  on a dark surface.
- Primary, secondary, and muted text pass on both canvas and surface in light
  and dark.
- Warning, danger, info, all six statuses, all eight label pairs, and both
  priority foregrounds pass in both appearances.
- Every accent rest, hover, active, soft, and soft-hover pairing passes in all
  four themes and both appearances.

The subtle default border is decorative. Fields, checkboxes, and other controls
whose perimeter is necessary for recognition use the strong-border token.

## Theme accent results

Ratios below show accent foreground on the standard surface, followed by
on-solid text on the accent.

| Theme | Appearance | Human | Agent |
| --- | --- | ---: | ---: |
| Indigo | Light | 7.61 / 7.61 | 5.34 / 5.34 |
| Indigo | Dark | 6.75 / 7.17 | 9.65 / 10.26 |
| Clay | Light | 8.74 / 8.74 | 5.34 / 5.34 |
| Clay | Dark | 4.75 / 5.05 | 9.65 / 10.26 |
| Azure | Light | 8.54 / 8.54 | 5.34 / 5.34 |
| Azure | Dark | 5.85 / 6.22 | 9.65 / 10.26 |
| Orchid | Light | 7.05 / 7.05 | 5.34 / 5.34 |
| Orchid | Dark | 7.04 / 7.49 | 9.65 / 10.26 |

The darker light-appearance Clay, Azure, and Indigo values are intentional.
They preserve AA contrast and add luminance separation from agent green under
color-vision simulations. Soft tokens carry most large accent surfaces, so the
system remains calm.

## Human and agent distinction

The verifier simulates full-severity protanopia, deuteranopia, and tritanopia
with the Machado matrices, then measures human-to-agent distance in OKLab. This
is an engineering heuristic, not a WCAG conformance metric.

Internal advisory floor: **0.080**. All accent pairs exceed the floor.

| Theme | Appearance | Normal | Protanopia | Deuteranopia | Tritanopia | Minimum |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Indigo | Light | 0.295 | 0.256 | 0.243 | 0.085 | 0.085 |
| Indigo | Dark | 0.267 | 0.235 | 0.211 | 0.119 | 0.119 |
| Clay | Light | 0.222 | 0.176 | 0.091 | 0.257 | 0.091 |
| Clay | Dark | 0.281 | 0.255 | 0.156 | 0.324 | 0.156 |
| Azure | Light | 0.175 | 0.170 | 0.171 | 0.093 | 0.093 |
| Azure | Dark | 0.193 | 0.189 | 0.191 | 0.121 | 0.121 |
| Orchid | Light | 0.264 | 0.198 | 0.135 | 0.177 | 0.135 |
| Orchid | Dark | 0.285 | 0.214 | 0.141 | 0.215 | 0.141 |

Actor meaning never depends on this color distance. The mandatory redundant
cues are:

| Human | Agent |
| --- | --- |
| Circular avatar | Rounded terminal tile |
| UI-face human name | Mono agent name |
| Human name / assignee semantics | Visible `agent` or `updated by agent` text |
| Ordinary entry edge | 2px leading rail on attributed activity |
| No file provenance by default | `via file edit` when known |

The board proof contains both actor treatments in every theme/appearance case.
The card's assignee remains a circular human avatar even when the card also
shows fresh agent activity.

## Status, priority, and feedback distinction

- Every status has a unique glyph plus text. Fixed violet Done avoids both
  agent green and danger red.
- Priority uses bar count plus an accessible label. Urgent uses a diamond,
  exclamation, label, and danger color.
- Warnings and errors use distinct glyphs, headings, and action copy in
  addition to color.
- Label colors always contain label text; color-only dots are not allowed.

## Focus, keyboard, and motion

- Focus-visible uses a surface separator plus a 2px theme-human ring. The
  accent values exceed the 3:1 non-text threshold on both surfaces.
- Bare-key shortcuts are disabled in typing contexts. Every pointer action
  retains a keyboard path.
- Reduced motion changes hover, state, and panel durations to zero and removes
  the external-update pulse.
- The two-cycle agent pulse is supplemental. The rail, tile, and attribution
  persist after the pulse ends.

## Manual checks for Step 2

These are intentionally carried into the end-to-end prototype review:

- 200% zoom and macOS Increased Contrast.
- VoiceOver reading order for board cards, menus, and the merged timeline.
- Keyboard traversal inside ticket panels and the command palette.
- Coarse-pointer target expansion without a visible density change.
- Color-vision review of real activity timelines, not swatches alone.
- Font fallback and bundled-font rendering at 13–13.5px.
