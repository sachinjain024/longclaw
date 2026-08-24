---
format: longclaw.ticket/v1
id: a8703800-dc79-4583-ad74-d27d6dbb3bf1
key: LC-231
title: Ochre as the default preset, more presets, and a swatch without the green
status: todo
priority: none
labels:
  - design
  - frontend
created_at: 2026-08-24T23:16:20.668Z
updated_at: 2026-08-24T23:16:20.668Z
---

Three founder notes, one theme change: add **Ochre** and make it the default,
add more presets beyond it, and drop the green from the preset swatch — the
agent accent is constant in every theme, so repeating it on every chip says
nothing.

Design first. A UX prototype and an approved hue before anything in the token
source moves; then design sync; then the docs that still say four or five
presets.

## Ochre

The brand ochre is already written down: **`#B45F06`**, the app-icon colour
(`website-content-brief.md:28`, `website-prompts.md:34`), shipped as
`assets/brand/app-icon/in-app/longclaw-mark-ochre.png`. The website already
runs on it — there is a separate "LongClaw Website" design system in Claude
Design built around it (`website-prompts.md:11`). The app has never had it.
Adding it makes the product's default accent the colour of its own icon.

Two things it must clear before it can be the default:

- **The warm band is contested.** D1's rejected-candidate list turns down
  Amber/Gold because it "collides with the In Progress status color", and In
  Review is orange. `#B45F06` is darker and browner than both, but the
  prototype has to show a board where In Progress, In Review and Done sit
  beside an ochre human accent — and by D5, Done *is* the human accent. If they
  do not separate, the answer is to move the hue, not to ship the collision.
- **The checker settles the value.** `npm run a11y:contrast`
  (`docs/design/foundations/scripts/a11y-check.mjs`, a step of `tokens:check`
  and therefore of `verify`) runs contrast plus protanopia, deuteranopia and
  tritanopia separation over every human/agent pair. Clay's dark accent and
  Slate's light accent were both moved by it. `#B45F06` is a proposal and still
  needs a dark-appearance partner; expect both to shift. The DS readme states
  the rule: propose hues, let the checker settle them.

**Default** means the picker's preselection and the bare-document fallback.
`build.mjs:313` pushes indigo into `:root` for a document carrying no theme
axis; that moves too, or the default is only half applied. Existing projects
keep the theme stored in their own `longclaw.yaml` — a default is what a new
project starts on, not a migration.

## The swatch

`ThemeSwatch` draws ⅔ human accent and ⅓ agent green, and it is one component
in three places: the creation form, project settings, and the palette's theme
rows. **All three lose the green** (founder, this ticket) — the chip shows the
human accent alone, because the preset is the only thing that varies between
them and D2 fixes the agent green in every preset. `ThemeDot` in the sidebar
already draws the human accent alone and does not change.

This retires the pair geometry from two line-cited documents:
`components.md:292-297` and `screen-specs.md:112-118`, the second of which also
carries the 44×28 and 36×22 sizes. Both are pinned by `citation-guard` —
replace prose in place where you can, re-point whatever cited it, then
`npm run citations:update`. Do not `--update` to clear a red run.

## More presets

The prototype proposes the candidates; the founder approves the set and the
count before implementation. That is the route D1 records for adding presets,
and D1's rejected list is the constraint to design against — it exists so
candidates are not re-proposed blind: Teal/Emerald (sits in the agent's hue
band), Amber/Gold (In Progress), Rose/Red (danger and the Urgent glyph),
Ink/Mono (erases human presence from the timeline).

## The preset count is already wrong, in two directions

Nothing agrees on how many presets there are, and this ticket adds to the pile
before it clears it:

- **Five in the app** — `App.tsx:136` and `tokens/claude-design/themes.css`
  both carry Graphite.
