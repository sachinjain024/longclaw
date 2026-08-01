---
title: "Commit the screenshot pipeline and regenerate the Step-1 proof renders"
product: LongClaw
status: completed
backlog_id: V0-41
order: 34
owner_area: Design
release_blocking: false
written: 2026-08-01
applies_to: "step-13-themes-appearance @ 57bce26"
depends_on: "nothing — the corrected HTML has been waiting since plan 11"
---

# Commit the screenshot pipeline and regenerate the Step-1 proof renders

> "One uncommitted tool leaves a stale record uncorrectable and a check
> unbuildable." — `docs/backlog/v0-backlog.md:165`

## Must-pass

> The pipeline is in the repo, runs from `foundations/README.md` § Regenerating,
> and reproduces the render set from the current HTML; the regenerated renders
> show no assignee avatar, no assignee field and no assignee control (ADR 0001),
> which closes V0-19's screen clause.

## What exists today

- `docs/design/foundations/proof/` holds the two corrected HTML pages
  (`board.html`, `components-library.html`, revised under plan 11) and
  `renders/` with ten stale PNGs that still show the pre-ADR-0001 assignee
  anatomy: `board-{indigo,clay,slate,plum}-{light,dark}.png`,
  `library-clay-dark.png`, `library-indigo-light.png`.
- The script that made them was never committed
  (`foundations/README.md:53-63`).
- A committed precedent exists at `docs/design/prototype/scripts/render.mjs`,
  but it depends on full `playwright` + a local Chrome — neither is a repo
  dependency. `apps/desktop` already carries `playwright-core` and its perf
  harness launches WebKit, which CI already knows how to install.

## What to change

1. **`docs/design/foundations/scripts/render.mjs`** — renders the ten PNGs
   from the two HTML files at 1440×900: the board across all four presets ×
   two appearances (set via the root `data-theme`/`data-appearance`
   attributes, matching the token contract), the library in its two
   spot-checks. It resolves `playwright-core` out of `apps/desktop` via
   `createRequire`, so the docs tree gains no package.json.
2. Regenerate `proof/renders/` and verify no assignee appears (the HTML is
   already clean — `rg -i 'assign' proof/*.html` — so the renders follow).
3. Update `foundations/README.md`: § Regenerating gains the render command;
   the 2026-07-31 revision note and the exit-gate rows stop describing the
   renders as stale history.
4. Update the V0-19 row in the backlog: its screen clause closes.

## Must-pass checks

- `node scripts/render.mjs` from `docs/design/foundations` reproduces all ten
  files, deterministically named.
- `rg -i "assign"` over the proof HTML stays empty; a human look at the
  regenerated board and library renders confirms no avatar/field/control.

## Outcome

Done 2026-08-01. `docs/design/foundations/scripts/render.mjs` renders the ten
PNGs from the two proof pages — board at 1400×860 across all four presets ×
two appearances, library full-page at 1200 wide in its two spot-checks —
setting the two root attributes exactly as the token contract says a theme
changes. It drives WebKit through `playwright-core` resolved out of
`apps/desktop` via `createRequire`, so the docs tree gains no dependency
manifest. `proof/renders/` is regenerated; the board renders show no assignee
avatar and the library shows no assignee field or control (verified visually
and by the HTML staying `assign`-free outside its explanatory prose), which
closes V0-19's screen clause. `foundations/README.md` § Regenerating gains
the command and the revision note now records the resolution instead of the
gap.

**Two things worth knowing.** The renders are WebKit now, not whatever
uncommitted browser produced the originals — sizes and rasterization differ
from the stale set, which is fine because the set's job is to show the
current HTML, and WebKit is the engine the product ships in. And the library
page has grown since the originals (10115px tall against 9600), so the
regenerated set is not pixel-comparable with the old one; nothing should try
to be.
