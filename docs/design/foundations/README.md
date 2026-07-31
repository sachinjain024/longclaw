# LongClaw design foundations — Phase 0, Step 1

Implementation-ready visual foundations for the approved Linear-family
direction (`../fable-design-system-v1.mhtml` + `docs/design_brief.md`, final
iteration). Everything here is the deliverable set for MVP plan Step 1.

## Layout

| Path | Deliverable |
|---|---|
| `tokens/design-tokens.json` | **Token source of truth** — system tokens (type, space, radii, elevation, borders, motion, neutrals, status, priority, feedback, labels) + 4 theme presets × light/dark |
| `tokens/build.mjs` | Generates `design-tokens.css` from the JSON (`node tokens/build.mjs`) |
| `tokens/design-tokens.css` | Generated CSS custom properties — the only file components consume |
| `components.md` | Component foundations & interaction-state specifications |
| `decisions.md` | Decision log — every **[proposed]** brief item resolved (D1–D15) |
| `accessibility.md` | Generated WCAG AA + color-vision-deficiency results (204 checks) |
| `scripts/a11y-check.mjs` | The checker (`node scripts/a11y-check.mjs --write`); exits non-zero on any failure |
| `assets/owl-mark.svg` | Original geometric owl mark, variant A "talon" |
| `assets/glyphs.svg` | Status / priority / checkbox / agent / folder / warn glyph masters |
| `proof/board.html` | **Board proof** — open in a browser; switch 4 themes × 2 appearances live |
| `proof/components-library.html` | **Components library** — every foundation component as a live specimen: type, color (with live-resolved token values), space/radius/elevation/motion, buttons, fields, chips, status, priority, avatars, checklist, cards, list view, timeline, ticket panel, toast/banners, navigation, empty states, brand |
| `proof/fonts.css` | Fonts extracted from the approved reference (latin subsets, offline proof) |
| `proof/renders/` | Headless-rendered screenshots — board in all 8 combinations, library in light/dark |

## Token contract

Set both axes on the root element:

```html
<html data-appearance="light|dark" data-theme="indigo|clay|slate|plum">
```

Components consume only `--lc-*` custom properties. A theme preset supplies
six values per appearance (accent, AA text variant, on-accent × human/agent);
every soft/hover/ring/rail/wash variant derives via `color-mix(in oklab, …)`
in the generated CSS. Neutrals, status, warn/error and label colors are
system tokens shared by every theme. Switching theme or appearance is a token
swap and nothing else.

## Exit-gate status

- ✅ Board renders correctly in 4 themes × 2 appearances (`proof/renders/`,
  from one DOM — the sources differ only in the two root attributes).
- ✅ Switching a project theme changes tokens only — `proof/board.html`
  contains zero hex values (`grep '#[0-9a-fA-F]' proof/board.html`) and zero
  component-specific color overrides.
- ✅ Human and agent activity visually distinct in every tested theme,
  including protanopia/deuteranopia/tritanopia (`accessibility.md`).
- ⏳ Founder approval of the token system and preset set — staged; see
  `decisions.md` (particularly D1 new presets, D9 theme marker, D10
  accessibility adjustments).

**2026-07-31 revision note (ADR 0001):** `proof/board.html` and
`proof/components-library.html` were revised to remove the assignee —
`docs/adr/0001-no-assignee-in-local-mode.md` established that a local
project has exactly one human and no assignee concept, and this pass
closed the remaining gap for these two Step 1 proof pages (the markdown
specs were already brought into line). The committed screenshots in
`proof/renders/` are the exit-gate evidence above and predate this
revision — they still show assignee avatars, the assignee field, and the
assignee control in the ticket panel. The render pipeline that produced
them is not committed, so they have not been regenerated and remain
historical evidence of the pre-ADR-0001 anatomy, not the current HTML.
**Read them as history, not as the spec.** Committing that pipeline and
re-rendering the set is
[V0-41](../../backlog/v0-backlog.md) in Wave 3; until it lands, the exit-gate
row above is evidence about the token system and not about the card anatomy,
and V0-19's screen clause is open.

## Regenerating

```sh
node tokens/build.mjs               # JSON → CSS
node scripts/a11y-check.mjs --write # verify + regenerate accessibility.md
```

Any token change: edit `tokens/design-tokens.json`, run both commands, and
re-open `proof/board.html`. If a screen breaks under a preset, fix the
tokens, never the screen.
