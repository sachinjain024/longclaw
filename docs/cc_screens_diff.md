# LongClaw v0 — prototype vs. implementation, screen by screen

> A screen-level comparison of the running desktop app against
> `docs/design/prototype/prototype.html`, with an implementation plan per
> finding. Produced 2026-08-05 by driving both surfaces side by side.
>
> Normative references: `docs/design/prototype/screen-specs.md` (geometry),
> `docs/design/prototype/states.md` (empty/error/conflict/external states),
> `docs/design/foundations/components.md` (component anatomy). Where this
> document and those disagree, those win — this one only records what the build
> currently does.

---

## How this was produced

**The app.** `apps/desktop` dev build (`tauri dev`, debug binary, WKWebView at
1180×748 — the shipped default window minus the title bar). Driven with real
pointer and keyboard input; screenshots taken of the native window.

**The prototype.** `prototype.html` rendered in WebKit (playwright-core 1.62.1,
the same engine the app ships on) at the same 1180×748 viewport, with the driver
bar hidden so the app region occupies the identical box. Both in **indigo /
light** unless noted.

**The data.** The prototype's `seedLongclaw()` demo project was reproduced as a
real on-disk LongClaw project — same twelve tickets, keys, statuses, priorities,
labels, checklists, activity, one archived (LC-104), one canceled (LC-136) — so
every screen below compares the *same* content. The generator lives in the
session scratchpad; regenerate it from `prototype.js:160-247` if you need it
again.

**States exercised in the app:** first launch (empty registry), empty project,
board, list, archived group, ticket panel, description editor, checklist write +
toast + undo, quick create, full create, command palette (root + theme
sub-mode), status menu, ordering menu, project settings, filter match, filter
no-match, unparseable ticket file, raw file view, project folder removed while
running, external file edit (freshness).

### Read this before filing anything

Three classes of difference appear below and they are **not** the same thing:

| Class | Meaning |
|---|---|
| **DEV-ONLY** | Visible only because this was a `tauri dev` build. `DEV_CHROME = import.meta.env.DEV` (`src/devChrome.ts:8`) gates the `FOLDER / .longclaw / tickets` trace strip, the `GENERATION n` eyebrow, and the **Rebuild index** button (`src/App.tsx:1183`, `:1203`, `:1245`). A release bundle drops all three. **Do not file these.** |
| **BY DESIGN** | The app diverges from the prototype because an ADR moved after the prototype was drawn — chiefly ADR 0001 (no assignee, no identity in v0), so the prototype's named humans and `AR` avatars are correctly replaced by "You" and a neutral mark. **Do not file these either.** |
| **DIFF** | Everything else. Numbered `D-nn` below. |

Severity: **P0** broken or unreadable · **P1** structural divergence from the
designed screen · **P2** component/detail divergence · **P3** copy and polish.

---

## Summary

The **primitives are right**. `src/styles.css` is built from the same tokens and
carries the spec's numbers: 240px side panel (`:45`), 264px board columns
(`:696`), 560px ticket panel (`:1260`), 620px quick create (`:2329`), 36px list
rows (`:1150`), 84px meta label column (`:1459`). Board, list, palette, menus,
toasts, freshness and the archive flow all exist and broadly read correctly.

What diverges is **composition and states**:

1. ~~**Four rendering defects make real content unreadable** (D-01 … D-04) — the
   ticket panel is painted over by the surface behind it, and every inline and
   fenced code span renders as a solid black block.~~ **All four fixed
   2026-08-06** (LC-96 → LC-99), and each left a guard behind it rather than only
   a fix: `stacking-guard.mjs` for the layering, `tile-contrast-guard.mjs` for
   the code surfaces. D-51's *layering* went with D-01; its modal-vs-panel half
   closed on 2026-08-07 (LC-134), and the raw file view is the spec's 680px
   modal now, so nothing of this item is open.
2. ~~**Three screens are structurally different**~~, not detail-different:
   ~~the welcome screen (D-10)~~ — a full window, and a two-step create, since
   2026-08-07 (LC-76 → LC-79) — ~~project settings (D-40)~~ — a modal since
   2026-08-07 (LC-125) — and ~~the empty-project state (D-20)~~, which stands
   inside the board rather than instead of it since 2026-08-07 (LC-86). All
   three are closed.
3. **The app shell header is three stacked blocks (~230px)** where the design is
   one 56px row (D-05) — this is the single change that most alters how every
   populated screen reads, and it costs the board and list ~170px of height.
4. **Two designed error behaviours do not happen**: ~~a degraded ticket never
   appears in its last-known column (D-50)~~ — fixed 2026-08-07 (LC-133), the
   index remembers the status a directory last read as and both surfaces group
   the degraded row by it — and a project folder that disappears is not noticed
   until something forces a re-read (D-55).

A prioritized backlog is at the end.

---

## 1 · App shell

**Spec:** `screen-specs.md` § App shell. Side panel 240px; content header one
row, `padding: 16px 24px 12px`, containing project name · settings gear · path
chip · disk-state · spacer · filter (190×28) · ordering control · view segment ·
**New ticket** with a `C` kbd chip. No terminal region — cut from v0 (LC-74);
board/list runs to the window's bottom edge.

**App:** `src/App.tsx:1106-1256`. Three stacked blocks: a `project-toolbar`
(eyebrow `LOCAL PROJECT`, `<h1>` project name, `<code>` full absolute path,
`Star` + `Settings` buttons stacked at the right), then the DEV trace strip, then
a `board-heading` (`<h2>Board</h2>` + the control row).

| ID | Sev | Prototype | App | Plan |
|---|---|---|---|---|
| D-05 | P1 | One 56px header row; project name and controls on the same line | Three stacked blocks totalling ~230px before the first card; board/list start at y≈275 instead of y≈100 | Collapse `project-toolbar` and `board-heading` into a single flex row in `App.tsx:1106-1256`. Drop the `LOCAL PROJECT` eyebrow and the `<h2>Board/List</h2>` heading — the view segment already says which view is active. Move `Star` and `Settings` inline, right of the project name. |
| D-06 | P2 | Path is a **chip**: mono 12px, folder glyph, `wash` on hover, click copies, truncated to the header | Path is a bare wrapping `<code>` that consumes two lines for a long path | Add a `path-chip` component: folder glyph + `text-overflow: ellipsis`, `max-width`, `title` = full path, click → clipboard + toast. Style per `screen-specs.md:44-47`. |
| D-07 | P2 | Disk-state indicator: `⟳ writing ticket.md…` while a write is in flight, `✓ ticket.md` when settled, `ink-disabled` | A permanent `● watching` chip (`App.tsx:1237-1250`), plus a `WriteIndicator` that only surfaces in the panel header | Make `disk-state` idle-silent or `✓ ticket.md`; reserve visible text for `writing…` / `reconciling`. The steady-state `watching` chip is dev telemetry, not designed chrome. |
| D-08 | P2 | Settings is a **ghost gear icon button** next to the project name | Two text buttons `Star` / `Settings`, stacked vertically at the right edge | Gear icon button for settings; keep star as the sidebar row affordance (it already exists there) and drop the header `Star` button. |
| D-09 | P2 | `New ticket` carries a `C` kbd chip; filter field carries a `⌘F` chip | Neither chip is rendered (no `<kbd>` outside `CommandPalette.tsx:462,488`) | Add `<kbd>` chips to the New-ticket button and the filter field. The keybindings already work. |
| ~~D-0A~~ | P2 | Sidebar footer: mono `v0 · local · no account`, and nothing else — the waitlist ghost button the spec draws is cut from v0 (LC-75) | Footer has an **Appearance `<select>`** above the trust line | **Fixed 2026-08-07 (LC-72 / LC-127).** Both halves: the `<select>` came out of the footer with LC-72, leaving the trust line alone, and the 3-up segment the spec puts in project settings landed with LC-127 — so the preference has a home again rather than only the palette's `Toggle appearance`. |
| ~~D-0B~~ | — | Sidebar has **only** section headers and project rows | Sidebar carries the project actions under the lockup, above the sections | **Not a diff, 2026-08-06 (LC-73).** Founder decision: the sidebar is the surface that lists projects, so "add one" belongs on it. The prototype's reading strands a user — `Welcome` is the no-project state alone (`App.tsx:1102`), so with a project open these are the only way to add a second — and the *foot* of the list is not a fix either, because `.project-nav` has no `overflow-y` and a long list carries them off screen. What this P2 actually caught was **weight**, not position: two filled buttons of equal weight above the rows. The spec now draws a `secondary` **Create project** over a `ghost` **Open folder**, never `primary`; `screen-specs.md` § App shell records it. The palette command this row's original plan leaned on is **LC-162**. |
| ~~D-0C~~ | — | Terminal region reserved: 24px handle, mono `terminal · reserved · phase 2` | Absent (nothing in `styles.css` or `App.tsx`) | **Not a diff, 2026-08-06 (LC-74).** The terminal is not shown at all in v0 — founder decision. Absence is the spec; `screen-specs.md` § Cut from v0 records it. The palette's disabled `New terminal · PHASE 2` row still ships (`CommandPalette.tsx:208-211`) and is the only Phase 2 signal v0 makes. |
| ~~D-0D~~ | — | Waitlist "Get early access" → modal | Absent everywhere | **Not a diff, 2026-08-06 (LC-75).** Cut from v0, confirming the 2026-08-01 parking of Step 15 / V0-38 / V0-39. No endpoint was reviewed, and a v0 binary that phones home would contradict the `audit:network` gate. Absence is the spec; `screen-specs.md` § Cut from v0 records it. |

