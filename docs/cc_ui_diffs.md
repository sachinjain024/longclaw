# Prototype vs. implementation — UI differences and repair plan

Compares the v0 prototype (`docs/design/prototype/prototype.html`, backed by
`prototype.js` / `prototype.css`) with the shipped desktop app
(`apps/desktop/src/`), using the two screenshots supplied on 2026-08-05: the
prototype board (Indigo, light) and the app board (Plum, dark).

> **Superseded in part, 2026-08-06.** Two surfaces below were answered as
> product decisions and are **no longer differences to repair**. The terminal
> region is not shown in v0 at all (LC-74): that voids **D1**, the handle
> clause of **C4**, and **Step 4's** handle. The waitlist is cut from v0
> (LC-75): that voids **D3**, the waitlist clause of **B2**, and **Step 5's**
> "waitlist slot". Absence is the spec for both; see
> `docs/design/prototype/screen-specs.md` § Cut from v0 before acting on any of
> them. Step 4's `--lc-size-board-stack` retune survives and is now *simpler*,
> since no handle is subtracted.

**Reading the screenshots.** Three things in them are *not* differences:

- The dark strip across the top of the prototype shot is the **driver bar**
  (`prototype.html:18-44`) — harness chrome. It must never be built.
- The prototype is light/Indigo, the app is dark/Plum. Weight and contrast
  differences that follow from that are appearance, not drift. The dark
  comparison target is `docs/design/prototype/renders/board-indigo-dark.png`.
- The prototype's project has labels, checklists and six populated columns; the
  app's test project has three tickets. Missing chips in the app shot are
  missing data, not a missing component — `LabelChip` and the checklist meter
  both render (`Board.tsx:576-584`).

Everything below is a real difference, verified in source rather than inferred
from the pixels.

---

## 1 · Difference inventory

### A. Content header — the largest single difference

The spec (`screen-specs.md:47-49`) puts **one** 56px header row in the main
region: project name · settings gear · path chip · disk-state · spacer · filter
(190×28) · ordering control · view segment · **New ticket** with a `C` chip.
The prototype builds exactly that (`prototype.js:489-507`).

The app splits it into two rows and changes most of the controls:

| # | Prototype / spec | Implementation | Where |
|---|---|---|---|
| A1 | One header row, 16/24/12 padding | Two rows: `project-toolbar` then `board-heading` | `App.tsx:1108-1130`, `:1201-1267`; `styles.css:523-547`, `:620-629` |
| A2 | No eyebrow, no view title | `LOCAL PROJECT` eyebrow + `Board`/`List` `<h2>` — a second title-size heading competing with the project name | `App.tsx:1110`, `:1206` |
| A3 | Path chip: folder glyph, mono 12px, tilde-abbreviated, click copies, hover `wash` | Raw absolute path as a plain `<code>` block under the title | `App.tsx:1112`; prototype `.path-chip` `prototype.css:200-207` |
| A4 | Settings = ghost **gear icon** beside the name | `Settings` text button, far right, beside a `Star`/`Starred` text button that the prototype does not have in the header at all (star lives on the sidebar row) | `App.tsx:1114-1129` |
| A5 | Filter carries a quiet `⌘F` chip inside the field; placeholder `Filter…` | No chip; placeholder `Filter tickets` | `App.tsx:1211-1219`; prototype `.filter-wrap` `prototype.css:326-328` |
| A6 | Single ghost trigger reading `Order: Priority ›` | Bold micro label `Order` + separate menu trigger `Priority` — two controls where the prototype has one | `App.tsx:1220-1229`; `styles.css:1036-1050` |
| A7 | View segment: board/list **icons** + label; selected = solid `accent-human` fill on `on-accent-human` | Text only; selected = `accent-human-soft` tint. Reads as a tab strip, not the primary view switch | `App.tsx:1448-1467`; `styles.css:1052-1076`; prototype `.view-seg` `prototype.css:330-335` |
| A8 | `New ticket` + `C` kbd chip | No chip, so the board's most-used shortcut is undiscoverable | `App.tsx:1259-1265`; prototype `prototype.js:506` |
| A9 | Disk-state is mono 10px and usually **silent**: `⟳ writing ticket.md…` while a write is in flight, `✓ ticket.md` once settled | An always-on green pill `● watching` / `reading` / `reconciling` — the loudest thing in the header after New ticket, and it reports app state rather than file state | `App.tsx:1232-1244`; `styles.css:631-646`; spec `screen-specs.md:50-53` |

