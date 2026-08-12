# LongClaw v0 — component & layout specifications

> Phase 0, Step 2 deliverable. Screen- and layout-level specification for
> every v0 surface. Component anatomy (buttons, chips, avatars, status dots,
> priority glyphs, cards, checklist rows, timeline entries, toasts, banners)
> is specified in `../foundations/components.md` and is **not** repeated here
> — this document adds the geometry that assembles those components into
> screens. Every value below is expressed in `--lc-*` tokens or px where a
> token does not exist yet. The live reference is `prototype.html`.
>
> Revised after the M0 ADRs: no assignee anywhere in v0 (local mode,
> ADR 0001), board ordering control (ADR 0003), and ticket archival
> (ADR 0004). Where this document diverges from the Step 1 component
> foundations (card/list assignee slots), the ADRs win for v0; the avatar
> component itself remains — humans appear as circle avatars in the
> timeline and composer.

## App shell

```
┌────────────────────────────────────────────────────────────┐
│ side panel 240px │ main (flex)                             │
│                  │  content header 56px                    │
│                  │  board / list (flex, scrolls)           │
│                  │  ── terminal region ── NOT IN V0        │
│                  │  handle 24px — NOT IN V0                │
└────────────────────────────────────────────────────────────┘
```

- **Side panel:** 240px fixed, `--lc-bg`, right hairline `--lc-line`.
  Padding 16px 12px. Logo row (22px owl + Familjen Grotesk 14.5/600),
  **project actions** (below), section headers mono 10.5px uppercase `ink-3`
  (12px 8px 6px padding), project rows 28px (spec in components.md § App
  shell). Footer pinned to bottom: mono micro line `v0 · local · no account`
  (`ink-disabled`), then the waitlist ghost button (30px) — NOT IN V0. In v0:
  **Starred**, **Local** — nothing else, no Teams stubs.
- **Project actions:** directly under the lockup and above the sections,
  separated from them by a bottom hairline `--lc-line` (16px padding below).
  Stacked, not side by side — 216px of panel content does not hold two
  labelled controls on one line. A `secondary` **Create project** spanning
  the panel, then a `ghost` **Open folder** beneath it, sized to its label;
  both at the standard 30px control height. The CTA and the link are
  **centred on one axis** and sit 4px apart — they are one pair, "add a
  project" in two halves, and the space that matters is the 16px below them
  holding the pair off the sections. The lockup above stays **left-aligned**
  with the section headers and project rows: it is identity, not part of the
  pair. **The hierarchy is load-bearing:** `Open folder` is quieter than
  `Create project` on variant alone, not on position, and `New ticket` is the
  app's primary and keeps the only filled accent on screen — so neither of
  these is ever `primary`, and they are never two controls of equal weight.
  *Founder decision, 2026-08-06 (LC-73).* The original prototype drew section
  headers and project rows only, but `Welcome` is the no-project state alone,
  so with a project open these are the only way to add a second; and
  `.project-nav` has no `overflow-y`, so at the foot of the list they leave
  the viewport once it is long enough. This position is the spec —
  `cc_screens_diff.md` D-0B records the reversal.
