# design-sync notes — LongClaw

## The relationship (do not invert it)

- The Claude Design project **"LongClaw DS v3 — system"** (`d34ededb-196a-431f-b064-1ab2ef09bfe1`)
  is the **hand-authored design source**: its eleven v1 components, guideline pages,
  `styles.css`, `tokens/fonts.css`, `tokens/spacing.css`, ui_kits and uploads are
  authored in the project and **cannot be regenerated from this repo**.
- This repo is the LongClaw desktop app, not a component library. It owns exactly one
  layer of the project: the generated token CSS. `apps/desktop/src/tokens/emit-design-system.mjs`
  (LC-192, expanded LC-223) emits `claude-design/{themes,colors,typography}.css` from
  `design-tokens.json` in the project's own dialect, v1 aliases included.
- Therefore `/design-sync` in this repo means **token-layer-only** (see `config.json`,
  `mode`): upload those three files into the project's `tokens/`, touch nothing else.
  A standard full import would replace/delete the hand-authored kit — never run one
  against this project without the user explicitly choosing that, knowing the cost.

## Mechanics that matter

- Remote `styles.css` @imports fonts → colors → typography → spacing → **themes last**
  (its v1 aliases must override colors.css's hardcoded accent pair). Keep that order.
- Gate before upload: `npm run design:check` in `apps/desktop` (regenerate + fail on drift).
- Upload order: `_ds_needs_recompile` sentinel → the three CSS files → sentinel again.
- **No `_ds_sync.json` is written, on purpose.** This scoped sync doesn't manage the
  full layout, so an anchor would vouch for state it never verified. Every run
  re-verifies the token layer; that's cheap and correct.
- 2026-08-18: first run of this skill. Remote `colors.css`/`typography.css` were already
  byte-identical to the emitter output (LC-223 had shipped by hand); all three were
  re-uploaded to converge `themes.css` deterministically.
- No conventions header is authored: this mode generates no README — the project's
  `readme.md` is hand-authored in the project and stays untouched.

## 2026-08-19 — LC-195/LC-196 close-out (explicit user direction)

- This run went beyond token-layer-only **at the user's explicit request** (complete
  LC-195/LC-196): rewrote `StatusIcon` (D3 dots), `PriorityIcon` (D4 chips),
  `BoardCard` (no assignee slot, ADR 0001), Avatar docs, both indicator/board/avatar
  cards, `readme.md`, and `ui_kits/longclaw-app/index.html` in the DS project.
  The standing rule is unchanged: a plain `/design-sync` run is still token-layer-only.
- **`_ds_bundle.js` must be rebuilt whenever a component `.jsx` changes** — LC-223
  updated BoardCard.jsx but not the bundle, and cards render the bundle, not the
  source. Recipe: format-4 header, `sourceHashes` = sha256 hex[:12] of each `.jsx`'s
  bytes; sections are esbuild `--loader=jsx` output (imports stripped,
  `export function`→`function`, cross-component refs via `__ds_scope.X`) wrapped in
  per-component try/catch. Smoke-test in node with a React stub, then render the
  cards headlessly (playwright-core webkit, in apps/desktop/node_modules).
- Emitted layer since D23/LC-196: `--warn-ink`, `--danger-surface`,
  `--priority-chip-text/-border` exist; `--priority`/`--priority-off` are GONE —
  never reintroduce them.
- Document project `LC Fable v3 Design System` (809bce20-…): vendored `_ds/` snapshot
  refreshed by direct file writes (bundle, readme, styles, five token css — themes.css
  had been missing). Its `_ds_manifest.json` is app-generated; left alone. The
  canonical brief now lives at `uploads/design_brief.md` (v3 html draft deleted).
