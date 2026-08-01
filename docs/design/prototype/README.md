# LongClaw v0 prototype & handoff bundle — Phase 0, Step 2

The end-to-end v0 experience, settled before the storage model and
production UI are built. Everything here is the deliverable set for MVP
plan Step 2 (`docs/mvp_plan_order.md`) and builds directly on the Step 1
foundations (`../foundations/`) — the prototype consumes the generated
token CSS and hardcodes no accent hue anywhere.

## Layout

| Path | Deliverable |
|---|---|
| `prototype.html` (+ `prototype.css`, `prototype.js`) | **Interactive end-to-end prototype** — open in a browser. Every MVP flow, surface, and trust state, driven by the harness bar on top |
| `screen-specs.md` | Component & layout specifications per surface (assembles the Step 1 component foundations into screens) |
| `keyboard-focus-map.md` | The complete keyboard surface + focus entry/exit/return rules |
| `states.md` | Empty, loading, optimistic, error, conflict, and external-update state specifications |
| `data-requirements.md` | Data needed by every screen/state, mapped to `docs/file_format.md` — with the open items Step 3 must close |
| `renders/` | Headless renders: board and key screens in Indigo + the Clay spot-check, light and dark |
| `scripts/render.mjs` | Regenerates `renders/` (requires `playwright` + Chrome) |

## Reviewing the prototype

Open `prototype.html`. The dark strip on top is the **driver** — prototype
harness, deliberately not app chrome. It never appears in the product.

| Driver control | Demonstrates |
|---|---|
| `reset · first launch` | Welcome → folder picker (simulated native) → create form (theme preselected) → empty board with guided card. The ticker reports clicks + seconds against the < 60s gate |
| `demo project` | Populated three-project state (longclaw · personal-site · dotfiles, each with its own theme dot) |
| `❯ agent session` | **The core demo.** A simulated external agent edits `ticket.md` on disk: card gains the fresh ring + pulse, checklist items tick in agent green, description gains a Discoveries section, status moves to In Review with an agent comment — then open the ticket to review and watch freshness settle |
| `conflict while editing` | Stages you editing LC-122's description, then lands an external edit → the warn banner with **Reload file / Keep mine** |
| `corrupt a file` | Hand-breaks a ticket's frontmatter → degraded card → raw file view with the parse error and highlighted line → **Retry parse** recovers |
| `unplug folder` | Project folder disappears → warn row in the sidebar + non-destructive recovery panel (**Locate folder… / Remove from app**) |
| Theme swatches / light–dark | Token-swap proof on the full app (also available in-app via settings and the palette, which is the product path) |

Keyboard tour (full map in `keyboard-focus-map.md`): `⌘K` palette · `C`
quick create · `J K H L`/arrows to move focus · `Enter` open · `S P` on
a focused ticket · `⌘F` filter · `⌘Z` undo · `Esc` walks back out.

Other flows to poke: the view toggle (board/list), the **Order** control
in the header (Priority default / Manual — ADR 0003), quick create →
“Open full editor”, archiving from the panel header and the list view's
collapsed **Archived** group (ADR 0004), the settings dialog (key lock,
theme, appearance, remove guarantee), the waitlist button in the sidebar
footer (try a bad email and one containing “offline”), the terminal
handle at the bottom edge (reserved Phase 2 geometry only), and project
switching (skeleton load).

## Step-plan coverage

Every Step 2 work item maps to a place in this bundle:

- **App shell, Local + Starred only** — prototype shell; `screen-specs.md` § App shell.
- **Terminal region reservation (geometry only)** — bottom handle; § Terminal region.
- **First launch & project creation · settings & themes · board · list ·
  panel · markdown editing · checklists · merged timeline · palette ·
  waitlist · light & dark** — all live in the prototype; each has a
  section in `screen-specs.md`.
- **Quick + full ticket creation** — `C` / palette / column `+` → quick;
  “Open full editor” → full create.
- **Board ordering & archival (ADRs 0003/0004)** — header Order control;
  panel Archive action + list archived group.
- **Agent round-trip moment** — driver `❯ agent session`; specified in
  `states.md` § External-update states.
- **All five trust states** — driver buttons; specified in `states.md`.
- **Keyboard paths, focus, optimistic states, ≤150ms motion** —
  `keyboard-focus-map.md`; `states.md` § Loading; `screen-specs.md`
  § Motion inventory.