- **Project row anatomy:** 6px theme dot in the *project's own* human accent
  (rendered by scoping that project's `data-lc-theme` on the dot), name 13px
  `ink-2`, star affordance revealed on hover (persistent when starred, in
  `accent-human`). Unreachable projects swap the dot for a 12px warn
  triangle in `--lc-warn` and dim the name to `ink-3`; the row stays in
  place and stays clickable.
- **Active row:** `accent-human-soft` bg, `ink` text, 500 weight.
- **Content header:** padding 16px 24px 12px. Project name
  (`--lc-type-title`), settings gear (ghost icon button), path chip (mono
  12px, folder glyph, click copies, hover `wash`), disk-state indicator
  (below), spacer, filter field (190×28px), **ordering control** (ghost,
  `Order: Priority|Manual`, opens the ordering menu — ADR 0003), view
  segment (Board | List), primary **New ticket** button with `C` kbd chip.
- **Disk-state indicator:** mono 10px. While a write is in flight:
  9px spinner + `writing ticket.md…` in `ink-3`. Settled: `✓ ticket.md`
  in `ink-disabled`. This is the honest surface of optimistic UI — the
  UI updates instantly, the indicator tells the truth about the disk.

### Terminal region — NOT IN V0 (Phase 2 design; see § Cut from v0)

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
  already holds a project — a `.longclaw/longclaw.yaml` — opens it
  directly (no create form); a plain folder proceeds to the create form.
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
  `ink-2` + mono count 11px `ink-3` + always-visible `+`: quick create
  preseeded with that column's status; a bare 13px glyph, no fill or border, in
  a 24px hit area (LC-209). Card stack gap 8px; columns scroll independently.
- Column order = status order: Backlog · Todo · In Progress · In Review ·
  Done · Canceled — the fixed v0 set; no status creation exists (ADR
  0002). The Canceled column renders only when it has tickets (it is
  reachable via the list view and search regardless).
- **Ordering (ADR 0003):** within a column, tickets order by priority by
  default (Urgent → P1 → P2 → P3 → P4 → None, stable within a level).
  The header control switches the board to Manual, which renders the
  per-ticket `rank` order; the choice is a per-project view preference in
  app state. Keyboard navigation always follows the visual order.
- **Dragging (ADR 0003, revised for LC-60):** a card dragged into another
  column takes that column's status — the same write `S` makes — in either
  order. The column under the pointer says so with an accent wash and a
  hairline; in Manual a drop line also shows where in it the card would
  land, because Manual writes the place as well as the status. Dragging
  *within* a column is reordering and stays Manual-only, so in Priority a
  card's own column takes no drop and the pointer refuses it. The
  Unreadable column takes none in either order: it names no status.
  While a drag is in flight every column that would accept it reserves at
  least one card's height, so an empty column is a target rather than the
  3px its stack measures at rest; the reserve goes when the drag does.
  Hanging the drag near the left or right edge of the board scrolls it
  sideways, as hanging near a column's top or bottom scrolls that column —
  a column off the side of the window is otherwise unreachable.
- **Archived tickets never render on the board** (ADR 0004); the list
  view is the archive surface.
- **Cards:** anatomy and all states (resting/hover/focus/selected/acknowledged/
  degraded) per components.md § Board card, minus the assignee avatar —
  v0 is local mode and has no assignee (ADR 0001). Board-specific rules:
  - max 2 label chips; when a checklist fraction is present, max 1 — the
    footer never wraps;
  - the acknowledgement decays when the ticket is opened, or 2 minutes after
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
  (13px/500, truncates) · acknowledgement dot (agent, when acknowledged) · checklist
  fraction · ≤2 label chips · relative updated mono 10.5px right-aligned
  (46px fixed). No assignee slot in v0 (ADR 0001). Rows within a group
  follow the same ordering preference as the board.
  Hover `wash`; focus = inset human border + ring; selected = human wash +
  2px left accent bar. Degraded rows: warn triangle, mono filename, "View
  raw file".
- **Dragging (LC-60, reversing "no drag affordance"):** a row dragged into
  another group takes that group's status, and in Manual takes a place in
  it too — the same move the board makes for the same gesture, decided in
  one place (`ticketMove.ts`) so the two surfaces cannot disagree about
  what a drop means. The group under the pointer wears an accent border
  and wash; in Manual a 2px accent line rides the boundary the row would
  land on. Dragging *within* a group is reordering and stays Manual-only.
  **While a drag is in flight, every status renders** — the one exception
  to "only statuses with visible tickets render" above, and the list's
  answer to the height the board reserves in each column: a status with no
  group on screen is a status nothing can be dropped into, and dragging a
  group's last row away would otherwise remove that status as a target for
  good. An empty group is its header, which is the whole of its target and
  wears the wash accordingly. The set stands down when the drag does.
  The affordance is the grab cursor and nothing else: this list originally
  had no drag because a 36px row has no room for a handle, and it still
  does not have one. The **Archived** group takes no drop and none of its
  rows can be dragged — archiving is a date, not a status (ADR 0004), and
  a row moved out of it would land somewhere the board still would not
  show. The **Unreadable** group takes none either: it names no status.
  Hanging the drag at the top or bottom edge scrolls the list.
- **Archived group (ADR 0004):** below the last status group, a
  toggleable header — folder glyph, "Archived", mono count, show/hide —
  collapsed by default. Expanded rows render at 80% opacity, use the
  same row anatomy, and open the panel normally. Archived tickets also
  surface in palette search, tagged `· archived`.

## Ticket panel

- Overlay panel anchored right, **560px** wide (max 88%), full height of
  the main region, `surface` bg, left hairline, `--lc-shadow-overlay`.
  Slides in 24px over `--lc-motion-panel` (150ms). Board/list stay visible
  and clickable behind it — clicking another card retargets the panel; Esc
  closes and returns focus to the originating card.
- **Header row** (padding 14px 20px 0): ID chip (click copies), mono file
  path `tickets/LC-128/ticket.md` — the disk made visible — an `archived`
  kbd-style chip when archived, spacer, **Archive/Unarchive** ghost button
  (ADR 0004), close. Archiving closes the panel, hides the ticket from
  the board and default views, raises the undo toast, and logs an
  activity event; the directory never moves.
- **Title:** borderless textarea, `--lc-type-title`, hover `wash`, focus =
  field treatment. Enter or blur commits (activity: "renamed"); Esc
  reverts.
- **Meta grid:** 84px label column, 12px gap. Rows: Status, Priority,
  Labels — each value a 26px menu trigger (hover `wash`). There is no
  Assignee row: v0 is local mode and the concept doesn't exist here
  (ADR 0001); the row returns with team projects.
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
  (fill `ink-3`; `accent-agent` while any row is agent-acknowledged). Rows per
  components.md § Checklist: reorderable (LC-185), rewordable and deletable (LC-215).
  Add-row: ghost checkbox + borderless input, Enter appends, focus stays.
- **Activity · Comments:** two tabs over one record (LC-211). Activity is
  first and holds every entry per components.md § Timeline, a comment among
  them as a one-line `commented`; Comments is selected on open and holds the bodies alone. The composer sits under both. Sorted by time with ID
  tie-break. Composer: avatar + auto-growing field, `⌘↵` posts, posting is
  optimistic.
- **Conflict banner** renders pinned above the title when an external edit
  lands mid-edit (spec in `states.md`).

## Quick create (`C` or palette)

- 620px modal at 12vh. Row 1: mono context `project · KEY-n` (the next key,
  allocated on create) and `esc`. Row 2: borderless 15px title input. Row 3:
  description. Row 4: status (defaults Todo; preseeded from a column `+`),
  priority (defaults None), labels — the meta grid's order (LC-186, LC-201).
  Footer: **Open full editor →** (carries all five), **Create more**, **Create** (`⌘↵`).
- `↵` from the title or `⌘↵` from anywhere creates optimistically: card appears
  at top of its column, toast `LC-n created` with Undo (`⌘Z`), modal closes,
  focus moves to the new card. Creating never blocks on the disk write.

## Full create

- The ticket panel in create mode: provisional ID chip (`KEY-n · new`),
  title textarea, the same meta grid (status/priority/labels),
  description editor (write mode only until first save), checklist
  draft rows with remove affordances and add-row. Footer: primary
  **Create ticket** (`⌘↵`) + ghost Cancel. On create the panel swaps to
  view mode of the real ticket.

## Creating after the project moved (LC-188)

- Both create surfaces stay up across a project switch: the sidebar is
  live behind them and a half-typed ticket is not thrown away because
  somebody looked at another board. **Create** therefore compares the
  project it would land in against the one the draft was started in, and
  when they differ it asks instead of writing. The confirm names both
  projects, states the destination folder and the key the ticket will
  take there, and only confirming writes; Cancel returns to the draft
  with nothing sent. Its confirm button is the primary variant — nothing
  is destroyed either way, the write is only being aimed.
- **Nothing is creatable against a board that has not answered.** The
  next key is a guess off the rows on screen, and against no rows that
  guess is `KEY-1` — a key the project has usually already spent
  (LC-140). So while a project is opening, both create surfaces show
  `opening…` where the key goes and their **Create** is disabled, and
  the confirm above cannot be answered either and says why. This is
  reachable without a switch: re-opening the project already on screen
  zeroes the board the same way.
- A ticket panel does not survive a project switch. A key belongs to one
  project, so the panel closes rather than re-aiming at a project that
  never held that ticket.

## Command palette (`⌘K`)

- 560px modal, radius `--lc-radius-modal`, `--lc-shadow-modal`, scrim.
  Input row 44px (15px type, `esc` chip). Result rows 36px: 16px glyph
  slot, 13px name, right-aligned kbd hint. Active row `accent-human-soft`.
  Footer: mono legend `↑↓ navigate · ↵ run · esc close/back`.
- **Root commands:** create ticket · go to project… · change status…
  (`S`) · set priority… (`P`) · search tickets… · star/unstar project ·
  toggle appearance · change project theme… · archive/unarchive ticket
  (ADR 0004) · change board ordering… (ADR 0003) · switch board/list
  view · **new terminal** — present, disabled, tagged `PHASE 2`.
  This is D14 minus "assign…" (no assignee in v0, ADR 0001) plus the four
  commands from Proposal P1, accepted on 2026-08-01.
- **Sub-modes** (status, priority, ordering, theme, project, search)
  replace the list and show a crumb chip in the input row; `Esc` steps
  back to root, not out. Status/priority/archive target the open or
  focused ticket and are disabled with an inline explanation when there
  is none. Theme rows carry miniature pair swatches. Search rows: status
  dot + mono key + title (archived tickets tagged `· archived`), Enter
  opens the panel.

## Menus (status · priority · ordering · labels)

- Anchored popover: min 220px, `raised` bg, hairline, radius 10,
  `--lc-shadow-overlay`, 5px padding. Rows 30px with the option's own
  glyph; current value shows a trailing human-accent check. Arrow keys
  cycle, Enter picks, Esc returns focus to the trigger. Opened from the
  keyboard (`S`/`P`) the menu anchors to the focused card/row. The
  ordering menu carries the mono footnote "Ordering is a view preference
  on this board — it never rewrites files."

## Project settings

- Right-hand panel over a scrim, with a side nav of sections (LC-208),
  opened from the gear's menu or `⌘,`. General: Name + Key (key input disabled once any ticket exists, mono note "locked after first ticket") · Folder (read-only
  mono path + **Locate…**) · Theme picker · Appearance segment (System /
  Light / Dark — explicitly labeled an app preference, not project data) ·
  danger zone: **Remove from app** with the copy "Removing only forgets the
  project in LongClaw. Files on disk are never touched." Labels, Status fields (read-only — v0 ships the fixed set, ADR 0002) and Shortcuts are sections of the same nav.
