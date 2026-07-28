# LongClaw v0 — component & layout specifications

> Phase 0, Step 2 deliverable. Screen- and layout-level specification for
> every v0 surface. Component anatomy (buttons, chips, avatars, status dots,
> priority glyphs, cards, checklist rows, timeline entries, toasts, banners)
> is specified in `../foundations/components.md` and is **not** repeated here
> — this document adds the geometry that assembles those components into
> screens. Every value below is expressed in `--lc-*` tokens or px where a
> token does not exist yet. The live reference is `prototype.html`.

## App shell

```
┌────────────────────────────────────────────────────────────┐
│ side panel 240px │ main (flex)                             │
│                  │  content header 56px                    │
│                  │  board / list (flex, scrolls)           │
│                  │  ── terminal region (reserved) ──       │
│                  │  handle 24px (collapsed)                │
└────────────────────────────────────────────────────────────┘
```

- **Side panel:** 240px fixed, `--lc-bg`, right hairline `--lc-line`.
  Padding 16px 12px. Logo row (22px owl + Familjen Grotesk 14.5/600),
  section headers mono 10.5px uppercase `ink-3` (12px 8px 6px padding),
  project rows 28px (spec in components.md § App shell). Footer pinned to
  bottom: mono micro line `v0 · local · no account` (`ink-disabled`), then
  the waitlist ghost button (30px). Sections in v0: **Starred**, **Local** —
  nothing else, no Teams stubs.