**Not a diff:** `Open folder` / `Create project` labels, the owl mark, the
STARRED/LOCAL sections, the trust line, the active-row treatment, and the
per-project theme dot all match.

---

## 2 · Welcome / first launch

**Spec:** `screen-specs.md:66-84`, `states.md:14-20`. Full-window **centered**
column on `--lc-bg`: 52px owl, display greeting, 13.5px subtitle (max-width
420px), **two buttons** (primary *Create a project*, secondary *Open a folder*),
mono trust line. The create form is a separate step reached *after* a folder is
picked, and it shows the chosen folder as a read-only mono path.

**App:** `src/App.tsx:1890-1960` (`Welcome`) + `src/CreateProjectForm.tsx`.

| ID | Sev | Prototype | App | Plan |
|---|---|---|---|---|
| ~~D-10~~ | P1 | Full-window; no app shell | The 240px sidebar stays visible with `No starred projects` / `No local projects` placeholders | **Fixed 2026-08-07 (LC-76).** `App` returns `.welcome-shell` instead of `.app-shell` when the registry has been read and holds nothing — the line the prototype's own renderer draws (`prototype.js:361`). Gated on *read*, not on the empty list alone: `projects` is empty for the first frame of every launch, so the list by itself would flash this screen over every returning user on the way to their board. A registry read that **failed** is not an empty registry and keeps the shell, which is the one surface that can show the error and still offer `Create project` and `Open folder`. |
| ~~D-11~~ | P1 | Single centered column | Two columns: copy left, a permanently-visible create-form card right | **Fixed 2026-08-07 (LC-77).** One centered column, and the folder is the first question rather than the last: `chooseProjectFolder` is now its own call, so `Create a project` opens the picker and the form arrives holding what it answered. `Welcome` owns which step is up — it is not app state, it is over the moment the project exists — and `Back` is what leaves it. A cancelled picker returns the screen exactly as it was. `chooseAndCreateProject` stays for the sidebar's quick create, which has no room for a second step and asks for the folder last. |
| ~~D-12~~ | P2 | Two buttons: **Create a project** (primary) + **Open a folder** (secondary) | One `Open existing folder` (secondary); "create" is the form's submit, labelled `Create project in folder` | **Fixed 2026-08-07 (LC-78).** Two peers on one row, create primary. The screen's main path had no button of its own before this: it was the submit of the form beside it. |
| ~~D-13~~ | P2 | Create form shows the chosen folder as a read-only mono path with the `/.longclaw` suffix that will be created | No folder row at all | **Fixed 2026-08-07 (LC-79).** The form takes an optional `folder` and renders the settings modal's `.picked-path` above `Name`. Two spans, not one string — the folder is the user's and `/.longclaw` is the only thing LongClaw adds — and only the folder half truncates, because the suffix is the half that is news. Not a tab stop: the way to change it is `Back`, and `keyboard-focus-map.md:146-148` puts the order at name → key → theme → Create → Back. The picker hands focus to `Name` (`keyboard-focus-map.md:160`), on this path only. |
| ~~D-14~~ | P3 | Subtitle: "Tickets live as plain files in a folder you choose — ideally inside your repo. Humans plan, agents execute, and both write to the same record." | "LongClaw writes project data into `.longclaw/` inside the folder you choose. Every ticket is a file you can read, edit, and commit." | **Answered 2026-08-07: value, the prototype's (LC-80).** D-11 and D-13 are what decide it. The mechanism now has a better place to be stated than a subtitle — the next step names the folder and the `/.longclaw` inside it, in the path the user just picked — so the one thing left unsaid on this screen is what the files are *for*. |
| ~~D-15~~ | P3 | Key hint: "locks after the first ticket" | "Uppercase letters and digits, starting with a letter, such as LC. Locks after the first ticket." | **Fixed 2026-08-07 (LC-81).** `PROJECT_KEY_HINT` is the idle line and `PROJECT_KEY_RULE` is the refusal, which is where the dropped clause — *starting with a letter* — earns its second line. It is the clause that actually bites (`30 July 4PM` → `3J4`), so it is stated when a key breaks it rather than at rest. What stays is the half no refusal will ever explain: a key that locks is a consequence, not a mistake. |
| ~~D-16~~ | P3 | Trust line in mono `--lc-type-micro` | Renders in the UI face, not mono | **Fixed 2026-08-07 (LC-82).** Not the token: `.trust-line` already asked for `--lc-type-kbd-font`, which is `--lc-font-mono`, and the sidebar's copy of the line renders in mono today — § 1 records it as matching. The subtitle above it was styled as `.welcome-copy p`, which matched the trust line too and beat one class on specificity. The subtitle carries `.welcome-subtitle` now, and `scripts/trust-line-guard.mjs` fails the build on any selector that can reach this line and set a font, because jsdom loads no stylesheet and the vitest suite can see the class but never the cascade. Swapping in `--lc-type-code-font` as the row asks would have changed the sidebar's line too, at 12px instead of 10px, for a defect that was never in the token. |

**Also observed, 2026-08-07:** the picker's own branch is not built.
`screen-specs.md:98-100` says a folder that already contains `.longclaw/` opens
directly and a plain one proceeds to the create form; the app instead lets
**Create a project** walk an initialised folder through the whole form before
refusing it, and lets **Open a folder** error on a plain one. No `D-` row covers
it — this section was walked without raising it — so it is **filed as LC-170**
rather than reopened here. Nothing is written either way: `initialize_project`
refuses before it creates.

---

## 3 · Board

**Spec:** `screen-specs.md:96-131`. Horizontal scroller, `padding: 8px 24px
20px`, column gap 12px, columns 264px fixed. Column header: status dot 14 + name
13/500 + mono count + **hover-revealed `+`** that opens quick create preseeded
with that column's status.

**App:** `src/Board.tsx`, `styles.css:684-760`. Columns are 264px and the six
statuses render in order; Canceled correctly hides when empty.

| ID | Sev | Prototype | App | Plan |
|---|---|---|---|---|
| ~~D-21~~ | P2 | Column header reveals a `+` on hover | No `+` anywhere (`Board.tsx:447-453` renders dot + name + count only) | **Fixed 2026-08-07 (LC-83).** `ColumnAdd` in `Board.tsx`, revealed on column hover or its own focus and named for its column — six buttons reading "New ticket" would say nothing about which one was reached. It raises the status rather than opening anything: `App` decides that a preseeded create is quick create, and `QuickCreate` now opens on the status it is given (`screen-specs.md:222`). Two departures from the plan's letter, both deliberate: it is the `<h3>`'s sibling inside a new `.board-column-head` rather than its child, because a heading is named by its own text and a button inside it renames the column to "Todo 4 New ticket in Todo"; and it is faded rather than `visibility: hidden` as the prototype has it, because a hidden element takes no focus and `keyboard-focus-map.md:44` gives these a keyboard path. |
| ~~D-22~~ | P2 | Focused card: human-accent inset border + ring | Focus ring exists but is faint at card scale — the focused card is hard to find after `S`/`P` closes a menu | **Fixed 2026-08-07 (LC-84).** The ring was not faint, it was clipped: it is drawn outside the element, and `.board-stack` scrolls, so the 3px/4px of column padding was all the room it had. The card wears its focus inside itself now — the `accent-human` border `components.md` § Board card asks for, with the ring inset against it, the same trade `.list-row` already makes. |
| ~~D-23~~ | P3 | Priority `None` renders as a dash glyph in the ID row | Same, but the dash sits in the chip slot with no chip — reads as a stray hyphen (see LC-108) | **Fixed 2026-08-07 (LC-85).** The first option: the dash keeps its geometry and gains the frame `P1`…`P4` wear, so the five levels share one slot. Omitting it was the alternative and would have made None the one level that says nothing. |