- Remove confirms via a dialog that names the path and repeats the
  non-destructive guarantee; the confirm button is the danger variant.

## Waitlist (side-panel footer) — NOT IN V0 (see § Cut from v0)

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

## Cut from v0

Two surfaces above are drawn in full and **ship in no part of the v0 binary**.
Their sections are headed `NOT IN V0` and are kept because the design is good
and the work is postponed rather than abandoned. A screen-by-screen comparison
of the app against this document should record them as *absent by decision* —
absence is the spec, and a build that grew either one back would be the defect.

| Surface | Decision |
|---|---|
| **Terminal region** (§ App shell) | Not shown at all in v0 — no handle, no reserved height, no label. Founder decision 2026-08-06, closing `LC-74`: a strip advertising a Phase 2 feature is a promise the release does not want to make, and reserving geometry buys the shell nothing while the interior does not exist. The prototype keeps the geometry (`prototype.css` § 9) and the palette keeps its disabled `new terminal · PHASE 2` row; the app shell reserves nothing. |
| **Waitlist** (§ Waitlist) | Cut from v0. [Step 15](../../mvp_plan_order.md) was parked by founder decision on 2026-08-01, taking V0-38/V0-39 with it; no submission endpoint was ever reviewed, and the step's own rule is to omit the feature from the binary rather than ship a form that fails silently. It would also be the one network call in a product whose release gate (`audit:network`) exists to prove it makes none. Confirmed 2026-08-06, closing `LC-75`. |

