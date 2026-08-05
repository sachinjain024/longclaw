# Current UI Differences From Prototype

This document compares the prototype at
`docs/design/prototype/prototype.html` with the current desktop implementation
captured on August 5, 2026. `docs/design/prototype/screen-specs.md` is the
governing product specification; the screenshots are supporting visual evidence.

The prototype driver bar containing reset, demo, agent, conflict, corruption,
theme, and appearance controls is test-harness chrome and is not implementation
scope. The native macOS title bar in the packaged app is also acceptable platform
chrome. Everything below describes the LongClaw product surface.

## Difference Inventory

### 1. App Shell And Vertical Geometry

- The specified shell has a 240px side panel, one compact content header, the
  board/list surface, and a 24px terminal reservation handle at the bottom of the
  main panel.
- The implementation has a 240px side panel but uses two content-header rows and
  has no terminal handle. This pushes the board down and leaves the main panel
  ending in undifferentiated empty space.
- `--lc-size-board-stack` is currently `calc(100vh - 360px)`, reserving space for
  the old two-row header and development trace strip. Leaving it unchanged after
  the header and terminal work would keep columns materially shorter than the
  available viewport and give board virtualization the wrong viewport geometry.

### 2. Content Header

- The specified header is one compact row: project name, settings gear, path
  chip, file-write indicator, spacer, filter, ordering control, Board/List
  segment, and New ticket.
- The implementation splits this into `project-toolbar` and `board-heading`, adds
  the `LOCAL PROJECT` eyebrow and a second `Board` heading, and places full
  `Starred` and `Settings` buttons beside the project identity.
- Starring does not belong in the content header. Its specified affordance is the
  star on each sidebar project row. Settings remains in the header as a compact
  gear icon button.
- The filter field is missing its visible `⌘F` keyboard chip.
- Ordering is rendered as a separate `Order` label and `Priority` trigger instead
  of one ghost control reading `Order: Priority` or `Order: Manual`.
- The Board/List segment lacks the specified view icons and the solid selected
  treatment.
- New ticket lacks its visible `C` keyboard chip.
- Responsive behavior must preserve one logical header: controls may wrap into a
  deliberate second line at narrow widths, but project identity and controls
  must not revert to separate page-heading sections.

### 3. Path And File-Write Truth

- The specified path is a compact mono chip with a folder glyph, truncation, a
  `wash` hover state, and click-to-copy behavior.
- The implementation renders the path as a plain code line under the title.
- The specified disk indicator reports file-write truth: a spinner with
  `writing ticket.md…` while a named write is in flight, then a quiet
  `✓ ticket.md` acknowledgement.
- The implementation renders `WriteIndicator` alongside a competing filled pill
  for generic `reading`, `reconciling`, or `watching` lifecycle state. The second
  indicator is duplicated, louder, and semantically different from the specified
  optimistic-write contract.

### 4. Side Panel

- The specified active-project side panel contains the logo, Starred and Local
  project sections, the trust line, and the waitlist surface. It does not contain
  persistent Open folder, Create project, or Appearance controls.
- The implementation puts large Open folder and Create project buttons above the
  project sections and an Appearance select in the footer. These controls make
  utilities the first and last visual anchors instead of project navigation and
  trust.
- Empty Starred and Local sections currently render explanatory copy. The
  prototype omits empty section content rather than adding instructional text.
- Project row star buttons use text `★`/`☆` characters. The prototype uses a
  consistent icon glyph, hidden until row hover or focus and persistent in the
  human accent when starred.
- Active rows in the current dark screenshot are taller and more heavily filled
  than the prototype treatment and need theme-equivalent comparison.
- The required `Get early access` footer button and its waitlist state are absent.

### 5. Board Columns And Interactions

- The specified board begins directly below the compact header, uses 264px fixed
  columns with 12px gaps, and gives each card stack its own vertical scroller.