- **Clay spot-check** — `renders/` + live theme swatches.

## Proposals and founder sign-off (M0)

None of these diverge from settled decisions; they are the Step 2-level
choices the brief left open, resolved in the prototype and flagged here
rather than silently:

| # | Proposal | Rationale |
|---|---|---|
| **P1 — accepted 2026-08-01** | Palette gains **set priority…**, **switch board/list view**, **archive/unarchive ticket**, and **change board ordering…** beyond the fixed D14 set (which also loses *assign…* per ADR 0001) | D8 ships `P` as a shortcut and components.md requires every shortcut be palette-discoverable; the view toggle, archive (ADR 0004) and ordering (ADR 0003) otherwise have no keyboard path |
| P2 | Quick create = title + status only | The brief's "title + status, enter, done"; everything else lives in full create |
| P3 | Ticket panel is a 560px right overlay; board stays live behind it | Density + context; Esc returns focus to the originating card |
| P4 | Freshness decays on open or after 2 minutes | components.md said "opened or after 2 minutes"; confirmed as the rule for list + board |
| P5 | Canceled column renders only when non-empty | Keeps the default board at five columns; canceled tickets remain in list/search |
| P6 | Card footer: ≤2 labels, ≤1 when a checklist fraction is present | Footer never wraps |
| P7 | Header **disk-state indicator** (`writing ticket.md… → ✓`) | The honest counterpart to optimistic UI in a files-first product |
| P8 | Conflict "Keep mine": draft stays, save annotates the event, external version stays in history | UI semantics for the format's "never silently overwrite" rule; engineering detail lands in Step 3/6 |
| P9 | Opening a folder that already contains `.longclaw/` skips the create form entirely | Existing projects open in two clicks |
| P10 | Welcome copy: "Plan with your agents." + mono trust line | The folder-on-disk model stated before any interaction |

## ADR propagation (post-M0 founder decisions)

The five ADRs in [`docs/adr/`](../../adr/) are propagated through the
prototype and every spec in this bundle:

- **ADR 0001 — no assignee in local mode.** All of v0 is local mode, so
  the assignee row, avatars on cards/rows, the `A` shortcut, and the
  palette assign command are gone; `assignee` remains an optional schema
  field for team mode. Human circle avatars still appear in the timeline
  and composer (actors, not assignment).
- **ADR 0002 — fixed statuses.** No status-creation UI anywhere; the six
  built-ins are the enum (foundations D3's creation row is deferred).
- **ADR 0003 — ordering.** Header `Order: Priority|Manual` control,
  priority-default sorting, palette command, keyboard nav follows visual
  order.
- **ADR 0004 — archival in v0.** Archive/Unarchive in the panel header,
  archived chip, undo toast, activity events, list-view archived group,
  archived tickets excluded from board and tagged in search.
- **ADR 0005 — attachments UI post-MVP.** Unchanged: no attachment
  surfaces in the prototype; the format keeps the registry.

## Exit-gate status

- ✅ Every MVP flow demonstrable without inventing screens or states —
  the coverage table above; nothing in the plan's flow list is missing.
- ✅ Folder-on-disk model visible throughout: path chips in header, panel
  (`tickets/LC-128/ticket.md`), create form, settings; mono file
  vocabulary; disk-state indicator; ticker narrating writes.
- ✅ First launch is a sub-one-minute path (driver-measured: 3 clicks from
  welcome to board; theme preselected, no account step anywhere).
- ✅ Data for every screen/state identified and mapped to the format
  contract — `data-requirements.md`, including 6 open items Step 3 must
  close before M1.
- ✅ Zero hardcoded hues: `grep -cE '#[0-9a-fA-F]{3}\b|#[0-9a-fA-F]{6}\b'`
  over `prototype.css`/`prototype.js` markup styles hits nothing —
  theme/appearance switching is a token swap on `<html>`.
- ⏳ Founder review of the experience, the remaining P2–P10 proposals, and this
  bundle — the M0 gate. The file format (Step 3) stays open until then.

## Regenerating renders

```sh
cd docs/design/prototype
npm i playwright   # once; uses your installed Chrome
node scripts/render.mjs
```
