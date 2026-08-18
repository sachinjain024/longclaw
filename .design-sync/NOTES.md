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
