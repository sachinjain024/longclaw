---
title: "Step 16a: the implemented UI against the design system"
product: LongClaw
status: completed
backlog_id: "none — Step 16a is a plan step, not a backlog row"
order: 37
owner_area: Design
release_blocking: false
written: 2026-08-01
applies_to: "step-16a-ui-polish @ 6b90101"
depends_on: "nothing — Step 14 is still open and this does not touch it"
---

# Step 16a: the implemented UI against the design system

> "Remove one-off visual values and route typography, spacing, radii, borders,
> elevation, colors, icons, and motion through the design-token and component
> systems." — `docs/mvp_plan_order.md` § Step 16a

## Must-pass

> The implemented MVP surfaces consistently use the approved design system
> without component-specific styling exceptions that are not documented, and
> core flows and trust states look and behave coherently across supported
> themes and appearances.

## What exists today

**Color is already solved and is not this plan's problem.** V0-34's
`scripts/color-guard.mjs` (plan 33) fails the build on any hue outside
`src/tokens/`, and V0-37's theme matrix (plan 35) renders nine states across
four presets × two appearances. Every one of `styles.css`'s colour declarations
reads a `--lc-*` token.

**Every other axis the Step 16a work list names is unguarded, and it shows.**
`styles.css` carries 31 literal `border-radius` values, 69 literal `font-size`
values and 14 literal `font` shorthands. These are not stylistic preferences;
several of them are the design system stated wrong:

| Divergence | Implemented | `components.md` |
|---|---|---|
| Field / trigger radius | `7px`, ten times — **not a value on the radius scale at all** (3·4·5·8·10·14·999) | `--lc-radius-control`, 5px |
| Button height | `min-height: 34px` | `--lc-size-control`, 30px |
| Button type | `font-weight: 650`, size inherited | `--lc-type-ui` — 13px/500 |
| Input height | `34px` | 30px |
| Primary hover / pressed | **absent** — `--lc-accent-human-hover` and `-active` are generated and never read | fill shifts on hover and press |
| Focused field | ring only | ring **plus** a 1px `accent-human` border |
| Disabled | `opacity` + `cursor: not-allowed` | `--lc-ink-disabled` text, `--lc-wash` fill, `cursor: default` |
| Side panel | 268px, a `color-mix` wash of its own invention, 18px 14px padding | 240px, `--lc-bg`, 16px 12px (`screen-specs.md:30`) |
| Project row | 54px, two lines, hover paints a surface + border | 28px, name only, active row `accent-human-soft` + `ink` (`components.md:249`) |
| Project theme dot | 7px, always the **current** project's accent | `--lc-size-theme-dot` 6px, in *that project's own* accent (`screen-specs.md:37`) |
| Unreachable project | whole row goes `danger` | 12px warn triangle replaces the dot, name dims to `ink-3`, row stays clickable (`screen-specs.md:40`) |
| Agent avatar | a filled `accent-agent` square | `--lc-tile` near-black — "a terminal window in miniature" — `❯` in `accent-agent`, 1.5px `accent-agent-avatar-ring` (`components.md:152`) |

The agent-avatar row is the one with product consequence. `components.md:20`
makes the redundancy load-bearing: hue is never the only channel separating the
two actors, and the agent's second channel is *darkness and shape*, not a
second saturated fill. A filled green tile beside a filled accent button is the
distinction resting on hue alone, which D11 forbids.

## What to change

1. **Controls.** Buttons, inputs, selects, menu triggers and the filter field
   take `--lc-size-control` / `--lc-size-control-sm`, `--lc-radius-control` and
   `--lc-type-ui`. Add the four interaction states `components.md:26-32`
   specifies and the build does not have: primary hover/active fills, ghost
   active, secondary's light/dark split, and a disabled treatment that is a
   colour rather than an opacity.
2. **Side panel.** 240px on `--lc-bg` with the spec's padding; 28px single-line
   project rows; the theme dot at 6px scoped to the project's own
   `data-theme`; `accent-human-soft` for the active row; the warn-triangle
   treatment for an unreachable one; the mono `v0 · local · no account` trust
   line pinned at the foot.
3. **The agent tile** takes the terminal anatomy, and the matrix probe that
   asserted the old fill moves to the glyph.
4. **The remaining literals** in `styles.css` route onto the radius, type and
   motion scales. Where a literal is the spec's own number (190×28 filter
   field, 58px key column, 44px progress meter) it stays and says so.
5. **A guard, so this does not rot back.** `scripts/token-guard.mjs` fails the
   build on a literal `border-radius` or a literal motion duration anywhere in
   `src/` outside `src/tokens/`, exactly as `color-guard.mjs` does for hues.
   These two families have complete token coverage, so a literal is always a
   defect — unlike a width or a one-off height, where the spec itself states
   px, which is why the guard stops there and the audit table above carries
   the rest.

