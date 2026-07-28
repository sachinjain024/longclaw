# LongClaw visual foundations

This directory is the implementation-ready Step 1 handoff for Phase 0. It
starts from the approved final direction and treats the historical appendix as
history, not as a source of new design choices.

## Deliverables

- [`tokens/design-tokens.json`](tokens/design-tokens.json) — canonical system,
  appearance, and four-preset token source.
- [`tokens/design-tokens.css`](tokens/design-tokens.css) — generated `--lc-*`
  properties for direct prototype and application use.
- [`component-foundations.md`](component-foundations.md) — type, spacing,
  geometry, elevation, glyph, motion, state, component, and keyboard specs.
- [`decisions.md`](decisions.md) — accepted and rejected proposed choices,
  including the founder approval checklist.
- [`accessibility.md`](accessibility.md) — WCAG AA and color-vision results.
- [`proof/board-theme-proof.html`](proof/board-theme-proof.html) — one board
  component tree rendered as Indigo light/dark and Clay light/dark.
- [`proof/component-gallery.html`](proof/component-gallery.html) — interactive
  bare-component review surface with Indigo/Clay selection and light/dark
  switching.
- [`assets/owl-mark.svg`](assets/owl-mark.svg) — original geometric,
  monochrome owl mark.
- [`assets/glyphs.svg`](assets/glyphs.svg) — status, priority, and actor glyph
  source.

## Token usage

The app root owns both independent axes:

```html
<div data-theme="indigo" data-appearance="light">…</div>
```

Switching a project theme changes `data-theme` only. Components use semantic
variables such as `--lc-accent-human`, `--lc-accent-agent-soft`, and
`--lc-color-status-in-review`; they do not select theme names or contain
literal accent colors.

Rebuild and verify:

```sh
node docs/design/foundations/scripts/build-tokens.mjs
node docs/design/foundations/scripts/verify-design-system.mjs
```

Open the proof through a local static server so external SVG symbols load:

```sh
python3 -m http.server 4173
```

Then visit:

```text
http://localhost:4173/docs/design/foundations/proof/board-theme-proof.html
http://localhost:4173/docs/design/foundations/proof/component-gallery.html
```

## Exit-gate status

| Gate | Status | Evidence |
| --- | --- | --- |
| At least two themes × two appearances | Pass | Four proof cases clone one template |
| Theme switch changes tokens only | Pass | Proof CSS has no theme selectors or literal colors |
| Human and agent remain distinct | Pass | AA accents, CVD floor, and mandatory non-color cues |
| System/status/error/label colors are theme-independent | Pass | They live only in appearance blocks |
| Fixed preset set and proposals resolved | Ready for review | `decisions.md` |
| Founder approval | Pending | Approval checklist in `decisions.md` |

The technical and design-system portions of the gate are met. Step 1 remains
open until the founder approves the fixed preset set and token system.