- Every column header must expose a hover/focus-revealed `+` action that opens
  quick create with that column's status preselected. `Board.tsx` currently
  renders only the status dot, title, and count.
- The implementation replaces a zero-ticket board with a centered `EmptyBoard`.
  The specified empty-project state retains all board columns with zero counts
  and places a dashed guided `Create your first ticket` card, explanatory copy,
  and `C` chip in Todo.
- Filter-active/no-match is a different state from an empty project. It must keep
  the specified centered `No matches` panel and Clear filter action and must not
  be routed through the first-ticket state.
- The Canceled column remains conditional: it is shown only when it contains
  visible tickets. The five normal columns remain visible on an empty project.
- The current card title clamp keeps a fixed one-line virtualized geometry while
  the supplied prototype render shows two-line titles. Any change to title height
  must use a fixed, measurable row geometry and pass board performance budgets;
  variable-height cards must not be introduced incidentally during visual tuning.

### 6. Project Settings

- The implementation uses an inline settings panel. The specification requires a
  centered modal dialog opened by the header gear.
- The modal must include Name and Key; Key is disabled after the first ticket and
  shows the mono `locked after first ticket` note.
- Folder must be shown as a read-only mono path with a Locate action.
- Theme uses the four pair-swatch presets. Appearance is a System/Light/Dark
  segment explicitly identified as an app preference rather than project data.
- The danger zone must state that Remove from app only forgets the project and
  never touches files on disk.
- Remove requires a second confirmation dialog that names the path, repeats the
  non-destructive guarantee, and uses the danger button variant.

### 7. Waitlist

- The side-panel footer must provide the quiet `Get early access` ghost button.
- It opens a centered modal with the specified heading and value copy, email
  field, consent line, Join the waitlist primary action, and Not now action.
- Success replaces the modal body with the specified confirmation and
  permanently replaces the footer button with static mono
  `✓ you're on the list`.
- Validation, request-in-flight, and submission failure states must follow
  `docs/design/prototype/states.md`. This is required implementation scope unless
  the governing product specification is separately amended.

### 8. Theme, Density, And Visual Tokens

- The supplied prototype screenshot is Indigo light while the implementation
  screenshot is dark. Color and visual-weight decisions must be compared in the
  same theme and appearance, including
  `docs/design/prototype/renders/board-indigo-dark.png` for dark mode.
- Audit board cards, side-panel active rows, fields, segments, borders, and raised
  surfaces using the existing semantic tokens. The current dark cards and active
  row read more boxed and filled than the prototype.
- Preserve the product's compact operational character: 8px-or-less card radii,
  stable control dimensions, no decorative containers, and no layout movement
  between themes or selected states.

## Implementation Plan

### Step 1: Recompose The Content Header

Update `App.tsx` and `styles.css` so the board and list share one responsive
content-header component.

- Remove the `LOCAL PROJECT` eyebrow, duplicate Board/List page heading, and
  content-header Starred button.
- Render project name, settings gear, copyable folder-path chip, and file-write
  acknowledgement as the identity cluster.
- Render a 190×28px filter with `⌘F` chip, one ordering trigger containing both
  label and value, an icon-bearing Board/List segment with a solid selected
  state, and New ticket with the `C` chip.
- Keep all controls at stable heights and define explicit wrap behavior for
  widths where one row cannot fit.
- Preserve every keyboard shortcut and give each button an explicit `tabIndex`.
  Update the keyboard focus map and probes for the new visual/tab order.

Acceptance criteria:

- At the reference wide viewport, project identity and board controls read as one
  row and columns begin at the prototype's vertical position.
- Starring is available from sidebar rows only; settings opens from the gear.
- `⌘F`, ordering, view selection, and `C` remain operable by pointer and keyboard.

### Step 2: Make The Header Report File-Write Truth

Consolidate `WriteIndicator` and the current `disk-state` surface.