- **Four in the matrix.** `perf/theme-matrix.mjs:36` is
  `["indigo", "clay", "slate", "plum"]`. Graphite has never been rendered by
  `npm run matrix` — the one check that would catch a preset with a broken
  accent has never seen it. Hand-listing is why. Enumerate from the token
  source so the next preset cannot be missed the same way.
- **Four in the prose, correctly** — `mvp_plan_order.md:567,675,704`,
  `docs/acceptance/final-acceptance-2026-08-04.md:61,273`, completed plans 34
  and 35, and V0-34/36/37 in `v0-backlog.md`. These are history and were true
  when written. **Leave them.**
- **Five in the live statements** — `decisions.md:9` (D1),
  `screen-specs.md:112-118`, `website-content-brief.md:27,155`,
  `website-prompts.md:164`, and the DS readme's theme table. These are the ones
  to fix.
- **Stale and already resolved** — `vision.md:118` and `design_brief.md:72`
  still carry a "2–3 additional presets · To be proposed" row that D1 and D17
  settled.

A doc describing what shipped on a date is not drift. Fix what claims to be
current.

## Design sync

The accent layer in the Claude Design system is generated, not hand-authored:
`tokens/themes.css` there comes from `apps/desktop/src/tokens/design-tokens.json`
here (DS readme, LC-192). So the order is token source → `npm run design:emit`
→ push the regenerated file to **"LongClaw DS v3 — system"**, the app's system,
*not* "LongClaw Website". `npm run design:check` fails when the emitted output
and the committed copy differ. The DS readme's own preset table is hand-authored
prose — the new rows and the moved default go in by hand.

## Checklist

- [ ] UX prototype under docs/ux/prototypes/ — Ochre light and dark on a board carrying In Progress, In Review and Done at once, the single-accent swatch in all three of its places, and the proposed additional presets — reviewed before any token change <!-- longclaw:item=ck_12f43c28 -->
- [ ] Founder approves the final preset set and the ochre pair's values off the prototype; D1 records the new set with Ochre marked default and its rejected-candidate list left intact <!-- longclaw:item=ck_a94a54eb -->
- [ ] Ochre lands in design-tokens.json with light and dark human accents, npm run a11y:contrast green, and any value the checker moved recorded with its reason the way Clay's and Slate's are <!-- longclaw:item=ck_4742a3c0 -->
- [ ] Ochre is the default: preselected by the picker at creation and the :root fallback in build.mjs; an existing project's stored theme in longclaw.yaml is untouched <!-- longclaw:item=ck_40d7a654 -->
- [ ] The approved additional presets ship with it, each through the same contrast and colour-vision gate <!-- longclaw:item=ck_8121d29d -->
- [ ] ThemeSwatch draws the human accent alone in the creation form, settings and the palette; ThemeDot is unchanged; components.md:292-297 and screen-specs.md:112-118 are rewritten to match and npm run citations:check is green after re-pinning <!-- longclaw:item=ck_d7881893 -->
- [ ] perf/theme-matrix.mjs enumerates presets from the token source instead of its hardcoded four, and npm run matrix is green across every preset × 2 appearances × 9 states — Graphite rendered for the first time <!-- longclaw:item=ck_bc60d09c -->
- [ ] Design sync: npm run design:emit run, themes.css pushed to LongClaw DS v3 — system and not the website system, and the DS readme's preset table updated by hand <!-- longclaw:item=ck_90b874cb -->
- [ ] The live preset-count statements are corrected — D1, screen-specs.md, website-content-brief.md, website-prompts.md:164, the DS readme, and the stale 2–3-additional-presets rows in vision.md:118 and design_brief.md:72 — with the completed plans, the acceptance record and the v0-backlog history left as written <!-- longclaw:item=ck_90e95e64 -->
- [ ] npm run verify passes and the matrix run is quoted on the ticket <!-- longclaw:item=ck_dc05b89a -->

## Activity

<!-- longclaw:event
id: evt_7ea99e04
kind: create
occurred_at: 2026-08-24T23:16:20.668Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
