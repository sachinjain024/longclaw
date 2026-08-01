---
title: "Every token on every component, and a guard that keeps it that way"
product: LongClaw
status: active
backlog_id: V0-34
order: 33
owner_area: Design
release_blocking: false
written: 2026-08-01
applies_to: "step-13-themes-appearance @ 92be09f"
depends_on: "nothing"
---

# Every token on every component, and a guard that keeps it that way

> "The foundations exist and the shell uses them; Step 13 is where the rest of
> the app stops carrying literal colors. A check is what keeps it that way." —
> `docs/backlog/v0-backlog.md:160`

## Must-pass

> A build fails on a hardcoded accent or a missing theme value; every component
> renders from tokens in all four presets.

## What exists today

- The audit is already clean: `rg` over `src/**` excluding `src/tokens/` finds
  **zero** color literals — no hex, no `rgb()`/`hsl()`/`oklch()`, no named
  hues. Every one of the ~463 color declarations in `styles.css` reads a
  `--lc-*` token. Step 13's "apply every token" work was, it turns out, done
  incrementally by Waves 1–2; what is missing is only the check that keeps it
  true.
- `tokens/build.mjs` generates CSS from `design-tokens.json` but does not
  validate the JSON: a theme missing an accent value would emit the string
  `undefined` into the CSS and ship.
- `npm run tokens:check` (part of `check`, and therefore CI) only asserts the
  generated CSS is current.

## What to change

1. **`build.mjs` validates before it writes.** Every theme must define all six
   accent roles (`human`, `human-text`, `on-human`, `agent`, `agent-text`,
   `on-agent`) for both appearances; every appearance-varying color group must
   carry both `light` and `dark`. A gap is a thrown error naming the token, so
   `tokens:check` — and with it `check` and CI — goes red.
2. **`scripts/color-guard.mjs`** (new, in `apps/desktop`): scans
   `src/**/*.{ts,tsx,css}` minus `src/tokens/` for color literals — hex,
   `rgb()`/`rgba()`/`hsl()`/`hsla()`/`hwb()`/`oklch()`/`oklab()`/`lab()`/
   `lch()`/`color()` — and exits non-zero naming each offender. Named CSS
   colors are out of scope (a regex over names like `red` drowns in false
   positives); the functional and hex forms are how a hue actually arrives in
   a diff.
3. Wire the guard into `tokens:check` so one npm script owns "the token
   contract holds".
4. "Every component renders from tokens in all four presets" is proven by the
   V0-37 matrix (plan 35), which renders the real surfaces under every preset ×
   appearance; this plan's guard is what makes a regression a build failure
   rather than a screenshot diff.

## Must-pass checks

- Injecting `#ff0000` into `styles.css` fails `npm run tokens:check`.
- Deleting `themes.plum.agent.dark` from `design-tokens.json` fails
  `tokens:check` with the token named.
- An unmodified tree passes.

## Outcome

_To be written on completion._