- Make `WriteIndicator` the only header write-status component.
- Pass the affected filename through the write lifecycle so in-flight and settled
  states render the named file.
- Remove the generic `reading`/`reconciling`/`watching` pill from the header.
  Continue to expose blocking load or reconciliation failures through the
  appropriate loading, error, or toast surface, not as disk acknowledgement.
- Match the spinner, mono type, colors, and settled timeout in the screen spec.

Acceptance criteria:

- A ticket write visibly transitions from `writing <file>…` to `✓ <file>`.
- An idle watcher produces no second status pill and New ticket remains the
  strongest header action.

### Step 3: Repair Board States And Column Actions

Update `App.tsx`, `Board.tsx`, quick-create state, and their focused tests.

- Always render the normal board scaffold for a project with zero tickets.
- Add the guided first-ticket card to Todo without inserting a synthetic ticket
  into domain data or counts.
- Keep the filter no-match panel as a separate branch based on active filtering,
  including degraded-ticket behavior and Clear filter.
- Add a `+` icon button to each visible column header. Reveal it on hover and
  `:focus-within`, provide an accessible name, set explicit `tabIndex`, and open
  quick create with that column's status preselected.
- Preserve conditional Canceled-column behavior, status order, card roving focus,
  and keyboard navigation following visual order.
- Decide the title-line treatment only with fixed geometry and performance data;
  do not introduce variable-height virtualized cards in this repair.

Acceptance criteria:

- A new project shows five zero-count columns and the guided Todo card.
- Each column action opens quick create with the correct status, including by
  keyboard.
- Empty-project, no-match, populated, and degraded-ticket combinations have
  focused component tests.

### Step 4: Add The Terminal Reservation And Retune Viewports

Implement the specified Phase 2 geometry without terminal behavior.

- Add a 24px handle at the bottom of the main panel, excluding the side panel,
  with a top hairline and centered mono
  `terminal · reserved · phase 2` label.
- Add the specified hover treatment and `ns-resize` cursor, but no expansion or
  terminal interior in v0.
- Make board and list content end above the handle.
- Replace the stale `--lc-size-board-stack: calc(100vh - 360px)` reserve with a
  value derived from the recomposed header, board padding, and 24px handle.
  Update the associated CSS comments and any board virtualization measurements.
- Check short and tall windows so independent column scrolling starts only when
  content actually exceeds the available main-panel height.

Acceptance criteria:

- The handle is pinned to the main panel and never overlays the side panel,
  board, list, ticket panel, or modal.
- Board/list viewports consume the available height above it and virtualization
  uses that same measured geometry.

### Step 5: Bring Side-Panel Navigation Into Spec

Update side-panel composition and project-row primitives.

- Remove persistent Open folder and Create project buttons from the active
  project side panel. Preserve those tasks in the specified welcome flow and add
  explicit Open folder and Create project actions to the command palette's
  `go to project…` sub-mode before removing the sidebar buttons. Update the
  palette specification and keyboard focus map for those added actions.
- Keep only Starred and Local sections. Remove explanatory empty-section copy;
  omit empty rows/sections according to the prototype state rather than filling
  the panel with instructions.
- Replace text stars with the repository's icon component. Reveal an unstarred
  control on row hover/focus and keep a starred icon persistently visible in the
  project's human accent.
- Retune row height, active fill, dot/icon sizing, and unreachable-project state
  against theme-equivalent prototype renders.
- Keep the mono trust line pinned above the waitlist surface.

Acceptance criteria:

- The side panel reads brand, project navigation, trust, then waitlist.
- Star state, unreachable state, hover, focus, and empty-section behavior match
  the screen and component specifications in light and dark appearances.

### Step 6: Replace Inline Settings With The Complete Modal

Refactor settings into a centered, focus-managed modal rather than extending the
current inline panel.

- Implement Name, locked/unlocked Key, Folder with Locate, pair-swatch Theme,
  Appearance segment, and danger-zone sections.
