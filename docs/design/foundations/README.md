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
| `scripts/render.mjs` | The render pipeline (`node scripts/render.mjs`); regenerates `proof/renders/` from the two proof pages |
| `assets/owl-mark.svg` | Original geometric owl mark, variant A "talon" |
| `assets/glyphs.svg` | Status / priority / checkbox / agent / folder / warn / description-formatting glyph masters |
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
`proof/renders/` predated that revision and still showed the assignee
anatomy, because the pipeline that produced them was never committed.
**Resolved 2026-08-01 (V0-41):** `scripts/render.mjs` is that pipeline,
committed, and `proof/renders/` is regenerated from the current HTML — no
assignee avatar, field, or control appears anywhere in the set, which
closes V0-19's screen clause. The renders are current evidence again, not
history.

## Regenerating

```sh
node tokens/build.mjs               # JSON → CSS
node scripts/a11y-check.mjs --write # verify + regenerate accessibility.md
node scripts/render.mjs             # proof pages → proof/renders/
```

Any token change: edit `tokens/design-tokens.json`, run all three commands,
and re-open `proof/board.html`. If a screen breaks under a preset, fix the
tokens, never the screen. The render script drives WebKit through
`playwright-core`, resolved from `apps/desktop`; a first run may need
`npx playwright-core install webkit` there.