## Must-pass checks

- `npm run verify` green: `tokens:check` (now including the new guard),
  format, lint, typecheck, 499+ frontend tests, cargo tests, vite build,
  native watcher.
- `npm run matrix` green over four presets × two appearances × nine states,
  with the agent-tile probe re-pointed rather than dropped.
- `perf:board` and `perf:list` re-traced, because the card and row lanes are
  touched — AGENTS.md § Toolchain requires the numbers be quoted.
- Anything found and deliberately not fixed is recorded in § Outcome as a
  deferred discrepancy, which is Step 16a's third deliverable.

## Out of scope

- **The settings modal.** `screen-specs.md:250` wants a centered modal dialog;
  the build has an inline panel. That is named debt already, in
  [plan 32's outcome](../completed/32-instant-theme-selection.md#outcome), and
  it is a structural change to a surface rather than a visual pass over one.
- **The terminal region reservation** (`screen-specs.md:55`) — geometry for a
  Phase 2 slot that has never been built. Adding it is new surface, not polish.
- **Step 14's trust states.** The conflict, degraded and unreachable states are
  polished here as they exist; the ones Step 14 has not built yet are not
  invented here.

## Outcome

**Shipped.** `npm run verify` green (502 frontend tests, 161 Rust tests, both
guards clean, native watcher round-trip). `npm run matrix` clean over 4 presets
× 2 appearances × 9 states, plus the seven-probe interaction axis. The lanes were touched, so both traces were re-run:
board p95 **15/18/26/16 ms** and list p95 **22/19/21/16 ms**
(keyboard/scroll/filter/external-write), all under the ≤50 ms ceiling and every
median within 4 ms of the 600-ticket floor.

### What the audit turned into

Everything in § What to change landed. Eight things were found while doing it
that the plan did not predict — the last six by two review passes, after the
first commit, which is why they read as corrections rather than discoveries:

1. **The ticket panel's title was being sliced in half.** `.ticket-panel` is a
   flex column that scrolls, and a flex column shrinks its children to fit
   *before* it agrees to scroll — so on any ticket with a full timeline the
   two-row title textarea was compressed and the first line was cut through the
   middle. It was there before this pass and is visible in any render of the
   panel state. `.ticket-panel > * { flex: none }` fixes it: nothing in the
   panel is elastic, it scrolls instead.
2. **The settings theme picker overflowed its column.** The grid gave the
   picker a fixed 160px; four 44px swatches plus gaps need ~206px, so Plum
   rendered *underneath* the Locate folder button in every preset. The column
   is `max-content` now — it is the one column whose width is a component's
   anatomy rather than the panel's choice.
3. **The theme dot did not work, and the first test written for it passed
   anyway.** The accent blocks are compound — `[data-appearance][data-theme]` on
   the same element — so `<span data-theme="plum">` alone matches no block and
   silently inherits the active project's accent, which is indistinguishable
   from working until two projects have different presets. `ThemeSwatch` had
   already solved exactly this and documented the trick; the dot ignored it. The
   subscription is now `appearance.ts`, shared by both, and the dot is a
   `ThemeDot` component beside the swatch. The test that missed it asserted
   `dot.dataset.theme` and nothing else; it asserts the pair now, and fails on
   the broken version.
4. **Two hover states were invisible in dark.** `--lc-wash` and `--lc-raised`
   are the same value in dark, so a secondary button and a popover row — both
   resting on `raised` — hovered to their own resting colour. `components.md:52`
   asks for "lighten via `raised` hover overlay (dark)" and there was no token
   for it, so `--lc-raised-hover` is new: `wash` in light, a real step up in
   dark, one rule for both.
5. **`--lc-motion-spinner` would have survived reduced motion.** `build.mjs`
   emitted a hardcoded three-token reduced-motion block, so the new token — and
   any future one — silently escaped it, which would have made `token-guard`'s
   own stated rationale false. The block is derived from the motion group now:
   every token whose value is a duration is zeroed.
6. **The guard exempted `0.01ms` everywhere.** That literal is right in one
   place — the reduced-motion block, where it is the value that *replaces* the
   tokens — and a blanket exemption meant a production
   `transition: opacity 0.01ms` sailed through the guard built to catch exactly
   that. The exemption is a place now, not a value: the guard finds the byte
   range of each `prefers-reduced-motion` block and skips only inside it.
7. **The primary button carried a border** where `components.md:51` says none,
   and the menu trigger was set in `--lc-type-small` where a control takes
   `--lc-type-ui` — with the ordering trigger overriding that to a literal
   `12px` on top.
8. **The matrix was passing a contrast check it could not actually see.** The
   old disabled treatment was `opacity: 0.42`, and the sampler does not
   composite opacity, so it measured white-on-accent and passed. Replacing the
   opacity with the designed `ink-disabled`-on-`wash` made the real ratio
   visible — 1.95 — and the matrix went red in all eight axes. WCAG 1.4.3
   exempts an inactive component and `--lc-ink-disabled` is below AA *on
   purpose*, so the checker now exempts a disabled probe. It **reports** each
   exemption rather than skipping quietly: a probe that goes disabled when it
   should not be is a finding too, and a silent skip would hide it.

### The interaction axis, added after the review said the states were unheld

The step's work list asks to "validate keyboard focus, hover, pressed,
disabled, selected, optimistic, and external-update states as part of the
visual polish pass." The first pass did that by reading each state against
`components.md` § Global interaction model and fixing what was missing — which
was most of them, since primary had no hover or press at all — and recorded the
absence of automated probes as a gap. It was a fair complaint, so the matrix now
has an **interaction axis**: seven probes over hover, press and focus on the
board's primary, a secondary, a resting card, the filter field, a list row, and
a popover row, run on all eight axes.

It asserts **difference, not a token value**, deliberately. Every hover and
press fill is a `color-mix` derivation, and `getPropertyValue` hands those back
unresolved, so a token probe cannot read one. Difference is also the property
that actually matters, and the one that was broken: a token probe would have
happily confirmed that `.secondary:hover` rendered `--lc-wash` in dark while
that was exactly the bug. Reintroducing that bug now fails four axes — the four
dark ones — and passes the four light ones, which is the right discrimination.

Three things had to be fixed in the harness before any of it worked, and each
was a latent hole in the existing sampler:

- `getComputedStyle(el)[property]` returns `undefined` for a dashed name, so
  every probe on `border-top-color` read as unparseable. It is
  `getPropertyValue` now.
- `color-mix()` serializes as `oklab()` in WebKit and the sampler parsed only
  `rgb()` and `color(srgb …)`, so **every accent derivation in the system** —
  soft, wash, hover, press, ring — was unreadable to it. `oklab()` is parsed
  now, which widens what any future probe can assert, not just these.
- Reduced motion collapses transitions to `0.01ms` rather than removing them,
  so a sample taken in the same turn as the hover reads the *resting* colour.
  The probe waits two frames.

What it still does not cover: `selected` and `optimistic`, and focus only
through the accent border half of the focus treatment — the 3px ring is an
`outline`, and the sampler reads colours rather than widths.

### Deferred discrepancies

These are real gaps against the approved design, deliberately not closed here.
Each is a structural change to a surface rather than a visual pass over one,
which is the line this step drew.

- **Project settings is still an inline panel**, not the centered modal dialog
  at `screen-specs.md:250`, and its Remove flow has no confirm dialog naming
  the path. Named already in
  [plan 32's outcome](../completed/32-instant-theme-selection.md#outcome); this
  pass fixed its layout defects without moving it.
- **The content header is two stacked rows**, not the single 56px header at
  `screen-specs.md:46-49`: the build has a project toolbar (eyebrow, name,
  path, Star, Settings) above a board heading (view name, filter, ordering,
  view segment, New ticket). The spec merges them, with the path as a click-to-
  copy chip and settings as a gear icon button.
- **Welcome is a two-column screen**, not the spec's centered column
  (`screen-specs.md:68`), because the build's create form lives beside the copy
  rather than after a folder pick. The mark, the display greeting, the 420px
  subtitle and the trust line are in; the flow's shape is not.
- **The terminal region reservation** (`screen-specs.md:55-64`) is unbuilt. It
  is geometry for a Phase 2 slot and adding it is new surface.
- **Spacing and border literals stay.** `styles.css` still carries ~114 literal
  `padding`/`gap`/`margin` declarations and ~37 literal `1px solid` borders
  against 11 uses of `--lc-border-hairline`. Only some are on the
  4/8/12/16/20/24/32/40 scale; the rest are component anatomy (`padding: 8px
  12px` on a card foot, 9px on a small button). Routing the on-scale ones and
  leaving the rest would produce a file where a token and a literal mean the
  same thing in adjacent rules, which is worse than either — so this is one
  decision, not a hundred, and it wants a spacing scale that admits half-steps
  first.
- **Font sizes stay literal** where `components.md` specifies component anatomy
  off the type scale — 10.5px mono meta, the 9.5px `AGENT` badge, 11px labels,
  the 15px palette input. `token-guard.mjs` deliberately does not check type or
  spacing for exactly this reason; it would fire on the spec being followed.
  The sizes that *did* match a type role — 13px, 12.5px, 11.5px, and the two
  headings — now read their token.
- **The human avatar has no initials or hashed tint** (`components.md:147`).
  ADR 0001 gives a local project exactly one human called "You", so there is no
  person to hash and no initials to draw. The circle-versus-tile shape channel
  is what carries the distinction, and it does.
