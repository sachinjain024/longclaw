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
  **That protection still stands.** What changed on 2026-09-09 is that a second,
  deliberate, hand-made duty sits beside it — component parity. See
  "The parity duty" below. Automation still owns one layer; a human or an agent
  editing named components on purpose owns the other. Neither is an import.

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

## The parity duty (added 2026-09-09, by user direction)

The project is not only a record of the app's design — it is **designed in
directly**. New work gets started in Claude Design against these components, and
the design agent can only build from what the project actually contains. So a
component the app has and the project lacks is not a documentation gap; it is a
gap in every future design made here. That is the whole reason this duty exists,
and it is the test to apply when deciding whether something is worth adding:
*would its absence make the design agent invent its own version?*

**The parity roster** — the app module each component answers to. When one of
these changes in the app, the project's copy is stale and it is somebody's job:

| Project component | App source | Notes |
|---|---|---|
| `cards/BoardCard` | `boardCard.ts` | due in the key row; estimate/type in the footer |
| `lists/ListItem` | `listRow.ts` | shares `presentDue` with the card |
| `menus/Menu` | `Menu.tsx`, `MenuList.tsx` | **one primitive, twelve call sites** |
| `menus/ContextMenu` | `TicketContextMenu.tsx`, `ticketMenu.tsx` | a preset of `Menu` |
| `forms/PropertyControl` | `PropertyControl.tsx` | all four properties, five surfaces |
| `panels/TicketPanel` | `TicketPanel.tsx` | the 660px rail fold |
| `indicators/DueChip` | `dueChip.ts` | the rung vocabulary the other three share |

**Three rules that keep parity from going wrong:**

- **Build the primitive, not the instance.** The app has one `Menu` behind the
  context menu, the property dropdowns, the label menu, the settings menu and
  estimate — twelve importers. Shipping a "priority dropdown" and a "context
  menu" as unrelated components would encode a duplication the app does not
  have, and the design agent would inherit it. Same for `presentDue`: it is
  already shared by `boardCard.ts` and `listRow.ts`, so it is one component here
  too, not a detail redrawn inside each surface.
- **A layout component must carry its own responsive rule.** `TicketPanel`'s
  point is not the rail, it is that the rail *folds* under 660px — a container
  query on the panel box, never a window media query, because the width is a
  dragged remembered number (LC-227/LC-238s). A panel component that only draws
  the wide case teaches the agent the wrong thing.
- **Rebuild `_ds_bundle.js` whenever a `.jsx` changes.** The cards render the
  bundle, not the source. This is written twice in this file because LC-223 got
  it wrong once.

**Parity is still not an import.** It is edited component by component, by hand,
with the render check below. `config.json` stays `token-layer-only` precisely so
that no future run mistakes this duty for a licence to regenerate the project.

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

## 2026-09-09 — token-layer re-sync: no drift, nothing uploaded

- Gate green: `npm run design:emit` regenerated all three files and
  `git diff --exit-code` found nothing, so the committed CSS is what
  `design-tokens.json` produces today.
- All three remote `tokens/*.css` are **byte-identical** to the emitter output
  (`themes.css` 18,612 B both sides; `colors.css` and `typography.css` exact).
  sha256[:12] — themes `5ea1ce9a20ce`, colors `975afc1f505c`,
  typography `7ca457056d77`.
- Therefore **no upload and no sentinel write**: the remote is already converged,
  and a no-op write would only churn the project. Convergence, not a push, is
  what this mode owes.
- Remote `styles.css` @import order re-checked and still correct
  (fonts → colors → typography → spacing → **themes last**).
- The project's hand-authored layer is intact and untouched: eleven components
  across seven groups, fifteen guideline pages, `tokens/{fonts,spacing}.css`,
  `ui_kits/longclaw-app`, `uploads/`, `readme.md`.
- Tip for the next run: `themes.css` is 13 blocks off one template, varying only
  by selector, appearance and the human accent pair. Rebuilding it parametrically
  from those four facts and byte-diffing beats transcribing 18 KB.

## 2026-09-09 (second pass) — the parity build (explicit user direction)

Went beyond token-layer-only at the user's request, to close the gap LC-227
opened. Six components: `BoardCard` updated, `DueChip`, `ListItem`, `Menu`,
`MenuList` and `TicketPanel` added, each with `.jsx`, `.d.ts`, `.prompt.md` and
a card; plus a rebuilt `_ds_bundle.js` (16 components) and a `readme.md` that
carries the three rules. Three new groups: `lists/`, `menus/`, `panels/`.

**What the user asked for and what shipped differed, deliberately.** "Priority
dropdown" and "context menu panel" are not two things in the app — they are
`Menu` (flat, one field's values) and `MenuList` (mixed rows), twelve importers
between them. Shipping them as two bespoke components would have encoded a
duplication the app does not have. `DueChip` was added unasked for the same
reason: `presentDue` is already shared by `boardCard.ts` and `listRow.ts`, so
three surfaces redrawing the rungs privately was the alternative.

**`BoardCard` lost its status mark.** The app's card has none — the column names
the status, which is exactly why `listRow.ts` puts a dot on the row. The prop is
still accepted and ignored so older designs keep running.

### The pipeline, which is now proven rather than assumed

- The vendored `_ds/` snapshot under `docs/ux/prototypes/LongClaw Settings Screen UI/`
  is **pinned at LC-223 and predates LC-196** — its BoardCard hashes
  `f0eecbc55a62` against the live `be2e0548b8f5`. Patching it would have
  resurrected the retired components. Fetch the live bundle instead.
- The compile is `esbuild --loader=jsx --jsx=transform --format=esm` over
  **stdin** (`--loader` without an extension only applies to stdin), then strip
  `^import`, strip the trailing `export {…};`, and rewrite
  `React.createElement(X,` → `React.createElement(__ds_scope.X,`. Verified by
  recompiling the live `BoardCard.jsx` and matching the live section exactly.
- Section order is free: `__ds_scope` refs resolve at render, not definition.
  The header's `components` array is sorted by `sourcePath`.

### Four defects the checks caught that a green build would not have

1. **`const Set = …` in a card shadows the global `Set`**, and React's key
   validation does `new Set()` — so any card rendering an array died with
   `knownKeys.add is not a function`. Three of five cards. Never name a demo
   component `Set`.
2. **The menus stretched to fill their parent.** In the app a popover gets its
   width from `position:fixed`; a DS component is dropped into arbitrary
   layouts, so it needs `width:fit-content` above its min-width floor or every
   menu in every design is full-bleed.
3. **Card panes overflowed their viewports** — the existing board card was
   already doing this before this run. `.pane` needs `min-width:0`, because a
   grid item's `min-width:auto` pushes it past its `1fr` track.
4. Viewports must actually fit their content: `fit.mjs` asserts both axes.

Harness lives in the session scratchpad, not the repo: `build-bundle.mjs`,
`smoke.mjs` (node + React stub), `render-check.mjs` (24 geometry assertions in
WebKit, including the fold at 720/600), `card-check.mjs` (every card renders,
no console errors, nothing spills its pane), `fit.mjs`. **If parity work
recurs, move these into the repo** — rebuilding them each time is the expensive
part, not the components.

### Still open

- `ui_kits/longclaw-app/index.html` still shows the pre-LC-227 panel and is
  flagged provisional in its own README. Left alone: it is an extrapolation, and
  `panels/TicketPanel` is now the thing to build from. The readme says so.
- `PropertyControl` (five surfaces in the app) is not a DS component; the panel
  draws its rail rows itself. A candidate if the rail gets reused.