Note A9 is *additive* drift: `WriteIndicator` (`WriteFeedback.tsx:27-60`)
already implements the prototype's language exactly, and `.disk-path`
(`styles.css:1315-1330`) already has its quiet mono treatment. The pill is a
second, competing indicator rendered beside it.

### B. Side panel

| # | Prototype / spec | Implementation | Where |
|---|---|---|---|
| B1 | Logo → Starred → Local → footer. No action buttons | Two full-width `secondary` buttons (`Open folder`, `Create project`) with a hairline divider directly under the logo, plus an inline create form that expands in place | `App.tsx:1022-1045`; `styles.css:86-102`; prototype `prototype.js:469-481` |
| B2 | Footer = mono trust line. Spec draws a `Get early access` ghost button beneath it; **that button is cut from v0** (LC-75) and its absence is not a difference | Footer = `Appearance` `<select>`, then the trust line. Spec puts Appearance in **project settings** and the palette, not the shell | `App.tsx:1064-1082`; `styles.css:213-235`; spec `screen-specs.md:34`, `:254`, `:260-269` |
| B3 | `Starred` section is omitted entirely when empty | Renders the heading plus `No starred projects` / `No local projects` body copy | `App.tsx:1480-1481`; prototype `prototype.js:471` |
| B4 | Star is the icon-set glyph, `accent-human` when on | Text `★` / `☆` characters — different metrics and weight from every other glyph in the app | `App.tsx:1538`; prototype `GL.star` `prototype.js:112` |

Geometry itself matches: 240px panel, 28px rows, 6px theme dot, mono uppercase
section headers (`styles.css:52-59`, `:104-151` vs `prototype.css:275-303`).

### C. Board surface