**Not a diff:** column width, gap, order, card stack gap, the fixed status set,
priority-default ordering, the ordering control, `Canceled` hiding when empty,
archived tickets staying off the board.

---

## 4 · Board card

**Spec:** `components.md` § Board card, minus the assignee avatar (ADR 0001).
Max 2 label chips; max 1 when a checklist fraction is present; footer never
wraps.

The app's cards are close: ID + priority chip on row 1, title, then fraction +
progress bar + label chips. Truncation is applied. **No diffs worth filing** at
this size beyond ~~D-23~~ above, which is now closed.

---

## 5 · Empty project

**Spec:** `screen-specs.md:127-129`, `states.md:22-30`. **The board scaffold
stays visible** — all six columns, zero counts — and the Todo column hosts the
guided card: dashed `line-strong` border, "Create your first ticket", one line of
copy, a `C` kbd chip. The list view shows a centered equivalent.

**App:** `src/GuideCard.tsx`, placed by `Board.tsx` in the Todo column and by
`IssueList.tsx` in a card frame of the list's own. It was `EmptyBoard` in
`App.tsx`, reached at `tickets.length === 0 ? <EmptyBoard/> : …`.

| ID | Sev | Prototype | App | Plan |
|---|---|---|---|---|
| ~~D-20~~ | P1 | Board scaffold stays; guided card sits **inside the Todo column** | The whole board is replaced by one full-width dashed panel; no columns render at all | **Fixed 2026-08-07 (LC-86).** The surface is never unmounted now: `App` draws the board or the list whatever the ticket count, and hands the empty-project state down as `onCreateFirst`, which the Todo column renders as its only child. The scaffold's one stand-down stays the filter's — `scaffold={!showNoMatches}` rather than `{!noMatches}`, so a query typed into an empty project no longer takes the columns with it. |
| ~~D-24~~ | P2 | Guide card carries a `C` kbd chip and no button | A `New ticket` button, no kbd chip | **Fixed 2026-08-07 (LC-87).** The whole card is the control, as it is in the prototype, and the chip is what it wears — the header two rows up keeps the one filled accent on screen (`components.md:51`). The chip is `aria-hidden` with `aria-keyshortcuts="C"` beside it, the same trade the header button makes (LC-71), and the card is named for what pressing it does rather than for its two lines of copy. |
| ~~D-25~~ | P3 | Copy: "Title it, give it a checklist, point an agent at the folder." | "Every ticket is one file. This one will live under `<full absolute path>`." — the raw path wraps across two lines and a **stray `.` lands alone on a third line** | **Fixed 2026-08-07 (LC-88).** The second option: the path is dropped, not repunctuated. It is already in the header chip (D-06), and a 264px card is the last place an absolute path should be asked to wrap. The copy is the prototype's. |
| ~~D-26~~ | P3 | List view shows a *centered equivalent*, sized to the list | List view shows the identical full-width panel | **Fixed 2026-08-07 (LC-89).** The list has no Todo column to host a card, so the guide sits in `.list-guide` — the `surface` card frame every group body wears — with the invitation centred in it and carrying no frame of its own. The frame claims the height the list region has, so "centered equivalent, sized to the list" (`states.md:34`) is both words and not only the horizontal one. The list is still the surface it stands on rather than something it replaced. One departure worth naming: the prototype's list branch (`prototype.js:640-643`) has its own copy — "No tickets yet", the path, and a primary `New ticket` — and this reuses the board card's instead. Three rows of this section ask for one card with one line of copy and a chip; keeping a second wording, a second path echo, and the button D-24 removes would have re-opened all three on the surface nobody was looking at. |

---

## 6 · Filter states

**Spec:** `states.md:32-36`, `screen-specs.md:130-131`. Centered panel "No
matches" + the echoed query + secondary **Clear filter** (also `Esc`).

| ID | Sev | Prototype | App | Plan |
|---|---|---|---|---|
| ~~D-30~~ | P0 | — | The filter input triggers **WebKit's native autofill dropdown** (a `Zzzz ×` suggestion popover under the field) | **Fixed 2026-08-07 (LC-90).** The field carries `autoComplete="off"`, `autoCorrect="off"`, `spellCheck={false}` and `name="longclaw-filter"` — the name because WebKit's heuristics read one when they decline the request, and no saved-value store has a value for that one. The prototype's field already carried the pair (`prototype.js:496`). |
| ~~D-31~~ | P2 | Centered in the board region, no container | A bordered rounded container spanning the content width, top-aligned | **Fixed 2026-08-07 (LC-91).** `.no-matches` drops the dashed frame, the tint and the 18px block margin, and centres in the height the header leaves: `.main-panel` is a column, the workspace takes `.workspace-state` for the one state that stands *instead of* the surfaces, and the panel claims what is left. The surfaces stay mounted — they hold the roving focus and the scroll position a query that matches nothing would otherwise throw away, and they are what draws the unreadable rows the filter never hides — so an empty one hides itself (`.workspace-state > .board-grid:empty`) rather than leaving 28px of its own padding under the panel. Measured in WebKit at 1440×900: the panel spans the whole region, y=86→872, where it used to be a 758px-wide card at the top. The copy is capped at the 400px the prototype gives a state panel's sub-line, which the frame used to do by accident. `.empty-board` and `.unreachable-panel` keep the frame — D-20 and D-59 are the rows that decide those. (D-20 closed on 2026-08-07 and took `.empty-board` with it: the empty project has no panel now, only a card inside the Todo column.) |
| ~~D-32~~ | P3 | "Nothing matches “zzzz”." (curly quotes) | "Nothing here matches zzzz." (no quotes) | **Fixed 2026-08-07 (LC-92).** The echo is inside the prototype's curly pair — in the sentence, not inside the `<code>`, so the mono slot holds the query and the quotes are punctuation around it — and a query that is whitespace, or wearing it, is still something the human can see they asked for. The sentence keeps its *here*: the row's Plan asks for the quotes, and *here* is the one word that says the filter narrows the surface in front of you rather than the project. |

---

## 7 · Issue list

**Spec:** `screen-specs.md:133-158`. Sticky 32px group headers, `surface` card
with hairline and radius 8, 36px rows, row order: dot · mono ID (58px) ·
priority glyph · title · fresh dot · fraction · ≤2 labels · relative updated
(46px, right). Archived group last, collapsed, toggleable.

The app's list is the closest surface to the design. Group headers, row anatomy,
ordering, the archived group with its `Show` toggle, and 80%-opacity archived
rows all match.

| ID | Sev | Prototype | App | Plan |
|---|---|---|---|---|
| ~~D-35~~ | P2 | Relative time is a fixed 46px right-aligned column: `40m`, `3h`, `2d` | `just now` **wraps onto two lines** inside the 46px slot, making those rows visibly taller than their neighbours | **Fixed 2026-08-07 (LC-93).** The string, not the slot: `describeAgeInSlot` in `freshness.ts` substitutes `now` for the one age the column cannot hold, and the row reads it instead of `describeAge`. Prose keeps `just now` — the timeline entry and the card's acknowledgement are sentences, and a sentence saying `now` reads as a truncation — so there is one age vocabulary with one substitution rather than two. `.list-row-updated` also took `white-space: nowrap`, so no future age can wrap this slot in words the guard cannot see. |
| ~~D-36~~ | P2 | Degraded rows sit **in place**, with the row's own anatomy | Degraded rows are hoisted into a synthetic `Unreadable` group at the bottom (`src/grouping.ts:86-90`) | **Fixed 2026-08-07 (LC-94).** Decided for both surfaces, and the two placements are deliberately different: `groupByStatus` takes an `unreadable` option, the board keeps `"last"` — its columns are the fixed set in a fixed order (ADR 0002), so the group no status names takes the seat at the end, which is the placement D-50 names — and the list asks for `"first"`. One vertical scroller is why: appended, the group sat below the fold at the default window size, which is the "never silent" invariant broken by a sort order. *In place* in the prototype's full sense — the row in its last-known status — needed a last-known status to exist, and D-50 / LC-133 gave it one on 2026-08-07: a degraded row now sits in the group its directory last read in, and the synthetic group holds only what nothing has seen parse. |
| ~~D-37~~ | P3 | Degraded row: warn triangle, mono filename, `View raw file`, danger treatment | Present, but with no danger tint or border, and a stray **green freshness dot** renders immediately left of `View raw file` | **Fixed 2026-08-07 (LC-95).** The card's treatment at row height (`states.md:92-94`): the card's `--lc-danger-border` as an inset `::after` overlay — not a `border`, because `.divided` already owns the row's `border-top` for the hairline between rows, and not a `box-shadow`, because `.selected` owns that — with `--lc-danger-surface` behind it, since a 1px edge that frames a card is one hairline among hairlines at 36px. The ID slot, the warn glyph and `View raw file` take `--lc-danger` rather than the row's resting greys. The dot is gone with the whole fresh treatment: a file that would not parse has nothing in it to be fresh about, so `ListRow` reads `isFresh(…) && !row.degraded`. The board card carries the same dot and is **LC-164**, not this row — suppressing it there also moves `cardStrides`. |