- **Project row anatomy:** 6px theme dot in the *project's own* human accent
  (rendered by scoping that project's `data-theme` on the dot), name 13px
  `ink-2`, star affordance revealed on hover (persistent when starred, in
  `accent-human`). Unreachable projects swap the dot for a 12px warn
  triangle in `--lc-warn` and dim the name to `ink-3`; the row stays in
  place and stays clickable.
- **Active row:** `accent-human-soft` bg, `ink` text, 500 weight.
- **Content header:** padding 16px 24px 12px. Project name
  (`--lc-type-title`), settings gear (ghost icon button), path chip (mono
  12px, folder glyph, click copies, hover `wash`), disk-state indicator
  (below), spacer, filter field (190×28px), view segment (Board | List),
  primary **New ticket** button with `C` kbd chip.
- **Disk-state indicator:** mono 10px. While a write is in flight:
  9px spinner + `writing ticket.md…` in `ink-3`. Settled: `✓ ticket.md`
  in `ink-disabled`. This is the honest surface of optimistic UI — the
  UI updates instantly, the indicator tells the truth about the disk.

### Terminal region — Phase 2 reservation (geometry only)

- Collapsed: a 24px full-width handle at the window's bottom edge. Mono
  10px uppercase `ink-disabled` label `terminal · reserved · phase 2`,
  top hairline. Hover: `wash` bg, `ink-3` text, `ns-resize` cursor.
- Expanded (prototype demonstrates the geometry): a 240–420px region above
  the handle, dashed `line-strong` top border, empty interior with the same
  mono label. **The interior is out of scope for v0** — nothing else is
  designed or built. When Phase 2 arrives, terminal chrome is the one other
  place the agent accent may live.
- The ticket panel and modals layer above the terminal region; board/list
  content shrinks, never hides, when the region expands.

## Welcome / first launch

- Full-window centered column on `--lc-bg`. 52px owl in `ink`, display
  greeting (`--lc-type-display`, "Plan with your agents."), 13.5px `ink-2`
  subtitle (max-width 420px) naming the folder-on-disk model, two buttons
  (primary **Create a project**, secondary **Open a folder**), and the mono
  trust line `no account · no cloud · your files, on your disk`.
- This screen **is** the "no projects" state — there is no separate empty
  app state, and no account step exists anywhere in the flow.
- **Folder picker:** v0 uses the macOS native picker. The prototype
  simulates it with a 520px sheet labeled `native folder picker · simulated
  in prototype`; rows are mono 12px, 34px tall. Picking a folder that
  already contains `.longclaw/` opens the project directly (no create
  form); a plain folder proceeds to the create form.
- **Create form:** 460px column. Folder (read-only mono path on `wash`,
  showing the `/.longclaw` suffix that will be created), Name (prefilled
  from folder name), Key (mono, uppercase, ≤5 chars, prefilled from name,
  hint: "locks after the first ticket"), Theme picker (Indigo preselected —
  a default, never a decision gate), primary **Create project** / ghost
  **Back**.
- Creation lands on the empty board with the guided first-ticket card. The
  target is < 60s and ≤ 4 interactions from launch to board; the prototype
  driver counts and displays both.

## Theme picker (creation · settings · palette)

Per components.md: 44×28px pair swatches (⅔ human / ⅓ agent), radius 5,
preset name in `--lc-type-micro` below, selected = `accent-human` border +
focus ring. Four presets: Indigo (default) · Clay · Slate · Plum. Selection
applies instantly — a 150ms crossfade of accent surfaces only; no layout
movement. No custom-color affordance exists anywhere.

## Board

- Horizontal scroller, padding 8px 24px 20px, column gap 12px.
- **Column:** 264px fixed. Header row: status dot 14px + name 13px/500
  `ink-2` + mono count 11px `ink-3` + hover-revealed `+` (quick create
  preseeded with that column's status). Card stack gap 8px; each column
  scrolls independently when tall.
- Column order = status order: Backlog · Todo · In Progress · In Review ·
  Done · Canceled. The Canceled column renders only when it has tickets
  (it is reachable via the list view and search regardless).
- **Cards:** anatomy and all states (resting/hover/focus/selected/fresh/
  degraded) per components.md § Board card. Board-specific rules:
  - max 2 label chips; when a checklist fraction is present, max 1 — the
    footer never wraps or clips the assignee avatar;
  - fresh treatment decays when the ticket is opened, or 2 minutes after
    the last agent write, whichever comes first;
  - clicking anywhere on the card opens the panel; the card is a single
    focusable unit (interior elements are not tab stops).
- **Empty project:** the board scaffold stays visible (all columns, zero
  counts); the Todo column hosts the guided card — dashed `line-strong`
  border, "Create your first ticket", one line of copy, `C` kbd chip.
- **Filter active with no matches:** centered state panel "No matches" +
  secondary **Clear filter**.

## Issue list

- Vertical scroller, padding 0 24px 20px. Grouped by status; only statuses
  with visible tickets render.
- **Group header:** 32px, sticky at top (`--lc-bg` fill), status dot +
  name 12.5px/500 `ink-2` + mono count.
- **Group body:** `surface` card, hairline border, radius 8, rows divided by
  `line-soft`.
- **Row:** 36px (`--lc-size-row`), padding 0 12px, gap 10px. Order: status
  dot 13 · mono ID 11px `ink-3` (58px fixed) · priority glyph · title
  (13px/500, truncates) · fresh dot (agent, when fresh) · checklist
  fraction · ≤2 label chips · assignee avatar 20 · relative updated mono
  10.5px right-aligned (46px fixed).
  Hover `wash`; focus = inset human border + ring; selected = human wash +
  2px left accent bar. Degraded rows: warn triangle, mono filename, "View
  raw file".

## Ticket panel

- Overlay panel anchored right, **560px** wide (max 88%), full height of
  the main region, `surface` bg, left hairline, `--lc-shadow-overlay`.
  Slides in 24px over `--lc-motion-panel` (150ms). Board/list stay visible
  and clickable behind it — clicking another card retargets the panel; Esc
  closes and returns focus to the originating card.
- **Header row** (padding 14px 20px 0): ID chip (click copies), mono file
  path `tickets/LC-128/ticket.md` — the disk made visible — spacer, close.
- **Title:** borderless textarea, `--lc-type-title`, hover `wash`, focus =
  field treatment. Enter or blur commits (activity: "renamed"); Esc
  reverts.
- **Meta grid:** 84px label column, 12px gap. Rows: Status, Priority,
  Assignee, Labels — each value a 26px menu trigger (hover `wash`).
  The assignee menu lists **registered humans only** and carries the mono
  footnote: `❯ agents contribute — in the timeline, never as assignee.`
- **Description:** rendered markdown block; hover shows `wash` + Edit
  affordance; click enters edit mode. Editor anatomy:
  - tab strip on `wash`: **Write** / **Preview** tabs (24px), formatting
    toolbar right-aligned (24×24 icon buttons: bold, italic, code, list,
    task, link);
  - Write: borderless mono textarea (`--lc-type-code`), min 132px,
    vertical resize;
  - Preview: rendered CommonMark subset, 13px/1.55;
  - footer: mono note `writes to ticket.md on save`, Cancel (`Esc`),
    primary Save (`⌘↵`).
- **Checklist:** section header with mono fraction + 56px progress bar
  (fill `ink-3`; `accent-agent` while any row is agent-fresh). Rows per
  components.md § Checklist. Add-row: ghost checkbox + borderless input,
  Enter appends and keeps focus for rapid entry.
- **Activity:** merged timeline per components.md § Timeline — human
  comments, agent comments (rail + AGENT badge + `via file edit` meta), and
  change events in one chronological stream, sorted by time with ID
  tie-break. Composer: avatar + auto-growing field, `⌘↵` posts, posting is
  optimistic.
- **Conflict banner** renders pinned above the title when an external edit
  lands mid-edit (spec in `states.md`).

## Quick create (`C` or palette)

- 620px modal at 12vh. Row 1: mono context line `project · KEY-n` (the next
  key, allocated on create). Row 2: borderless 15px title input. Row 3:
  status trigger (defaults Todo; preseeded when opened from a column `+`).
  Footer: ghost **Open full editor →** (carries the typed title into full
  create), mono hints `↵ create · esc cancel`, primary **Create**.
- Enter creates optimistically: card appears at top of its column, toast
  `LC-n created` with Undo (`⌘Z`), modal closes, focus moves to the new
  card. Creating never blocks on the disk write.

## Full create

- The ticket panel in create mode: provisional ID chip (`KEY-n · new`),
  title textarea, the same meta grid (status/priority/assignee/labels),
  description editor (write mode only until first save), checklist
  draft rows with remove affordances and add-row. Footer: primary
  **Create ticket** (`⌘↵`) + ghost Cancel. On create the panel swaps to
  view mode of the real ticket.

## Command palette (`⌘K`)

- 560px modal, radius `--lc-radius-modal`, `--lc-shadow-modal`, scrim.
  Input row 44px (15px type, `esc` chip). Result rows 36px: 16px glyph
  slot, 13px name, right-aligned kbd hint. Active row `accent-human-soft`.
  Footer: mono legend `↑↓ navigate · ↵ run · esc close/back`.
- **Root commands (D14):** create ticket · go to project… · change status…
  (`S`) · assign… (`A`) · search tickets… · star/unstar project · toggle
  appearance · change project theme… · **new terminal** — present,
  disabled, tagged `PHASE 2`. Plus two Step 2 additions staged for
  sign-off (see README § Proposals): set priority… (`P`) and switch
  board/list view.
- **Sub-modes** (status, assign, priority, theme, project, search) replace
  the list and show a crumb chip in the input row; `Esc` steps back to
  root, not out. Status/assign/priority target the open or focused ticket
  and are disabled with an inline explanation when there is none. Theme
  rows carry miniature pair swatches. Search rows: status dot + mono key +
  title, Enter opens the panel.

## Menus (status · priority · assignee · labels)

- Anchored popover: min 220px, `raised` bg, hairline, radius 10,
  `--lc-shadow-overlay`, 5px padding. Rows 30px with the option's own
  glyph; current value shows a trailing human-accent check. Arrow keys
  cycle, Enter picks, Esc returns focus to the trigger. Opened from the
  keyboard (`S`/`A`/`P`) the menu anchors to the focused card/row.

## Project settings

- Centered modal dialog. Sections: Name + Key (key input disabled once any
  ticket exists, mono note "locked after first ticket") · Folder (read-only
  mono path + **Locate…**) · Theme picker · Appearance segment (System /
  Light / Dark — explicitly labeled an app preference, not project data) ·
  danger zone: **Remove from app** with the copy "Removing only forgets the
  project in LongClaw. Files on disk are never touched."
- Remove confirms via a dialog that names the path and repeats the
  non-destructive guarantee; the confirm button is the danger variant.

## Waitlist (side-panel footer)

- Quiet ghost button "Get early access" → centered modal: display heading
  "Early access to sync & teams", two sentences of value proposition, email
  field, micro consent line ("One email when sync opens. No product
  updates, no telemetry, and this never gates a local feature."), primary
  **Join the waitlist** + ghost **Not now**.
- Success swaps the modal body to a check glyph + "You're on the list" and
  permanently replaces the footer button with static mono
  `✓ you're on the list`. Failure states in `states.md`.

## Raw file view (degraded tickets)

- 680px modal. Header: warn glyph + full mono path + close. Danger banner
  with the parse error (mono, includes file:line). Body: read-only
  line-numbered file content, offending line highlighted with
  `danger-surface`. Footer: micro note "The file is shown exactly as it is
  on disk. LongClaw never rewrites or discards content it can't parse." +
  ghost **Open in editor** + secondary **Retry parse**.

## Motion inventory

| Transition | Token | Notes |
|---|---|---|
| Hover/press feedback | `--lc-motion-fast` 80ms | bg/border only, no transforms |
| Checklist check, status change, card reorder | `--lc-motion-state` 120ms | |
| Panel slide-in, modal rise, palette, theme crossfade, appearance switch | `--lc-motion-panel` 150ms | theme/appearance transition colors only — nothing moves |
| Agent pulse | `lc-pulse` 900ms × 2 | the one long motion; never loops beyond two beats |
| Skeleton shimmer | 1.2s linear | loading only |

All motion communicates a state change; nothing is ornamental. Nothing
exceeds 150ms except the deliberate agent pulse. `prefers-reduced-motion`
zeroes the motion tokens (generated in the token CSS) and disables the
panel/skeleton animations.