- Move the persistent side-panel Appearance select into this modal.
- Keep project-backed settings and app-backed Appearance state separate in the
  save/update path.
- Add the destructive-looking but file-safe Remove from app confirmation dialog,
  including the project path and repeated guarantee.
- Define initial focus, focus trap, Escape behavior, close/focus restoration,
  disabled and error states, and explicit `tabIndex` values.

Acceptance criteria:

- The gear opens a centered modal containing every specified field and section.
- Key locking follows ticket existence, Appearance persists as an app preference,
  Locate presents the current folder, and removal never deletes project files.
- Cancel, confirm, Escape, and focus restoration work in both modal layers.

### Step 7: Implement The Required Waitlist Flow

Add the footer entry point and modal as a distinct feature surface.

- Implement the specified content, email field, consent copy, Join the waitlist,
  and Not now actions.
- Implement client validation, disabled/in-flight submission, recoverable failure,
  success, modal close, and focus restoration states.
- Put submission behind a narrow waitlist client module with an injected test
  double, a configured endpoint, a normalized email request, and typed
  success/failure results. Do not couple raw network calls to modal rendering.
- Persist `longclaw.waitlistJoined` in `localStorage` only after the endpoint
  confirms success, matching the existing app-preference persistence model, so
  the footer becomes static `✓ you're on the list` after restart.
- Keep this flow independent from local project access: failure or dismissal must
  never gate a local feature.

Acceptance criteria:

- Footer, modal, success replacement, persistence, and failure behavior match
  `screen-specs.md` and `states.md`.
- The flow is keyboard-complete and makes no unrelated runtime network request.

### Step 8: Tune Theme-Equivalent Visual Density

Perform this pass after structural changes so token adjustments are made against
final geometry.

- Capture Indigo light and Indigo dark at the same viewport and data state as the
  prototype references.
- Audit `--lc-bg`, `--lc-surface`, `--lc-raised`, `--lc-line`, active-row fills,
  control borders, shadows, and status/accent usage.
- Reduce card and row heaviness where necessary without creating one-off colors
  outside the semantic token system.
- Verify all four project themes across System, Light, and Dark, including text
  contrast, focus rings, selected segments, and long text/path truncation.

Acceptance criteria:

- Same-theme comparisons match the prototype's hierarchy, density, and quiet
  contrast without changing control or card dimensions between appearances.

### Step 9: Verification And Regression Gates

Add or update focused unit/component tests with each implementation step, then run
the relevant repository gates on the integrated result.

- Run screenshot checks at the reference wide viewport plus narrow and short
  windows for header wrapping, board height, modal fit, and text truncation.
- Run `npm run matrix` for theme and appearance changes.
- Run `npm run a11y:audit` and its self-test after adding probes because header,
  column actions, settings, waitlist, modal focus, and tab order all change.
- Run `npm run perf:board` and quote its results because column rendering,
  viewport sizing, and potentially card geometry change.
- Run `npm run perf:list` and quote its results because the shared header and
  available list viewport change.
- Run `npm run verify` before each implementation commit.
- Run `npm run build:app`, then run `npm run audit:network` offline and online
  because waitlist submission introduces a runtime endpoint. Verify that idle
  local-project use remains network-silent and only an explicit waitlist submit
  contacts the configured endpoint.

## Suggested Implementation Sequence

1. Header composition and named file-write indicator.
2. Empty-board scaffold and column quick create.
3. Terminal handle and board/list viewport retuning.
4. Side-panel project navigation and star affordance.
5. Complete settings modal and removal confirmation.
6. Waitlist modal, persistence, and failure states.
7. Theme-equivalent token tuning.
8. Integrated screenshots, accessibility, performance, network, verify, and app
   build gates.

Each slice should include its focused tests and remain independently reviewable.
Structural and state corrections come before visual token tuning so later
screenshots measure the intended product geometry rather than the current shell.