---

## 8 · Ticket panel

**Spec:** `screen-specs.md:160-198`. 560px, anchored right, slides in 24px over
150ms. Header: **ID chip (click copies)** · mono `tickets/LC-128/ticket.md` with
folder glyph · `archived` chip when archived · spacer · Archive/Unarchive ghost ·
close. Meta grid: 84px label column, rows Status / Priority / Labels, each a 26px
menu trigger. **No other meta rows.**

**App:** `src/TicketPanel.tsx` § header. The `Updated` row that stood at
`:767-768` is gone (D-3A), and the header the pointer named is now an `IdChip`,
a static path chip and a transient `WriteIndicator` (D-38, D-39).

| ID | Sev | Prototype | App | Plan |
|---|---|---|---|---|
| ~~**D-01**~~ | **P0** | The panel is the topmost surface; board/list are behind it | **The list/board paints on top of the panel.** With the list view behind, sticky group headers and rows punch opaque white bands across the panel: LC-119's Labels row is clipped, the `Checklist` heading is sliced in half, a checklist item is fully hidden, and the word `Show` from the Archived group renders *inside* the panel | **Fixed 2026-08-06 (LC-96).** Both halves: `.ticket-panel` takes `--lc-z-panel` and the list's sticky header `--lc-z-sticky`, off a `--lc-z-*` scale that also covers the modal scrim and the toast — which is D-74, the scale this row asked for. `stacking-guard.mjs` reads the *relations* between the five surfaces rather than any one value, because a layer read alone says nothing: it is only meaningful against what the others claim. (This cell's "same fix covers the raw-file view (D-52)" meant **D-51**; D-52 is the danger banner's `file:line`. D-51's layering half went with this; its modal-vs-panel half did not.) |
| ~~**D-02**~~ | **P0** | Inline code renders as `wash`-backed mono | **Inline code renders as a solid black block** — `unlink`, `add`, `watcher/coalesce.rs`, `[ ]`, `[x]` are all unreadable rectangles in light appearance | **Fixed 2026-08-06 (LC-97).** Decided once, in tokens, as this row asked: a `--lc-code-surface` / `--lc-code-ink` pair, so code stops borrowing the agent terminal's tile — a token that is near-black in *both* appearances by design, which is why inherited ink painted dark-on-dark. `tile-contrast-guard.mjs` now reads the pair rather than either declaration alone: neither was wrong by itself, which is exactly why `color-guard` and `token-guard` were both green while the panel was unreadable. |
| ~~**D-03**~~ | **P0** | Fenced blocks render as readable code | **Fenced blocks render as a solid black bar with no visible text** (LC-119's ```` ```md ```` example) | **Fixed 2026-08-06 (LC-98).** Same root cause, same token pair. `.markdown-code code` keeps `background: transparent` so the code inside the block does not paint a second chip on top of the first. |
| ~~**D-04**~~ | **P1** | Description hover reveals a pencil + `Edit` at the right of the section header | The `Edit description` affordance is absolutely positioned **over the body text** and overlaps it (`…pairs that the` collides with `Edit description`) | **Fixed 2026-08-06 (LC-99).** The first option: the affordance is an ordinary item in the `Description` header row, so there is no body text under it to overlap and no gutter to reserve. It kept the `ghost small` type — the size the prototype gives this exact control (`prototype.js:720`) — and reveals on `:focus` as well as section hover, because focus returns here when the editor closes (`keyboard-focus-map.md:87`), including from a mouse-driven close, which matches neither `:hover` nor `:focus-visible`. It took `margin-left: auto` when D-3D grouped the other headings' counts at the left (LC-105). |
| ~~D-38~~ | P2 | ID is a chip (`accent-human-soft`) and **click copies** | Plain `<span className="ticket-key">` (`TicketPanel.tsx:573`), no copy | **Fixed 2026-08-07 (LC-100).** `IdChip`: the human accent on its soft wash, click copies the key, and the toast the project path chip already raises (D-06). The accessible name is `Copy LC-1`, which contains the visible text rather than replacing it. It is the panel's first Tab stop, which is where `keyboard-focus-map.md:61` had already put it. |
| ~~D-39~~ | P2 | Path shows as `tickets/LC-128/ticket.md` with a folder glyph, **beside** a separate disk-state line | Path is rendered *by* `WriteIndicator`, so it is the disk-state line, and it shows the full `.longclaw/tickets/…` prefix with no glyph | **Fixed 2026-08-07 (LC-101).** Split in two: a static `path-chip` with the folder glyph names the file and holds still, and `WriteIndicator` takes a `transient` mode — news only, absent when the disk is quiet. `idle` still scopes the settled `✓` to this ticket's file. The `.longclaw/` prefix was already dropped by `diskLabel`; what the row actually named was the flicker, and that is what went. |
| ~~D-3A~~ | P1 | Meta grid rows: **Status, Priority, Labels. Nothing else.** | A fourth row, **`Updated  2026-08-05T17:20:00Z`** — a raw ISO timestamp (`TicketPanel.tsx:767-768`) | **Fixed 2026-08-07 (LC-102).** The row is removed, which is the option this table's own ranked list named. The age it stood in for is already on screen in the app's relative form — the list row's right-aligned `2h` and every entry in the panel's timeline — so nothing had to be reformatted to keep it. `.meta-grid code` went with it; the row was its only caller. |
| ~~D-3B~~ | P2 | Each value carries a `>` chevron marking it as a menu trigger | No chevron; Status/Priority read as static chips until hovered | **Fixed 2026-08-07 (LC-103).** The chevron went on `MenuButton` rather than on the panel's two calls, because the prototype draws it on every one of them — the ordering trigger (`prototype.js:500`) and both create surfaces (`:874-876`) too, which is D-49's chevron as well. Decorative and `aria-hidden`; `aria-haspopup` is what states it to assistive technology. (The Plan cell's `screen-specs.md:172-176` predates an edit to that file; the Meta grid is `:192-193`.) |
| ~~D-3C~~ | P2 | Labels row carries a dashed `+ add` affordance | Shows only existing chips; `None` (a bare button) when empty | **Fixed 2026-08-07 (LC-104).** The chips are the value and a dashed `+ add` chip is the control, in both states — the row was one wide button with the chips inside it, so every chip was a click target for the same menu and the empty row said `None`. The accessible name stays `Labels: Backend, …`: the menu adds *and* takes off, and the chips beside it are not in the button's name any more. Same fix reaches the create panel (D-4C). It also moved the menu's anchor to the end of a row that grows, which is what `Menu`'s measure-once now covers. |
| ~~D-3D~~ | P2 | Checklist header: `Checklist` · mono fraction · **56px progress bar** (fill `accent-agent` while fresh) | `Checklist` at the left and `3/7` flush right; no progress bar in the panel (the *cards* have one) | **Fixed 2026-08-07 (LC-105).** The 56px meter is in, reading the same `checkedCount` the fraction does so the two cannot disagree while a tick's write is out, and `aria-hidden` because the fraction says it in words. `justify-content: space-between` went with it: it was what put the fraction at the far edge, and by then it was doing the same to LC-109's new `Activity` count. Both headings group left, as the prototype has them (`prototype.js:729`, `:747`); the Description editor's affordance takes the spacer for itself. (The Plan cell's `screen-specs.md:188-190` predates an edit to that file; the Checklist bullet is `:206-207`.) |
| ~~D-3E~~ | P2 | Add-row: ghost checkbox + borderless input, Enter appends and keeps focus | A full-width **bordered** input, `Add a checklist item` | **Fixed 2026-08-07 (LC-106).** Ghost box + borderless field, on the rows' own gap and padding so the two boxes share a column. The box is a real disabled checkbox at half opacity — same shape as the rows above, no Tab stop, `aria-hidden` because the field is already named. Enter already appended without blurring; that is now held by a test. The create surface's add-row took the same box (`prototype.js:895-897`), which is where the shared `.checklist-add` rule left it. |
| ~~D-3F~~ | P2 | Composer: avatar + auto-growing borderless field, `⌘↵` posts | Avatar + a bordered textarea with a visible native resize grabber + a separate `Comment` button | **Fixed 2026-08-07 (LC-107).** `resize: none` with a real auto-grow (`useAutoGrow`, the prototype's own `scrollHeight` measurement) and a 220px cap, so a long comment scrolls itself instead of pushing the timeline off screen. The button is `secondary small` — the variant the prototype gives it — and renders only once there is text: disabled, it was a control that could never be pressed and a Tab stop that led nowhere. `⌘↵` is unchanged and is the only way in until the button arrives. The field stays bordered; that half of the row is not a diff (`screen-specs.md:193` gives the composer standard input foundations). |
| ~~D-3G~~ | P2 | Title is a borderless textarea; hover `wash`, focus field treatment | Borderless ✓, but the native **resize grabber is visible** at the title's bottom-right corner | **Fixed 2026-08-07 (LC-108).** `resize: none`, and `useAutoGrow` with `rows={1}` so `rows` is a floor rather than the size — taking the handle away from a fixed two-row box would have traded a grabber for a clipped title. |
| ~~D-3H~~ | P3 | `Activity` heading carries the entry count | No count | **Fixed 2026-08-07 (LC-109).** It counts what is on screen, so an optimistic comment is in it: posting renders the entry before the file has it, and a heading one short of what the reader can see would be the one place the panel argued with itself. `.checklist-fraction` became `.section-count` on the way — the fraction and the count are one object in the prototype (`prototype.js:729`, `:746`). |
| ~~D-3I~~ | P3 | Checked checklist items are struck through | Not struck through | **Answered and fixed 2026-08-07 (LC-110): keep.** `components.md:192` specifies `ink-3` + line-through for the settled checked row, and `:193` has the agent-fresh row keep full `ink` and no strike until the ticket settles — so the strike is not a stylistic flourish to drop, it is what makes *fresh* legible as a distinct state. Both are implemented as `.checked` and `.fresh.checked`. |

**Not a diff:** panel width (560px, `styles.css:1260`), slide-in, the Archive /
Unarchive ghost button, the `archived` chip, Esc-closes, the agent timeline entry
(green rail, `❯` tile, `AGENT` badge, `via file edit`), the human entries reading
"You" (ADR 0001).

---

## 9 · Description editor

**Spec:** `screen-specs.md:178-186`. Tab strip on `wash` with **Write** /
**Preview** (24px) + right-aligned 24×24 icon buttons (bold, italic, code, list,
task, link); borderless mono textarea, min 132px, vertical resize; footer mono
`writes to ticket.md on save`, Cancel (`Esc`), primary Save (`⌘↵`).

Structurally this matches — tabs, toolbar, mono textarea, footer note, Cancel/Save
with their kbd chips are all present (`src/DescriptionEditor.tsx`).

| ID | Sev | Prototype | App | Plan |
|---|---|---|---|---|
| D-45 | P2 | Six 24×24 **icon** buttons | Six text glyphs: `B`, `I`, `` ` ``, `•`, a small square, `↗` | Replace with icons from the foundations set. The backtick-as-code and `↗`-as-link substitutions are the weakest — neither reads as its action. |
| D-46 | P3 | Tabs 24px on a `wash` strip | ~20px, strip tint is lighter than `wash` | Align to the token. |

---

## 10 · Quick create

**Spec:** `screen-specs.md:200-208`. 620px at 12vh. Row 1 mono context line
`project · KEY-n`; row 2 borderless 15px title input; row 3 status trigger;
footer ghost **Open full editor →**, mono `↵ create · esc cancel`, primary
**Create**.

Width (620px) and vertical offset (12vh) both match.

| ID | Sev | Prototype | App | Plan |
|---|---|---|---|---|
| D-47 | P2 | Title input is borderless, 15px | A bordered ~13px input with placeholder `Ticket title` | Borderless, 15px; the modal frame is already the field's boundary. |
| D-48 | P2 | Context line carries the project's theme dot before the name | `longclaw · LC-137`, no dot | Add the dot (the sidebar already renders one). |
| D-49 | P3 | Status trigger is a bare `○ Todo >` with a chevron | A bordered pill `○ Todo`, no chevron | Match the panel's meta-trigger treatment (see D-3B). |

---

## 11 · Full create

**Spec:** `screen-specs.md:210-216`. The ticket panel in create mode: provisional
`KEY-n · new` chip, title textarea, the same meta grid, description editor
(write-only), checklist draft rows with remove affordances and an add-row,
footer primary **Create ticket** (`⌘↵`) + ghost Cancel.

The app's version is structurally right and arguably better — it pins the footer
so `Create ticket` is reachable without scrolling a long draft
(`styles.css:2001-2008`).

| ID | Sev | Prototype | App | Plan |
|---|---|---|---|---|
| D-4A | P2 | `LC-137 · new` in a chip | `LC-1 · new` as plain text — **and the number was wrong** when the panel was opened while the project was in the unreachable state (see D-57); it read `LC-1` for a project whose keys run LC-101…LC-136 | Chip the provisional ID; and make sure key allocation is not reachable from a state where the index is empty (D-57 fixes the cause). |
| D-4B | P2 | Description placeholder: "What should happen? Agents read this before they start." | No placeholder | Add it — it is the one line telling the user what this field is *for*. |
| D-4C | P3 | Labels row shows `+ add` | Shows a `None` button | Same fix as D-3C. |
| D-4D | P3 | No checklist counter in create mode | `0/0` | Hide the fraction until there is a first item. |

---

## 12 · Command palette

**Spec:** `screen-specs.md:218-236`. 560px modal, 44px input row with an `esc`
chip, 36px result rows with a **16px glyph slot**, 13px name, right-aligned kbd
hint; footer mono legend. Sub-modes replace the list and show a crumb chip.

Width, row height, active-row treatment, keyboard model, sub-modes, the crumb
chip, and the disabled `New terminal · PHASE 2` row (`CommandPalette.tsx:207`,
asserted in `CommandPalette.test.tsx:153`) all match. The root command set matches
the spec's list.

| ID | Sev | Prototype | App | Plan |
|---|---|---|---|---|
| D-4E | P2 | Every root row carries its own 16px glyph (`+`, `→`, status dot, priority chip, magnifier, star, moon, theme, folder, list, terminal) | Root rows have **no glyphs**; the `glyph` slot exists (`CommandPalette.tsx:41,483`) but is only populated for sub-mode options (`:237,251,267,314`) | Populate `glyph` on the root command list. The slot and its layout already exist — this is a data change, not a layout one. |
| D-4F | P2 | Input row opens with a magnifier glyph | No leading glyph | Add it; it also anchors the crumb chip. |
| D-4G | P3 | Crumb chip is lowercase mono on `accent-human-soft` (`theme`) | Uppercase grey chip (`THEME`) | Match the token. |
| D-4H | P3 | Sub-mode footer reads `esc back`; root reads `esc close` | Both read `esc close/back` | Make it context-accurate — the palette's back-vs-close behaviour is one of its nicer details and the legend currently hides it. |

**Better than the prototype:** the app marks the current theme with a trailing
check in the theme sub-mode. Keep it.

---

## 13 · Menus (status · priority · labels · ordering)

**Spec:** `screen-specs.md:238-246`. Anchored popover, min 220px, `raised`,
hairline, radius 10, 5px padding, 30px rows with the option's glyph, trailing
human-accent check on the current value. The ordering menu carries the mono
footnote.

The app matches this well: `S` on a focused card anchors the status menu to the
card, rows carry status dots, the current value carries a check, arrow keys
cycle, `Esc` returns focus. The ordering menu carries the footnote verbatim.

| ID | Sev | Prototype | App | Plan |
|---|---|---|---|---|
| D-4I | P3 | Ordering menu is min 220px | It renders ~466px wide because the footnote sets the width | Cap the menu width and wrap the footnote. |

---

## 14 · Project settings

**Spec:** `screen-specs.md:248-259`. A **centered modal dialog**: heading, a line
explaining that everything here lives in `longclaw.yaml`, then Name + Key (key
disabled once any ticket exists, with the mono note) · Folder (read-only mono
path + **Locate…**) · Theme picker · **Appearance segment (System / Light /
Dark)**, explicitly labelled an app preference · danger zone with the
non-destructive copy. Remove confirms via a dialog naming the path.

**App:** `src/ProjectSettings.tsx` — the modal the spec draws, since 2026-08-07
(LC-125 → LC-132). It was an inline `<section className="settings-panel">` that
expanded *between* the header and the board, pushing content down.

| ID | Sev | Prototype | App | Plan |
|---|---|---|---|---|
| ~~D-40~~ | P1 | Centered modal dialog with a scrim | Inline expanding section; the board shifts down by ~430px behind it | **Fixed 2026-08-07 (LC-125).** `ProjectSettings.tsx`, on the `.modal-scrim` quick create and the palette already stand on. It is built with the app's other layers in `App` rather than inside the main panel, so the board stays where it was and stays visible behind it. The gear that opens it says `aria-haspopup="dialog"` now: `aria-expanded` describes a region that stays under its trigger, which this is no longer. |
| ~~D-41~~ | P1 | Key field, disabled once a ticket exists, with `locked after first ticket` | **No Key field at all** | **Fixed 2026-08-07 (LC-126).** Shown, disabled, with the note beside it. One departure from the prototype's letter: it is disabled even before the first ticket, because v0 has no command that changes a project key at all — the note reads `set when the project was created` until a ticket exists and `locked after first ticket` once one does, so the field never claims an edit the app cannot perform. |
| ~~D-42~~ | P1 | Appearance segment lives here, labelled "app preference, not stored in the project" | Appearance is a native `<select>` in the sidebar footer (D-0A) | **Fixed 2026-08-07 (LC-127).** A 3-up System / Light / Dark segment in the dialog, carrying the label's exception verbatim. It is the same control as the header's view segment and shares its rules — one row of places to stand, one of them pressed. The sidebar `<select>` was already gone (LC-72); this is the surface that replaces it. |
| ~~D-43~~ | P1 | Folder shown as a read-only mono path row with `Locate…` beside it | Only a `Locate folder` button; the path is not shown | **Fixed 2026-08-07 (LC-128).** The full path in a mono row with a folder glyph, and `Locate…` beside it. Full rather than tilde-abbreviated as the header chip is: this is the row that answers *where is this project*, and the abbreviation exists to fit a chip into a header. |
| ~~D-44~~ | P1 | Remove from app: danger button + confirm dialog naming the path and repeating "Removing only forgets the project in LongClaw. Files on disk are never touched." | A full-width red-text button; **no explanatory copy** and no confirm dialog observed | **Fixed 2026-08-07 (LC-129, with LC-144).** The guarantee sits beside the button, and the button opens `RemoveProjectConfirm` — the confirm LC-144 built for the unreachable screen's copy of this same action, which names the path and repeats the guarantee. One component rather than one per surface: the same removal must not be stated in two different sets of words. It is raised as a sibling of the settings dialog, so its scrim is above by source order and one `Esc` closes one layer. |
| ~~D-4J~~ | P2 | No label management in v0 | A `Labels` editor grid: slug · name input · **native `<select>` colour** · Save · Remove, plus an add row | **Fixed 2026-08-07 (LC-130).** The design pass it asked for: the ramp is eight swatches in a radio group named for its row, and the two per-row buttons are one. The row commits itself — `Enter` or blur for the name, as `screen-specs.md:190` has the panel's title do, and a hue applies the moment it is picked, as the theme picker does — so the only button left is the `✕` that takes the definition away. |
| ~~D-4K~~ | P3 | Heading + `longclaw.yaml` explanation | Neither | **Fixed 2026-08-07 (LC-131).** Both, in the prototype's words. The heading is title type rather than the prototype's 18px display: display is the greeting and nothing else (`components.md:307`). |
| ~~D-4L~~ | P3 | `Done` button closes | No close affordance inside the panel; you re-click `Settings` | **Fixed 2026-08-07 (LC-132).** `Done` in a sticky footer — the dialog scrolls once a project defines a few labels, and the way out a pointer has must not be the thing below the fold. `Esc` closes it too, one rung above the filter's on the ladder, and either way focus returns to the gear; `a11y:audit` A2 checks both halves. |

---

## 15 · Unparseable ticket file

**Spec:** `states.md:100-122`. Board: **degraded card** — danger border, warn
glyph + `can't parse` in the ID slot, mono filename as title, single action
**View raw file**. List: degraded row, same anatomy at row height, *in place*.
Raw file view: 680px modal, warn glyph + full mono path, danger banner with the
parser error including `file:line`, **line-numbered** raw content with the
offending line highlighted, footer note + **Open in editor** + **Retry parse**.

**Reproduced** by hand-breaking `LC-133/ticket.md` (bad `status:` value) with the
app running.

| ID | Sev | Prototype | App | Plan |
|---|---|---|---|---|
| ~~D-50~~ | P0 | Degraded card renders in its last-known column | **The ticket vanishes from the board entirely.** Todo went 3 → 2, no card, no warning, no count change to explain it. **Two things have changed under this row since it was written, and neither closes it.** The board does render the degraded card now, in the synthetic `Unreadable` column at the end (`Board.test.tsx` § "keeps a file it cannot read on the board, in its own column") — which is the fallback this row's own Plan names, so what is left open here is the *last-known column*, not the vanishing. And the list's `Unreadable` group is no longer at the very bottom: D-36 / LC-94 moved it to the top on 2026-08-07, so it is no longer below the fold at the default window size | **Fixed 2026-08-07 (LC-133).** The last-known column, which is what was left. A file that will not parse names no status, so the placement can only come from something that watched it parse: `TicketIndex` keeps a seat per ticket directory — the status it last read as — and lends it to the degraded row it builds (`core/index.rs`, `DegradedRow::last_known_status`). `ticketStatus` then groups a degraded row by that seat on **both** surfaces, so breaking a file moves nothing on screen but the card's own anatomy, and the synthetic group becomes the fallback rather than the destination. The seats survive `clear()` and a rebuild deliberately: nothing on disk can put them back, so dropping them would move the card every time the app resumed. They do not survive the process — a directory this session has never seen parse goes to `Unreadable`, which is where the fallback belongs. |
| ~~D-51~~ | P0 | Raw file view is a 680px centered modal | It opens as the 560px right panel, **and the surface behind paints through it** — several lines of the file are covered by opaque white bands from the list rows underneath, so the file is partly unreadable | **Fixed 2026-08-07 (LC-134).** Both halves are closed now: the layering went with D-01 / LC-96, and the shape is the spec's — `RawFileView` renders a 680px dialog on `.modal-scrim`, hanging from the scrim's 12vh with the palette (`prototype.css:733`, `prototype.js:1120`), and `TicketPanel` returns it *instead of* the panel rather than inside it. The panel is still what reads the file, so the retry, the editor hand-off and `Esc` are unchanged; what is gone is a 560px editing surface wrapped around a file with no ticket in it. Which surface is drawn is the read's answer and not the index row's, so a row the board still calls readable whose file has since broken opens here too. The modal holds `Tab` and gives the file block a stop of its own, since page keys scroll what focus is inside (`keyboard-focus-map.md:141-142`). |
| ~~D-52~~ | P2 | Danger banner shows the parser error in mono **with `file:line`** (`ticket.md:7 — mapping values are not allowed here…`) | Error shown as plain prose with no line reference: "status must be one of backlog, todo, …; found not_a_real_status" | **Fixed 2026-08-07 (LC-135).** The banner was already willing to print a line; the *parser* had none to give. A field the format refuses is valid YAML, so `serde_yaml` reports no location — `Mapping::line_of` finds the field's own line in the bytes the mapping already holds, and `status`, `priority`, the three timestamps, `labels`, `key`, `format`, `id`, and `title` all carry one now. The banner names `ticket.md:7` rather than the whole path, because the heading above it is the path (D-58). |
| ~~D-53~~ | P2 | Content is line-numbered, offending line highlighted with `danger-surface` | No line numbers, no highlight | **Fixed 2026-08-07 (LC-136).** One row per line with an `aria-hidden` gutter — a screen reader counting down the side of a file is noise, and the banner says the number in words. The flagged row takes `danger-surface` *and* danger ink, never tint alone. |
| ~~D-54~~ | P2 | Footer: note + **Open in editor** + **Retry parse** | Neither action | **Fixed 2026-08-07 (LC-137).** `Retry parse` re-reads on demand and every outcome speaks: a file that parses gives the ticket back, toasts, and asks `App` for a snapshot so the degraded *card* recovers too (`states.md:102-104`); one that still fails re-renders with whatever the parser says now and says so. `Open in editor` is a typed command that takes a **ticket key**, never a path — see `release-candidate.md` for why that is not a shell. A newer-format file gets no retry: there is nothing to fix, which is the distinction `Diagnostic::is_read_only` already draws. `Retry parse` takes the focus the view opens with, as `keyboard-focus-map.md:141-142` already said it should, and `a11y:audit` A2 holds it there over a `?fail=parse` read. |
| ~~D-58~~ | P3 | Heading is the file path | Heading is `Shown without repair` | **Fixed 2026-08-07 (LC-138).** The path is the title, in mono, and in *full* (`screen-specs.md:293`) rather than the project-relative half the header chip carries — this is the screen a person reads just before opening the file somewhere else. The phrase opens the footer note. |

**Also observed:** a ticket whose file has *no* frontmatter at all (not even a
`---` fence) is dropped even from the `Unreadable` group — it never reaches the
degraded path. Worth a Rust-side test in `core/storage.rs`. **Filed 2026-08-07 as
LC-168**, the one finding in this section that never carried a `D-` number and so
was never swept into LC-133…LC-138. `TicketDocument::parse` does refuse the file
with a located diagnostic (`core/ticket.rs:450-452`); what is missing is any test
that it becomes a degraded record and reaches a snapshot.

---

## 16 · Folder missing / unreachable

**Spec:** `states.md:80-98`. Trigger is "project path unreachable **at launch, on
watcher signal, or on any failed read**". Sidebar row swaps its dot for a 12px
warn triangle and dims. Main area: centered state panel — 30px warn triangle,
**"Folder not found"**, the full path in mono, copy naming the likely causes *and
the guarantee*, actions **Locate folder…** and **Remove from app** (ghost →
confirm).

**Reproduced** by renaming the project directory out from under the running app.

| ID | Sev | Prototype | App | Plan |
|---|---|---|---|---|
| **D-55** | **P0** | The watcher signal alone raises the state | **Nothing happened.** The board kept showing cached tickets, the sidebar dot stayed normal, and the header still read `● watching`, for as long as nothing forced a re-read. The state only appeared after an explicit index rebuild | `states.md:96` forbids exactly this: "**Never:** … show cached tickets as if they were live." Treat a watcher error / failed read on the project root as the unreachable trigger. |
| **D-57** | **P1** | The unreachable screen is the whole main area; the panel is closed and nothing is creatable | Quick create still opens over the unreachable screen and offers **`LC-1`** as the next key — a collision waiting to happen once the folder returns | Gate the create surfaces (and the palette's create command) on `project.reachable`. |
| D-56 | P1 | Once the folder is back, the project recovers | The project stays flagged unreachable after the folder returns — even across an app relaunch, because `reachable: false` is persisted to the registry | Re-probe reachability on launch and on watcher activity; treat the persisted flag as a cache, not a fact. |
| D-59 | P2 | One centered state panel | A **danger banner at the top** *plus* the state panel — the message is said twice | Keep the panel, drop the banner. |
| D-5A | P2 | 30px warn triangle, title "Folder not found" | No triangle; an `UNREACHABLE` eyebrow with the project name as the title | Match the spec — the triangle and the plain-language title do the work. |
| D-5B | P2 | `Locate folder…` secondary, `Remove from app` ghost → confirm | `Locate folder` is the **primary** indigo button; `Remove from app` is a danger-outline button with no confirm | Demote Locate to secondary and put Remove behind the confirm dialog from D-44. |
| D-5C | P3 | Copy names the causes and the guarantee: "The project folder moved, or its disk isn't mounted. Your tickets are safe in their files — LongClaw never deletes or rewrites them, and this project stays listed until you decide." | "The registry entry was kept, but the folder cannot be opened from this path. Select its new location or remove only this app reference." — registry-speak, and **the banner copy is ungrammatical**: "The selected project folder is no longer available The file was left as it was." (missing sentence break) | Rewrite to the prototype's copy. Fix the run-on sentence regardless. |

**Correct already:** the sidebar row does swap in a warn triangle and dim, and
the project stays listed and selectable.

---

## 17 · External update / agent freshness

**Spec:** `states.md:126-152`. Card: `accent-agent-fresh-border`, 3px ring, **8px
pulse dot beside the ID**, footer line `❯ updated by agent · 12s` in
`accent-agent-text` above a soft divider. Checklist fraction and progress fill
switch to `accent-agent` while fresh. Decays on open, or 2 minutes after the last
write.

**Reproduced** by checking a checklist item in `LC-114/ticket.md` from outside the
app.

The core of this works: green border ring, green fraction, green progress fill, a
footer attribution line, and it decays.

| ID | Sev | Prototype | App | Plan |
|---|---|---|---|---|
| D-60 | P2 | Pulse dot sits **before** the ID | Renders **after** the ID | Move it. |
| D-61 | P2 | Footer line carries the age: `❯ updated by agent · 12s` | `⚠ file changed on disk — actor unknown` with no age, truncated to `…actor unkn…` at 264px | Add the relative age; shorten the unknown-actor string so it fits the card (`file changed · 12s` + the warn glyph is enough — the panel timeline can carry the full sentence). |
| D-62 | P3 | Agent green is for agent writes; an unknown actor gets the **warn** treatment (`states.md:150-152`) | An unknown-actor change gets the full agent-green treatment *and* a warn triangle — the two vocabularies are mixed on one line | Pick per attribution: agent → green + `❯`; unknown → warn + triangle. |

---

## 18 · Conflict banner

`src/ConflictBanner.tsx` exists and is wired into the panel
(`TicketPanel.tsx:21,614`). **It was not exercised in this pass** — reproducing it
needs an external write to land inside an in-app edit window.

Verify against `states.md:154-182`: pinned above the title, warn triangle + "Changed
on disk while you were editing." + attribution and age, **Reload file**
(`warn-border-strong`) and **Keep mine** (`warn-ink` ghost), no focus steal, and a
save with an unresolved conflict re-raising the banner. **Filed 2026-08-07 as
LC-169**, which carries the walk and the one known departure to confirm rather
than file: `Esc` does not clear the banner, though `keyboard-focus-map.md:82` says
it should, because clearing would take "Keep mine" away from a title draft that is
also pending (LC-12).

---

## 19 · Toasts and undo

`states.md:66-72`: optimistic first, toast with **Undo ⌘Z**, 5s, bottom-centre,
single stack.

**Works.** Checking a checklist item raised
`LC-128 checked · Suppress self-writes   Undo ⌘Z` bottom-centre, correctly styled.

| ID | Sev | Prototype | App | Plan |
|---|---|---|---|---|
| D-65 | P2 | The content header is a fixed row and does not move | While a write was in flight the header control row **reflowed onto two lines** and the ordering control was clipped | The controls row has no minimum width protection; the transient write indicator pushes it over. Give the row `flex-wrap: nowrap` with `min-width: 0` on the filter field, or reserve the indicator's width. |

---

## 20 · Cross-cutting

| ID | Sev | Finding | Plan |
|---|---|---|---|
| ~~D-70~~ | P1 | **Appearance preference is not restored on relaunch.** Set to Light, quit, relaunch → the control reads `System` again. It is written to `localStorage` under `longclaw.appearance` (`App.tsx:79`, `:491`) | **Fixed 2026-08-07 (LC-150).** The row's own second clause is what it turned out to be: the webview's storage did not survive the process, and the ordering preference went with it. So none of these are in webview storage any more — appearance, the open project and every project's workspace are one document in `device-preferences.json`, beside the project registry, written through the same atomic seam every other file this app owns is. [ADR 0012](adr/0012-device-preferences-are-a-file-rust-owns.md) records it and supersedes the sentence in ADR 0006 that allowed the old home. A relaunch is now something a test can perform — a second `PreferencesStore::load`, or the frontend forgetting what it holds and reading the document again — which is what the old storage could never be asked (LC-161). |
| ~~D-71~~ | P2 | **The open project is not restored on relaunch** — it always falls back to the first registry entry | **Fixed 2026-08-07 (LC-151), with D-70.** Same cause and the same fix: startup already preferred a remembered project over the first reachable one, and the value it read was in the storage that did not survive. It is in the document now. Still an opaque hint and not a second project reference — the registry is asked whether the id is real and reachable before anything is opened, which is the condition ADR 0006 attached to it and ADR 0012 keeps. |
| ~~D-72~~ | P2 | Native `<select>` elements appear in two places (sidebar appearance, settings label colours) | **Fixed 2026-08-07 (LC-127 / LC-130).** Both are gone: the sidebar's went with LC-72 and the appearance segment replaces it, and the label colours are swatches. The app renders no `<select>` anywhere. |
| ~~D-73~~ | P2 | Native textarea **resize grabbers** are visible on the panel title, the comment composer, and the create-mode title | **Fixed 2026-08-07 (LC-153),** the last of the three. The panel's title and composer lost the handle and grew a `useAutoGrow` with LC-108 and LC-107; the create-mode title wears the same `.panel-title` rule, so it had lost the handle *without* the auto-grow — `resize: none` over `overflow: hidden`, which is the half of the pair that clips a long title silently. The hook is `autoGrow.ts` now rather than a private function in `TicketPanel`, and `field-guard.mjs` counts a call per field in both components. The description editor keeps its handle, as the spec says. |
| ~~D-74~~ | P3 | No stacking-order scale exists | **Fixed 2026-08-06 (LC-96), completed 2026-08-07 (LC-154).** The `--lc-z-*` scale exists and `token-guard.mjs` refuses a literal `z-index`. What LC-154 finished is the wider half — *use them everywhere position is set* — by sweeping every positioned rule rather than the five named surfaces. The rule that came out of it: `fixed` and `sticky` are claims against surfaces they never name and must take a layer; `absolute` is nearly always a placement inside one box and must not (a layer per virtualized row is 5,000 stacking contexts for a relation the rows do not have). Two rules were wrong at `auto` and now take a `drag` layer — both drop indicators, which render *before* the rows they are dropped between, so every row painted over them and the list's lost a pixel of itself to any row wearing a background. `stacking-guard.mjs` holds both the relations and the rule. |

---

## Backlog, in the order I would take it

**Ship blockers — the app currently renders content the user cannot read**

1. ~~**D-01 / D-74**~~ — done 2026-08-06 (LC-96): `.ticket-panel` and the list's
   sticky header take layers off a `--lc-z-*` scale, and `stacking-guard.mjs`
   holds the relations between all five surfaces. It was the cheapest,
   highest-value fix in this document, as billed. D-74's wider half — every
   positioned rule, not the five named ones — closed on 2026-08-07 with LC-154,
   and found two more surfaces that were losing to source order. **D-51** came with it in two
   parts: its layering came free with this, and the spec's 680px modal landed on
   2026-08-07 (LC-134) — the raw file no longer borrows the ticket panel.
2. ~~**D-02 / D-03**~~ — done 2026-08-06 (LC-97, LC-98): a `--lc-code-surface` /
   `--lc-code-ink` pair, so code no longer borrows the agent terminal's tile, and
   `tile-contrast-guard.mjs` reads the pair — which is what neither
   single-declaration guard could see.
3. ~~**D-50**~~ — done 2026-08-07 (LC-133): a corrupted ticket keeps the column
   it last read in, because the index keeps a seat per ticket directory and
   lends it to the row it can no longer read. The `Unreadable` group is the
   fallback for a directory nothing has seen parse, not the destination for
   every broken file, so no count changes without a card to explain it.
4. **D-55** — a missing project folder is not noticed; cached tickets keep
   rendering as if live. Contract violation (`states.md` "Never: … show cached
   tickets as if they were live").
5. ~~**D-30**~~ — done 2026-08-07 (LC-90): native autofill is off on the filter
   field, by the four attributes it takes rather than the one that is asked for.

**Structural — the screens that are a different screen, not a different detail**

6. **D-05 / D-06 / D-07 / D-08 / D-09** — collapse the app shell header to one
   row. This buys ~170px back for the board and list and is the change most
   visible to a user comparing against the design.
7. ~~**D-40 → D-44**~~ — project settings as a modal, with Key, Folder,
   Appearance, and the remove-confirm (done 2026-08-07, LC-125 → LC-129, with
   ~~**D-4J**~~, ~~**D-4K**~~, ~~**D-4L**~~, ~~**D-0A**~~ and ~~**D-72**~~).
8. ~~**D-10 / D-11 / D-12 / D-13**~~ — welcome as a full-window centered column
   with the two-step create flow (done 2026-08-07, LC-76 → LC-79, with
   ~~**D-14**~~, ~~**D-15**~~ and ~~**D-16**~~: the subtitle's copy call, the
   key hint, and the trust line's face).

   **§ 2 is closed.** Every `D-` row in it is struck.
9. ~~**D-20 / D-24 / D-25**~~ — empty project keeps the board scaffold and puts
   the guide card in Todo (done 2026-08-07, LC-86 → LC-88, with ~~**D-26**~~:
   the list's own frame for it).

   **§ 5 is closed.** Every `D-` row in it is struck.
10. **D-56 / D-57 / D-59 → D-5C** — the unreachable-project screen.

**Component detail**

11. ~~**D-04**~~ (Edit affordance overlap — done 2026-08-06, LC-99),
    ~~**D-3A**~~ (drop the raw `Updated` ISO row — done, LC-102), ~~**D-3E**~~,
    ~~**D-3F**~~, ~~**D-3G**~~ (the panel's own fields — done 2026-08-07,
    LC-106 / LC-107 / LC-108, with ~~**D-3H**~~ and ~~**D-3I**~~),
    ~~**D-38**~~, ~~**D-39**~~, ~~**D-3B**~~, ~~**D-3C**~~, ~~**D-3D**~~ (the
    header chips and the meta rows — done 2026-08-07, LC-100 / LC-101 /
    LC-103 / LC-104 / LC-105) — ticket panel.

    **This line is closed.** Every `D-` row in § 8 is struck.
12. **D-4E / D-4F** — palette glyphs (data change; the slot already exists).
13. **D-45** — real toolbar icons.
14. ~~**D-21**~~ — column-header `+` (done 2026-08-07, LC-83, with ~~**D-22**~~
    and ~~**D-23**~~: the board's focus ring and the `None` chip).
15. **D-47 / D-48 / D-49 / D-4A / D-4B** — create surfaces.
16. **D-60 / D-61 / D-62** — freshness attribution.
17. **D-65** — layout and chrome polish (~~**D-72**~~ went with the settings
    modal; ~~**D-35**~~ and ~~**D-37**~~ went on 2026-08-07 with LC-93 and
    LC-95, alongside ~~**D-36**~~'s placement decision in LC-94; ~~**D-73**~~,
    the last resize grabber, went the same day with LC-153).

**Product decisions, not bugs**

- ~~**D-0C / D-0D**~~ — **answered 2026-08-06: neither is in v0.** The terminal
  region is not shown at all (LC-74) and the waitlist is cut (LC-75). Both are
  recorded in `screen-specs.md` § Cut from v0, which is where the
  next comparison should look before filing either again.
- ~~**D-4J**~~ — **answered 2026-08-07: it keeps its place and gains a design**
  (LC-130). Label definitions are project data with nowhere else to live, so they
  stay in settings; what they lost is the OS dropdown and the second button per
  row.
- ~~**D-14**~~ — **answered 2026-08-07: value** (LC-80). Not a coin toss in the
  end: the two-step create flow (D-11) gave the mechanism a better place to be
  stated than a subtitle, so the subtitle was free to say what the files are for.
- ~~**D-3I**~~ — **answered 2026-08-07: keep** (LC-110). It was never only a
  flourish: `components.md:192-193` gives the settled row the strike and takes
  it back off the agent-fresh one, so dropping it would have cost the panel the
  channel that separates *done* from *just done by somebody else*.

**Follow-up needed**

- ~~**§18 conflict banner**~~ — filed 2026-08-07 as **LC-169**. Built but
  unexercised here; the walk against `states.md:154-182` is that ticket.
- ~~**D-70**~~ — **answered 2026-08-07: real, and no longer verifiable the way
  the row asked.** The confirmation this called for was a packaged relaunch;
  what it would have confirmed is a property of the webview's storage, which no
  amount of app code can hold. So the preferences left it (LC-150, LC-151, ADR
  0012) and the claim is a test rather than a build: a document written by one
  process is read by the next.

**Every row in this document is now ticketed.** The `D-` rows became LC-67…LC-154
on 2026-08-05; the two prose findings above became LC-168 and LC-169 on
2026-08-07. This file is kept as the cited source of those tickets — 89 of them
name it in their `## Source` line — and as the record of *why* the struck rows
were decided the way they were, not as a work list.

The two companion plan documents, `docs/cc_ui_diffs.md` and `docs/cd_ui_diffs.md`,
were **deleted 2026-08-07** once their own leftovers were filed: the
`--lc-size-board-stack` retune (**LC-165**), two-line card titles (**LC-166**),
and the dark-appearance density pass (**LC-167**). LC-74 and LC-75 still name
those files in their activity entries, which are append-only and describe what was
true when written; `git log -- docs/cc_ui_diffs.md docs/cd_ui_diffs.md` recovers
them.