Step 15 parked the waitlist without stripping it from the design record, so
`states.md`, `data-requirements.md`, and `keyboard-focus-map.md` still describe
its states, storage, and focus order in full. That is deliberate: those are the
design to build on unparking. This section is the scope statement that governs
them.

**Editing note.** This document is cited by line number from roughly 220 places
across the repo, including the app's own source comments. The `NOT IN V0`
markers above were written to occupy exactly the lines they replaced, and this
section was appended at the end, so no citation moved. Prefer the same
discipline over inserting prose mid-document.

## Quick create's Create more loop (LC-201)

Appended at the end for the reason the editing note above gives: the § Quick
create rows were rewritten in place at the same line count, and this is the
prose that would not fit in them.

- **The two fields the modal grew.** The **description** is three lines to
  start, growing with what is typed, capped so a long one scrolls itself rather
  than pushing the footer off the modal — the app's existing markdown field, not
  the Write/Preview editor, whose tabstrip and six formatting buttons belong to
  full create. It takes the field box the title does not: at three lines an
  unframed block reads as a gap. **Labels** are the project's own menu and never
  a text box; V0-16 removed a comma-separated field, not the field itself, and a
  slug `LabelMenuButton` produces is a slug `longclaw.yaml` carries. **The
  checklist stays in full create** — draft rows, drag reordering and an add-row
  that has to stay on screen are the shape of a surface you sit in.
- **`esc` at the right of the context row is a control, not a chip.** The word,
  in the eyebrow's register, and clicking it closes the modal. Quick create has
  no **Cancel** and its scrim does not dismiss, so before it there was no exit
  that was not a create. It is not a tab stop: its keyboard path is the key it
  is named after.
- **Create more is off on every open and is never persisted.** It is a mode for
  the run in front of you, not a preference: a create surface that quietly
  stayed in bulk mode would be one that files a ticket you thought you were
  cancelling.
- **With it ticked, Create writes the same optimistic ticket and then the modal
  stays.** Title and description clear; status, priority and labels are kept,
  because a run almost always shares them. The context line advances to the next
  free key, and focus returns to the title.
- **Focus never follows the card on that path.** Not optimistically, and not
  when the write returns — which during a run is while the next ticket's title
  is being typed, where a stolen caret reads as dropped keystrokes rather than
  as a focus bug.
- **Undo is still one deep** (`data-requirements.md:121`), so after a run of ten
  `⌘Z` archives the tenth. A bulk surface invites the assumption of a bulk undo;
  this is not one.
