---
title: "Instant per-project theme selection at creation, in settings, and from the palette"
product: LongClaw
status: completed
backlog_id: V0-36
order: 32
owner_area: Frontend
release_blocking: false
written: 2026-08-01
applies_to: "step-13-themes-appearance @ 92be09f"
depends_on: "31 — the crossfade rides the same transition class as an appearance switch"
---

# Instant per-project theme selection at creation, in settings, and from the palette

> "Theme is the project's identity in a multi-project sidebar, and the design
> specifies an instant accent crossfade with no layout movement." —
> `docs/backlog/v0-backlog.md:162`

## Must-pass

> Changing theme crossfades accent surfaces only, moves no layout, and persists
> to the location the format specifies.

## The governing spec

`screen-specs.md:92-98` (§ Theme picker — creation · settings · palette):
44×28px pair swatches (⅔ human / ⅓ agent), radius 5, preset name in
`--lc-type-micro` below, selected = `accent-human` border + focus ring. Four
presets. Selection applies instantly — a 150ms crossfade of accent surfaces
only; no layout movement. `screen-specs.md:286` puts the crossfade on
`--lc-motion-panel` and says "theme/appearance transition colors only — nothing
moves."

## What exists today

- Persistence is done and correct: `changeTheme` (`App.tsx:640-649`) calls
  `update_project_theme`, which `registry.rs:128-130` writes into the project's
  `longclaw.yaml` — the location `file_format.md` § Project metadata specifies.
- The palette's theme sub-mode has swatch rows (`CommandPalette.tsx:260+`,
  `ThemeSwatch.tsx`) and calls the same `changeTheme`.
- Creation (`CreateProjectForm.tsx:97-109`) and settings (`App.tsx:1009-1021`)
  use bare `<select>`s — not the specified picker.
- No crossfade exists anywhere: `styles.css` has no transition on any
  accent-bearing property, so a theme change snaps.
- `changeTheme` calls `loadProject` after the write, which re-fetches the whole
  snapshot and raises the loading state — a skeleton flash on what the spec
  says is a color-only transition.

## What to change

1. **`src/ThemePicker.tsx`** — the specified picker: a radiogroup of the four
   presets, each a visually-hidden native radio + a 44×28 `ThemeSwatch` + the
   preset name in micro type. Native radios give the arrow-key group behavior
   for free. Selected wears the `accent-human` border and focus ring.
2. Use it in `CreateProjectForm` (replacing the select) and the settings panel
   (replacing the select, calling `changeTheme` on change). The palette keeps
   its rows — it already meets the spec.
3. **Crossfade**: a transient `theme-transition` class on `<html>`, applied by
   the `data-theme`/`data-appearance` effects when the value actually changes
   (not on first stamp), removed after `--lc-motion-panel` + a small buffer.
   The CSS transitions color-bearing properties only (background-color,
   border-color, color, fill, box-shadow) — never layout properties.
   `prefers-reduced-motion` already zeroes the motion tokens.
4. **`changeTheme` stops re-loading the project.** It flips the reference
   optimistically, writes `update_project_theme`, adopts the returned
   reference, and reverts + surfaces the error on failure. No snapshot
   re-fetch: theme is a fact about `longclaw.yaml`, not about tickets.

## Must-pass checks to add

- `App.test.tsx` (settings path): picking a preset calls
  `update_project_theme` once with the project id and preset, flips
  `data-theme` before the write resolves, calls no `open_project` re-fetch, no
  `edit_ticket`, and no ticket write of any kind; a failed write reverts
  `data-theme` and shows the error.
- Crossfade: the transition class appears on the root for a theme change and is
  gone after the motion window; the first mount never wears it.
- `CreateProjectForm.test.tsx`: the picker is a radiogroup; picking Slate
  submits `theme: "slate"`.
- `CommandPalette.test.tsx` already pins the swatch rows; unchanged.

## Outcome

Done 2026-08-01. `src/ThemePicker.tsx` is the specified picker — native radios
in a fieldset wrapping the existing `ThemeSwatch` at 44×28, preset name in
micro type, selected = human-accent border + ring — used by the create form
and the settings panel; the palette keeps its rows. The crossfade is one
transient `theme-transition` class on `<html>` (a module-level `crossfade()`
in `App.tsx`, 220ms so the 150ms transition finishes before the rule leaves),
under which `styles.css` transitions background-color, border-color, color,
fill, stroke and box-shadow only. Both the theme effect and the appearance
stamp call it, and both skip the first stamp, so launch never animates.

`changeTheme` is optimistic and no longer re-loads the project: the reference
flips before the write, adopts the returned reference on success, reverts and
raises the error on failure. The write path is unchanged —
`update_project_theme` → `registry.rs` → `longclaw.yaml`, the location the
format specifies.

Four claims in `App.test.tsx` § "instant per-project theme selection (V0-36)"
— instant apply with only the project file written, crossfade on change and
never on first stamp, revert + error on a refused write, and exactly the four
fixed presets with no custom-color affordance — three confirmed red against
the previous `changeTheme`. `CreateProjectForm.test.tsx` drives the picker as
radios.

**One thing worth a look:** the settings panel is still the inline section
Wave 0 built, not the centered modal `screen-specs.md:251-258` describes, and
this plan deliberately did not rebuild it — only the theme control inside it
now matches the spec. The modal shape (and its Appearance segment) is settings
debt, not theme debt.