| # | Prototype / spec | Implementation | Where |
|---|---|---|---|
| C1 | Column header reveals a `+` on hover → quick create preseeded with that column's status | No `+`; a ticket can only be created into a column by choosing the status afterwards | `Board.tsx:446-453`; spec `screen-specs.md:104-105`; prototype `prototype.js:579` |
| C2 | Empty project keeps the **full column scaffold** and puts the guided card in Todo (dashed border, one line of copy, `C` chip) | The whole board is replaced by one centered dashed `EmptyBoard` panel — the six-column scaffold the spec asks for never appears | `App.tsx:1269-1275`; `styles.css:648-677`; spec `screen-specs.md:127-129`; prototype `prototype.js:590-596` |
| C3 | Card title clamps to **2 lines**, card height varies | Title is one 18px line, ellipsized; card pinned to 90px (118px when fresh) | `styles.css:840-849`; `boardGeometry.ts:29-46` |
| C4 | Columns size to the window. (The spec's terminal handle bounding the board below is **cut from v0**, LC-74 — the board runs to the window edge) | Columns capped by `--lc-size-board-stack: calc(100vh - 360px)` — a reserve sized for the *two-row* header and the dev trace strip; with the header collapsed it will be ~200px too conservative | `tokens/design-tokens.css:88`; `styles.css:727-731` |

C3 is a deliberate trade, not an oversight: exact per-card offsets are what let
a column render only the visible cards (71ms → 21ms a frame at 5,000 tickets,
`boardGeometry.ts:11-23`). It is listed because it is visible, and it has a fix
that keeps the geometry exact (§ 2, Step 6).

### D. Reserved and parked surfaces

| # | Prototype / spec | Implementation | Where |
|---|---|---|---|
| ~~D1~~ | ~~24px full-width terminal handle pinned to the bottom of the main region~~ | **Not a difference, 2026-08-06 (LC-74).** The terminal is not shown in v0 at all — absence is the spec. The board ending at the window edge is the intended shell, not unbounded empty space | `screen-specs.md:55-66` and § Cut from v0 |
| ~~D2~~ | ~~Project settings is a **centered modal**: Name + Key (Key disabled once a ticket exists, with `locked after first ticket`), Folder + `Locate…`, Theme picker, Appearance segment labelled an app preference, danger zone with the "files on disk are never touched" copy and a naming confirm dialog~~ | **Fixed 2026-08-07 (LC-125 → LC-132).** `ProjectSettings.tsx` is the modal, carrying every row the spec lists, and the label editor got the design pass D-4J asked for | `ProjectSettings.tsx`; `styles.css` § project settings; spec `screen-specs.md:250-258`; prototype `prototype.js:1038-1076` |
| ~~D3~~ | ~~`Get early access` → waitlist modal~~ | **Not a difference, 2026-08-06 (LC-75).** Cut from v0, confirming the 2026-08-01 parking of Step 15 / V0-38 / V0-39. Absence is the spec | `screen-specs.md:260-269` and § Cut from v0 |

The palette, quick create, ticket panel, list view (including the collapsed
archived group), status dots, priority glyphs, label chips, toasts and undo are
all present and match. The drift is concentrated in the shell.

---

## 2 · Plan

Ordered by visible impact per unit of risk. Steps 1–4 are the screenshot; 5–8
are the surfaces behind it. Each step is independently shippable.

### Step 1 — Collapse the two header rows into one

**Do:** replace `project-toolbar` + `board-heading` (`App.tsx:1108-1130`,
`:1201-1267`) with a single `.content-header` in the spec's order: name · gear ·
path chip · disk-state · spacer · filter · ordering · view segment · New ticket.
Drop the `LOCAL PROJECT` eyebrow and the `Board`/`List` `<h2>` — the pressed
state of the view segment already says which surface you are on. Keep the
`GENERATION n` eyebrow behind `DEV_CHROME`, moved into the trace strip.

Move the star out of the header onto the sidebar row (where it already exists,
`App.tsx:1521-1539`) and make Settings a ghost gear icon button beside the name,
`aria-label="Project settings"`.

**Files:** `App.tsx`, `styles.css:523-547`, `:620-629`.
**Header CSS target:** `display:flex; align-items:center; gap:12px; padding:16px
24px 12px` (`prototype.css:317-320`).

**Watch:** `App.test.tsx:2369` matches `New ticket` by accessible name, and
`:238`, `:477`, `:522` use `getAllByText`. Header order is covered by
`scripts/tab-order-guard.mjs` — re-run it.

**Done when:** at 1500px the project identity and every board control read as
one row, and the first column header sits within ~10px of the prototype's
vertical position.

### Step 2 — Quiet the disk state, restore the path chip

**Do:** delete the `watching`/`reading`/`reconciling` pill (`App.tsx:1232-1244`,
`styles.css:631-646`). Give the remaining `WriteIndicator` the header slot with
`idle` unset, so the header is silent at rest, says `writing <file>…` during a
write and `✓ <file>` after — which is what it was already built to do. If
loading and reconciling still need a channel, they belong in the same mono line
at `ink-3`, not in an accent pill.

Replace the `<code>` path (`App.tsx:1112`) with a `path-chip` button: folder
glyph, mono 12px, `~`-abbreviated home, ellipsis on overflow, hover `wash`,
click copies the absolute path and raises the existing toast.

**Files:** `App.tsx`, `styles.css` (extend `.disk-path` to 10px, add
`.path-chip` from `prototype.css:200-207`).

**Done when:** at rest nothing in the header competes with **New ticket**, and
a write is still visibly reported.

### Step 3 — Finish the header controls

Three small, independent edits:

- **`⌘F` chip** inside the filter field — position it absolutely at `right:6px`
  with `pointer-events:none`, pad the field to 34px on the right
  (`prototype.css:326-328`). Change the placeholder to `Filter…`; keep
  `aria-label="Filter tickets"` so `App.test.tsx:2246` keeps passing.
- **`C` chip** on New ticket, as `<kbd aria-hidden="true">C</kbd>` — matching
  `CreatePanel.tsx:226` — so the accessible name stays `New ticket`.
- **Ordering trigger**: fold the `Order` label into the trigger so it reads
  `Order: Priority ›` as one ghost `btn-sm`. The footnote
  (`App.tsx:91-92`) stays on the menu.
- **View segment**: add the two icons and switch the selected state to solid
  `--lc-accent-human` / `--lc-on-accent-human` (`prototype.css:330-335`).

**Files:** `App.tsx:1211-1229`, `:1259-1265`, `:1448-1467`; `styles.css:1021-1076`.
**Gate:** `npm run a11y:audit` — the chips must not leak into accessible names.

### Step 4 — ~~Reserve the terminal region~~ · retune the board stack

**Do not build the handle.** LC-74 closed the terminal region as not-in-v0 on
2026-08-06 — no handle, no reserved height, no label, and board/list runs to the
window's bottom edge (`screen-specs.md` § Cut from v0). What remains of this
step is the retune below, which no longer has a handle to subtract.

Retune `--lc-size-board-stack` (`tokens/design-tokens.css:88`) for the
one-row header from Step 1 — and for no handle. It is the reserve above and below
a column; leaving it at `-360px` after the header shrinks wastes ~200px of
column.

**Gate:** `npm run perf:board` and `npm run perf:list` — the reserve feeds the
windowing viewport.

### Step 5 — Rebalance the side panel

**Do:** move `Open folder` and `Create project` out of the top slot. Preferred
shape, closest to the prototype without losing the affordance: a compact ghost
`+` beside the `Local` section heading opening the same create flow, and `Open
folder` folded into the command palette (which already carries project
commands). Hide a section entirely when it is empty (`App.tsx:1480-1481`).

Move `Appearance` out of the footer into project settings (Step 6), where the
spec puts it, leaving the footer as the trust line alone — the waitlist slot is
cut from v0 (LC-75). Swap the `★`/`☆` characters for the icon-set glyph.

**Done when:** the sidebar's reading order is brand → projects → trust, and
nothing above the project list competes with the active row.

### Step 6 — ~~Project settings as a modal~~ · done 2026-08-07 (LC-125 → LC-132)

**Do:** move `settings-panel` (`App.tsx:1132-1173`) into a centered modal
reusing `.modal-scrim` (`styles.css:2035`), with the full spec content: Name +
Key (Key disabled once any ticket exists, mono note `locked after first
ticket`), Folder + `Locate…`, Theme picker, the Appearance segment landing from
Step 5 explicitly labelled an app preference, and a danger zone carrying
"Removing only forgets the project in LongClaw. Files on disk are never
touched." behind a confirm dialog that names the path
(`screen-specs.md:250-258`). Label definitions stay — they are project data with
nowhere else to live.

**Gate:** `npm run a11y:audit` — new dialog, so focus trap and `Esc` return.

**Done.** `ProjectSettings.tsx` carries the whole list, plus the label editor's
design pass (D-4J): the ramp is swatches and each row keeps one button. A2 of the
audit gained two checks — the gear opens the dialog with focus in its first
field, and `Esc` closes it and gives the gear focus back — and both go red under
`--self-test`.

### Step 7 — Empty-project scaffold and column quick-add

**Do:** stop replacing the board with `EmptyBoard`. Render the six-column
scaffold with zero counts and put the guided card in the **Todo** column: dashed
`line-strong`, "Create your first ticket", one line of copy, `C` chip
(`screen-specs.md:127-129`). Keep `NoMatches` as it is — that state is correct.

Add the hover-revealed `+` to each column header, opening quick create with that
column's status preseeded (`Board.tsx:446-453`). `QuickCreate` already accepts a
status, so this is a prop and a button.

### Step 8 — Two-line card titles (optional, measure first)

Only if the board should visually match the prototype's card rhythm. Do **not**
make card height content-dependent — the exact-offset invariant in
`boardGeometry.ts:11-23` is what keeps a 5,000-card column at ~21ms a frame.

Safe shape: clamp the title at 2 lines and raise the pinned heights to fit two
lines *always* (≈90 → 108px, fresh 118 → 136px), keeping one stride per state.
The clamp guarantees the maximum, so offsets stay exact; the cost is ~18px of
whitespace under one-line titles.

**Gate:** `npm run perf:board` before and after; update `CARD_HEIGHT`,
`FRESH_CARD_HEIGHT` and the tokens together or the column will jitter.

---

## 3 · Work order and gates

1. Steps 1–3 — the header, in one branch. Largest visible delta, no data model.
2. Step 4 — `--lc-size-board-stack` retune (terminal reservation cut, LC-74).
3. Step 5 — sidebar.
4. Steps 6–7 — settings modal, empty scaffold, column `+`.
5. Step 8 — card height, only with perf numbers in hand.
6. Dark-mode pass against `docs/design/prototype/renders/board-indigo-dark.png`
   once the geometry is settled — auditing contrast before the layout moves
   means auditing it twice.

Per branch: `npm run verify`. Additionally `npm run matrix` after any token or
appearance-sensitive CSS, `npm run a11y:audit` after Steps 1, 3 and 6,
`npm run perf:board` / `perf:list` after Steps 4 and 8.

## 4 · Explicitly out of scope

The driver bar and its scenario buttons, the theme swatches and appearance
segment in that bar, and the prototype's simulated native folder picker are all
harness (`prototype.html:13-44`). The app's `DEV_CHROME` trace strip and
`Rebuild index` button stay dev-only and are not prototype drift.
