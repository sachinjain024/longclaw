# LongClaw design foundations — Phase 0, Step 1

Implementation-ready visual foundations for the approved Linear-family
direction (`../fable-design-system-v1.mhtml` + `docs/design_brief.md`, final
iteration). Everything here is the deliverable set for MVP plan Step 1.

## Layout

| Path | Deliverable |
|---|---|
| `components.md` | Component foundations & interaction-state specifications |
| `decisions.md` | Decision log — every **[proposed]** brief item resolved (D1–D17) |
| `accessibility.md` | Generated WCAG AA + color-vision-deficiency results (226 checks) |
| `scripts/a11y-check.mjs` | The checker (`node scripts/a11y-check.mjs --write`); exits non-zero on any failure |
| `scripts/render.mjs` | The render pipeline (`node scripts/render.mjs`); regenerates `proof/renders/` from the two proof pages |
| `assets/owl-mark.svg` | Original geometric owl mark, variant A "talon" |
| `assets/glyphs.svg` | Status / priority / checkbox / agent / folder / warn / description-formatting glyph masters |
| `proof/board.html` | **Board proof** — open in a browser; switch 5 themes × 2 appearances live |
| `proof/components-library.html` | **Components library** — every foundation component as a live specimen: type, color (with live-resolved token values), space/radius/elevation/motion, buttons, fields, chips, status, priority, avatars, checklist, cards, list view, timeline, ticket panel, toast/banners, navigation, empty states, brand |
| `proof/fonts.css` | Fonts extracted from the approved reference (latin subsets, offline proof) |
| `proof/renders/` | Headless-rendered screenshots — board in all 10 combinations, library in light/dark |

## Where the tokens live

**`apps/desktop/src/tokens/design-tokens.json` — the one token source.** It is
generated into `design-tokens.css` beside it by `src/tokens/build.mjs`, and that
one stylesheet is what the app, the prototype, both proof pages and the
accessibility checker all read.

There used to be a second copy under `foundations/tokens/`, labelled the source
of truth while the app shipped the other one. They stopped tracking each other
at LC-183, and the accessibility checker read the stale one — so 226 AA and CVD
checks were being proved against values no user ever saw. LC-192 deleted the
fork; `apps/desktop/scripts/token-source-guard.mjs` fails the build if a second
copy reappears, or if any page under `docs/design/` links a token file that is
not the shipped one.

## Token contract

Set both axes on the root element:

```html
<html data-theme="light|dark" data-lc-theme="indigo|clay|slate|plum|graphite">
```

`data-theme` carries the **appearance**, `data-lc-theme` the **preset** —
the contract Claude Design's `theme-v3.css` uses. Until LC-192 the repo had
these two names swapped relative to the design system, so markup could not
move between them (LC-192 § A1).

Components consume only `--lc-*` custom properties. A theme preset supplies
six values per appearance (accent, AA text variant, on-accent × human/agent);
every soft/hover/ring/rail/wash variant derives via `color-mix(in oklab, …)`
in the generated CSS. Neutrals, status, warn/error and label colors are
system tokens shared by every theme. Switching theme or appearance is a token
swap and nothing else.

## Exit-gate status

- ✅ Board renders correctly in 5 themes × 2 appearances (`proof/renders/`,
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
npm --prefix apps/desktop run tokens:build  # JSON → CSS
node scripts/a11y-check.mjs --write         # verify + regenerate accessibility.md
node scripts/render.mjs                     # proof pages → proof/renders/
```

Any token change: edit `apps/desktop/src/tokens/design-tokens.json`, run all three commands,
and re-open `proof/board.html`. If a screen breaks under a preset, fix the
tokens, never the screen. The render script drives WebKit through
`playwright-core`, resolved from `apps/desktop`; a first run may need
`npx playwright-core install webkit` there.
