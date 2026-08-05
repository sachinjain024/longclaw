---
title: "Active plans"
product: LongClaw
status: active
milestone: "M5 — Feature-complete v0 (Steps 11–15)"
written: 2026-08-01
applies_to: "wave-1-ticket-domain-and-surfaces @ eb54bac"
---

# Active plans

One file per piece of pending work. Each is self-contained: it carries its own
working rules, the current behaviour with file and line, what to change, and what
has to pass before it is done. Pick one and execute it without reading the others.

**Step 12 and plans 24 through 30 are complete as of 2026-08-01.** Everything
before them is closed, Wave 0 is clear, and M4 closed on 2026-07-31 when the
founder decided to proceed without the pilot sessions
([decision](../../pilot/response-memo.md#direction-decision-2026-07-31-superseded-the-same-day)).
Step 11 is [Wave 1 of the backlog](../../backlog/v0-backlog.md) — V0-08 through
V0-19 — and all twelve are now closed: V0-19 as plan 11, V0-18 as plan 12, V0-17
as plan 13, V0-08 as plan 14, V0-10 as plan 15, V0-14 as plan 16, V0-11 as plan 17,
V0-12 as plan 18, V0-13 as plan 19, V0-09 as plan 20, V0-15 as plan 21, and V0-16
as plan 22. Plan 23 is not a thirteenth item: it is a **defect found while Wave 1
was being built** — Retry on a conflict re-sent a hash the disk had already moved
past — and it is closed too. Wave 1 does not reopen for it.

Be careful what that is taken to mean. Wave 1 is closed against its own must-pass
checks and nothing more: **the order those twelve were built in was never
validated, because the pilot that would have validated it was skipped**, and no
part of the slice has been in front of a user. Several closed rows name a
divergence, an open edge, or a spec the ADRs contradict; the backlog's must-pass
column is where those live, and it is worth reading before assuming a surface is
finished rather than merely shipped.

**Step 12 — [Wave 2](../../backlog/v0-backlog.md), keyboard-first — is complete.** V0-20 through V0-25 are plans 24–29 below, written together on
2026-08-01 at the founder's request rather than one at a time. That is a deliberate
departure from the rule further down this file ("write a plan when you pick an item
up"), and it has a cost worth knowing: the later a plan sits in that list, the more
its "what exists today" section is a prediction. **Plans 27, 28 and 29 describe a
codebase that plans 24–26 have not built yet.** Re-verify every file:line before
editing, and amend the plan rather than working around it when it is wrong.

Three things to read first, once, before Step 12 code:

- [`AGENTS.md`](../../../AGENTS.md) § Toolchain and the gate — the shims, the traps,
  and why a red native watcher is an environment suspect before a code one.
- [`keyboard-focus-map.md`](../../design/prototype/keyboard-focus-map.md) — the
  normative document for all six items, including its § Not bound in v0
  (deliberate), which is as much of the spec as the tables are.
- [The retired handoff](../completed/pending-work-after-step-10.md) § The one thing
  worth carrying forward — the unvalidated order above, in its original words.

**One trap that costs an hour if you find it the hard way, and it has an owner.**
[`docs/mvp_plan_order.md` § Step 12](../../mvp_plan_order.md) was never
ADR-propagated: it still lists an `assign` palette command (removed by ADR 0001)
and still says to "reserve but do not expose" the terminal command, which the
backlog must-pass and three design docs all contradict. The design docs, the ADRs
and the backlog's must-pass column govern; the step plan describes intent and is
stale on both points. **Build from the design docs and leave the stale one alone**
— reconciling it is [plan 30](../completed/30-reconcile-step-12-command-set.md), which is
documentation debt and runs independently of the six implementation plans.
**Step 12's documentation is complete:** plan 30 and the command-set
reconciliation are closed.

The command set itself is no longer in question. **Proposal P1 was accepted by the
founder on 2026-08-01**, so the root set is twelve: the original D14 eight, plus
set priority, archive/unarchive, change board ordering and switch board/list view.
`assign` stays out under ADR 0001. The terminal row is visible, disabled and tagged
`PHASE 2`, and **no terminal behaviour is in v0 scope** — the Phase 2 guardrail is
unchanged. `screen-specs.md`, `components.md`, `prototype/README.md` and plan 25
are synchronised on all of that.

## No plan is open

**Plan 41 closed on 2026-08-04** ([outcome](../completed/41-accessibility-audit.md#outcome)),
and this directory now holds only this file.

The section below is kept as written, because what it predicted is worth
comparing against what happened. It called Part A "verification, not discovery"
and said it "needs a human at a keyboard with VoiceOver on". Half of that held:
the keyboard *contract* is written down, so it could be executed rather than
performed — `npm run a11y:audit` is the result. The other half did not: Part A
was **not** only verification. It found three release blockers, one of which is a
platform behaviour nobody in this repository had looked at (WebKit skips
`<button>` in the tab order on a default Mac), and which made four core actions
pointer-only. A plan that expects to find nothing is still worth running.

Part B — the VoiceOver semantic pass — is deferred to **2026-09-04, owner
Design**, and is P1 in [the post-MVP backlog](../../backlog/post-mvp-backlog.md).

## The one open plan — as written on 2026-08-04, before it was run

Everything numbered below is closed, and so are 36–40. **Plan 40 closed on
2026-08-04** ([outcome](../completed/40-step-16b-spec-gaps.md#outcome)): seven of
Step 16b's eight spec gaps are resolved, every Step 4 performance budget now has
a number against it, and three of the eight turned out to rest on a premise that
was wrong — the perf "regressions" were macOS Low Power Mode, the "missing"
startup probe had shipped since Step 4, and the transitive-`reqwest` alarm was
misdirected at a dependency macOS never compiles. Its eighth task is the only
pending work in this directory:

**[41 — The accessibility audit against the packaged app](../completed/41-accessibility-audit.md)**,
written 2026-08-04, partly release-blocking. Split out of plan 40 because it is
the only one of the eight that cannot be automated: it needs a human at a
keyboard with VoiceOver on. It is deliberately in two halves. **Part A —
keyboard-only lifecycle, focus order and return, visible focus, reduced motion,
zoom — blocks the MVP**, because `release-candidate.md` already defines "an
accessibility failure that prevents keyboard completion of the core ticket
lifecycle" as a release blocker. Part A is verification rather than discovery:
the semantics are built, the keyboard map is normative, and Wave 2 closed the
escape contract with tests. **Part B — the VoiceOver semantic audit — can wait**,
with a date and an owner, because `release-risks.md:65` already registers
"postponed to Step 16 and then compressed" as the risk.

## Order

The numbers are a recommended sequence, not a hard dependency chain. Anything
marked independent can be done at any time by anyone.

| #   | Plan                                                                           | Backlog | Why here in the order                                                                                                  |
| --- | ------------------------------------------------------------------------------ | ------- | ---------------------------------------------------------------------------------------------------------------------- |
| ~~00~~ | ~~Confirm CI on main~~ — **done 2026-07-31**, [outcome](../completed/00-confirm-ci-on-main.md) | — | Closed. `main` does build: run 30624782219 on `b773a7a` is green through `tauri build`. It also caught a red run on the previous tip, which produced 09. |
| ~~01~~ | ~~Close the atomic-replace race~~ — **done 2026-07-31**, [outcome](../completed/01-atomic-replace-race.md) | V0-01 | Closed. Read its outcome before starting 06: the write path moved, and the test seam it added assumes writes stay on the calling thread. |
| ~~02~~ | ~~Recover from an event-sequence gap~~ — **done 2026-07-31**, [outcome](../completed/02-event-sequence-gap.md) | V0-02 | Closed. It added `ProjectSnapshot.sequence`, which is the snapshot-reconcile boundary item 05 needs. |
| ~~03~~ | ~~Attribute a change from new records only~~ — **done 2026-07-31**, [outcome](../completed/03-attribution-from-new-records.md) | V0-07 | Closed. It restructured the tail of `process_burst`, which 05 and 06 both touch. |
| ~~04~~ | ~~Validate the project prefix on ingest~~ — **done 2026-07-31**, [outcome](../completed/04-project-prefix-validation.md) | V0-03 | Closed. It changed the signatures 05 and 06 will be holding: `read_ticket_file`, `TicketIndex::rebuild`, and both `ingest` methods now take the project key. |
| ~~05~~ | ~~Recover the watcher over sleep, wake, and overflow~~ — **done 2026-07-31**, [outcome](../completed/05-watcher-recovery.md) | V0-04 | Closed. It added native macOS wake recovery, overflow recovery, coalescing, and explicit unavailable reporting. |
| ~~06~~ | ~~Move heavy work off the command thread~~ — **done 2026-07-31**, [outcome](../completed/06-blocking-workers.md) | V0-05 | Closed. Scans, parsing, and fsync run on a bounded two-worker pool; rebuild requests return promptly and coalesce behind one `IndexRebuilt` event. |
| ~~07~~ | ~~Virtualize the board and list~~ — **done 2026-07-31**, [outcome](../completed/07-board-virtualization.md) | V0-06 | Closed for the board. Columns are windowed scroll containers over `boardGeometry.ts`, and the board carries roving arrow/`j`-`k` focus because WebKit never had the cards in the Tab order. Wave 1's list surface (V0-14) inherits that geometry and re-traces with `npm run perf:board`. |
| ~~08~~ | ~~Triage the dependabot advisories~~ — **done 2026-07-31**, [outcome](../completed/08-dependabot-triage.md) | V0-40 | Closed. All three advisories are unreachable, with the argument recorded. It produced V0-40: the alert list itself is the problem, not any advisory in it. |
| ~~09~~ | ~~Stop treating a vanished path as a watcher overflow~~ — **done 2026-07-31**, [outcome](../completed/09-rename-is-not-an-overflow.md) | —       | Closed. `collect_event` now drops only transient `Io(NotFound)` watcher errors and still escalates other errors to overflow recovery. |
| ~~10~~ | ~~Stop npm from breaking the native watcher check~~ — **closed 2026-07-31, not reproducing**, [outcome](../completed/10-npm-native-watcher-timeout.md) | — | Closed without a fix. Eight consecutive npm-launched native watcher runs, `npm run verify` at exit 0, and CI run 30629158530 are all green on the same tree that timed out. The mechanism was never found; the outcome says what to do if it returns. |
| ~~11~~ | ~~Remove assignee from the prototype specs~~ — **done 2026-07-31**, [outcome](../completed/11-remove-assignee-from-specs.md) | V0-19 | Closed for the text, not for the screens. The Step-1 foundations were the gap: ADR 0001's propagation pass never opened `components.md`. The two `proof/` HTML files were corrected here; the ten PNGs in `proof/renders/` were not, because the pipeline that made them is not in the repo, so every committed render still shows an assignee. That is **V0-41**, filed 2026-08-01 — see the plan's amendment. |
| ~~12~~ | ~~The Rust backend Wave 1 is missing~~ — **done 2026-07-31**, [outcome](../completed/12-rust-backend-for-wave-1.md) | V0-18, and the backend halves of V0-09 and V0-10 | Closed. V0-18 is done outright. The other two are backend-only: label definitions now cross IPC on `ProjectReference` with `add_project_label`/`update_project_label`/`remove_project_label` behind them, and `TicketEdit.rank` accepts `null` to clear. Read its outcome before V0-09 or V0-10 — it is the API handoff. |
| ~~13~~ | ~~Optimistic create, per-mutation write feedback, and undo~~ — **done 2026-07-31**, [outcome](../completed/13-optimistic-create-toasts-and-undo.md) | V0-17 | Closed, and it is the frontend handoff. Every mutation the rest of Wave 1 adds should go through `mutate()` in `src/mutations.ts` rather than calling `editTicket` directly. Read its outcome before V0-08, V0-11, or V0-16 — it names two places where the approved spec and the ADRs disagree. |
| ~~14~~ | ~~Priority end to end~~ — **done 2026-07-31**, [outcome](../completed/14-priority-end-to-end.md) | V0-08 | Closed, and it hands three later items a shared popover and an ordering seam. Read its outcome before V0-09, V0-10, or the status menu: `src/Menu.tsx` is the one menu all four fields use, and `src/ordering.ts` is where a Manual comparator goes. |
| ~~15~~ | ~~Project-scoped labels~~ — **done 2026-07-31**, [outcome](../completed/15-project-scoped-labels.md) | V0-10 | Closed. It is the frontend half of what plan 12 built: definitions are managed in project settings and a ticket still carries slugs and nothing else. Read its outcome before V0-14 or V0-16 — `src/labels.ts` and `src/LabelChip.tsx` are the chip both of them need, and `src/LabelMenu.tsx` is the meta row a create surface reuses. |
| ~~16~~ | ~~The dense issue list~~ — **done 2026-07-31**, [outcome](../completed/16-dense-issue-list.md) | V0-14 | Closed, and it is the second surface. Read its outcome before V0-09, V0-11 or V0-15 — the board's bucketing moved to `src/grouping.ts`, `boardGeometry.ts`'s `columnOffsets` is now `runningOffsets`, and the status dot the whole app was missing now exists. |
| ~~17~~ | ~~Archive and unarchive~~ — **done 2026-07-31**, [outcome](../completed/17-archive-and-unarchive.md) | V0-11 | Closed. Archived tickets now leave `groupByStatus` rather than leaving the board, and the write is raised in `App.tsx` because archiving closes the panel. Read its outcome before V0-15 (the exclusion is in the shared bucketing) and before V0-24 (the `· archived` tag on a search result is still open). |
| ~~18~~ | ~~Markdown write/preview editor~~ — **done 2026-07-31**, [outcome](../completed/18-markdown-editor.md) | V0-12 | Closed, and it is the renderer the rest of the product reads markdown through. Read its outcome before V0-13 (comment bodies want `MarkdownView`) and before V0-27 (a relative attachment link deliberately does not become a link yet). |
| ~~19~~ | ~~Complete the merged timeline~~ — **done 2026-08-01**, [outcome](../completed/19-merged-timeline.md) | V0-13 | Closed. `Timeline.tsx` reads `event.kind` now, and what a kind and a field mean lives in `src/timelineEvents.ts` rather than in JSX. It also extended the markdown subset with ordered lists and block quotes, and added a cross-language pin on the set of fields an edit can write. Read its outcome before V0-09 or V0-16 — a new `FieldChange.field` needs a sentence, and the fixture will say so. |
| ~~20~~ | ~~Board ordering, Manual mode, and drag-and-drop~~ — **done 2026-08-01**, [outcome](../completed/20-board-ordering-and-drag.md) | V0-09 | Closed, and it is the second comparator the board was built to take. Rank allocation is fractional indexing in `src/rank.ts`; the drop position is arithmetic over `boardGeometry.ts` rather than the element under the pointer. Read its outcome before V0-15 — the mixed ranked/unranked rule and its one limitation are decided there, not in a surface. |
| ~~21~~ | ~~Filter, sort, and grouping behaviour~~ — **done 2026-08-01**, [outcome](../completed/21-filter-and-grouping.md) | V0-15 | Closed, and it is the last narrowing seam the surfaces get. The filter is `src/filtering.ts`, called once in `App.tsx` before grouping, so both surfaces receive one already-narrowed array. Read its outcome before V0-23 (the `Esc` ladder now has its last rung) and before V0-24 (the header filter and search deliberately match different things). |
| ~~22~~ | ~~Full ticket create surface~~ — **done 2026-08-01**, [outcome](../completed/22-full-create-surface.md) | V0-16 | Closed, and it closes Wave 1. There are two create surfaces now: quick create is title + status, and `src/CreatePanel.tsx` is the panel in create mode with every approved field. Read its outcome before V0-23 — the create panel takes its own `Esc` and `⌘↵` rung, and it found that a `<button>` in a `<form>` submits it. |
| ~~23~~ | ~~Retry must not re-send a stale hash~~ — **done 2026-08-01**, [outcome](../completed/23-retry-must-not-resend-a-stale-hash.md) | —       | Closed. A defect found while Wave 1 was being built, not a backlog row: `mutate()` offered a Retry on every failed write, and on a conflict the `expectedHash` that Retry re-sends is stale by definition, so the button could never succeed. A conflict now says what changed and who changed it and offers **Open ticket** instead. The four things it deliberately left are closed by [plan 39](../completed/39-v0-29-write-failure-states.md), which is where a board-raised conflict finally reaches a resolution: the refused edit travels to the panel and is re-applied over the file the panel read. |
| ~~24~~ | ~~Single-key actions on the focused ticket~~ — **done 2026-08-01**, [outcome](../completed/24-single-key-actions.md) | V0-22 | Closed. Single-key actions, modifier safety, panel behavior, tests, and perf budgets are complete. |
| ~~25~~ | ~~The `⌘K` palette shell and the root command set~~ — **done 2026-08-01**, [outcome](../completed/25-command-palette-shell.md) | V0-20 | Closed. Root commands, styling, accessibility, focus behavior, and tests are complete. |
| ~~26~~ | ~~Palette sub-modes~~ — **done 2026-08-01**, [outcome](../completed/26-palette-sub-modes.md) | V0-21 | Closed. All six modes, target selection, previews, notes, reasons, navigation, and tests are complete. |
| ~~27~~ | ~~The search surface over the existing index~~ — **done 2026-08-01**, [outcome](../completed/27-search-surface.md) | V0-24 | Closed. Indexed search, result states, archived/degraded rows, and interaction budgets are complete. |
| ~~28~~ | ~~Navigation, focus return, and the escape contract~~ — **done 2026-08-01**, [outcome](../completed/28-focus-and-the-escape-contract.md) | V0-23 | Closed. Escape handling, focus traps/returns, fallback focus, and regression coverage are complete. |
| ~~29~~ | ~~The shortcut reference~~ — **done 2026-08-01**, [outcome](../completed/29-shortcut-reference.md) | V0-25 | Closed. The generated shortcut reference, binding test, chord convention, and decision record are complete. |
| ~~30~~ | ~~Reconcile Step 12 command-set documentation~~ — **done 2026-08-01**, [outcome](../completed/30-reconcile-step-12-command-set.md) | — | Closed. The execution plan now records the accepted command set and visible terminal placeholder. |
| ~~31~~ | ~~System-matched appearance, persisted~~ — **done 2026-08-01**, [outcome](../completed/31-system-matched-appearance.md) | V0-35 | Closed. `system` now tracks live OS appearance changes through a `matchMedia` listener; persistence and override behavior are pinned by five App tests. |
| ~~32~~ | ~~Instant per-project theme selection~~ — **done 2026-08-01**, [outcome](../completed/32-instant-theme-selection.md) | V0-36 | Closed. The specified swatch picker is `src/ThemePicker.tsx` (creation + settings; the palette already had rows), the 150ms crossfade is one transient class transitioning colors only, and `changeTheme` is optimistic with no snapshot re-fetch. |
| ~~33~~ | ~~The token guard~~ — **done 2026-08-01**, [outcome](../completed/33-token-guard.md) | V0-34 | Closed. `tokens/build.mjs` refuses a missing theme value naming the token, and `scripts/color-guard.mjs` fails `tokens:check` on any color literal outside `src/tokens/` — both confirmed red first. |
| ~~34~~ | ~~The proof render pipeline~~ — **done 2026-08-01**, [outcome](../completed/34-proof-render-pipeline.md) | V0-41 | Closed. `docs/design/foundations/scripts/render.mjs` is committed and `proof/renders/` is regenerated from the corrected HTML — no assignee anywhere, which closes V0-19's screen clause. |
| ~~35~~ | ~~The theme matrix~~ — **done 2026-08-01**, [outcome](../completed/35-theme-matrix.md) | V0-37 | Closed. `npm run matrix` drives the real App through nine states × 4 presets × 2 appearances in WebKit, failing on rendered contrast or actor-distinction; a CI job runs it and uploads the renders. |

Dependencies worth knowing:

- **05 is done, and 06 preserved it.** Wake and overflow recovery still travel through
  `ProjectEngine::rebuild`, and resume/overflow rebuilds remain coalesced after
  rebuild work moved off the command thread.
- **06 touched `process_burst`** in `apps/desktop/src-tauri/src/engine.rs`, and 03
  has already reshaped its tail: the
  previous row is read once, before the ingest, because attribution needs the record
  id the ingest is about to overwrite. Do not reorder that. 04 added one more thing
  to it: the project key is read once at the top of the burst, so every path in the
  burst is judged against the same project.
- **04 is done, and both 05 and 06 inherit its signatures.** Reading a ticket now
  requires saying which project you are reading for:
  `storage::read_ticket_file(path, project_key)`,
  `TicketIndex::rebuild(root, project_key)`, and `ingest`/`ingest_attributing` all
  take it. Item 06 moved these onto workers, carrying the project key with the
  work. Item 05's snapshot reconcile goes through
  `ProjectEngine::rebuild`, which now reads `project.md` *before* the tickets —
  deliberately, because the key decides which directories are this project's at all.
- **06 inherited two things from 01.** The write path an edit takes is now
  `commit` → `storage::atomic_replace`, not `atomic_write`. And `ReplaceSeams`, the
  test seam 01 added, lives in a `thread_local!`; the engine now captures it before
  submitting the worker write, so the race test still drives the swap window.
- **07 is done, and V0-14 inherited it, as intended.** The board's geometry in
  `boardGeometry.ts` is what the list was built on; the sticky group headers and
  the archived group 07 warned about and did not have to solve are solved in 16.
- **11 is done, and V0-14 and V0-16 inherit an open edge.** `components.md` and
  `decisions.md` no longer show an assignee, so the board and card anatomy can be
  built straight from the spec. The Step-1 proof pages under
  `docs/design/foundations/proof/` still do show one — including the list-row and
  create-form specimens those two items would build from — because correcting them
  means regenerating ten committed PNGs with a pipeline that was never committed.
  [11's outcome](../completed/11-remove-assignee-from-specs.md) names every spot.
- **13 is done, and every remaining Wave 1 frontend item hangs off it.** One
  seam runs a ticket mutation: `mutate()` in `apps/desktop/src/mutations.ts`
  applies the change optimistically, writes in the background, reverts and says
  so if the write fails, and takes it back through an ordinary `edit_ticket`.
  Undo is itself a `Mutation`, so a surface that wants Undo writes the inverse
  and nothing else. The ticket panel exposes the same thing one level up as
  `save(edit, SaveFeedback)`, which is what V0-08's priority menu and V0-11's
  archive should call. Do not add a second write path or a second toast: the
  toast is a single stack and `⌘Z` is already wired to it.
- **14 is done, and V0-09 and V0-10 both sit directly on it.** `src/Menu.tsx` is
  the one anchored popover `screen-specs.md:239-247` specifies for status,
  priority, ordering and labels: it is handed rows, the values currently set, and
  an anchor, and it knows nothing about the field it is editing. V0-10's labels
  menu is the same component with `multiple`; the ordering control is the same
  component with `footnote`. `src/ordering.ts` holds `byPriority` and
  `orderColumn(tickets, compare)`, called once per column by `layOutColumns`, so
  V0-09's Manual mode is a second comparator and a mode argument rather than a
  rewrite of the board's layout. Do not inline a sort in `Board.tsx` and do not
  build a second popover.
- **15 is done, and V0-14 and V0-16 both inherit a chip from it.** A ticket
  stores label slugs, so every surface that shows one goes through
  `resolveLabels` in `apps/desktop/src/labels.ts` and renders `LabelChip` from
  `src/LabelChip.tsx`: that is the only place the D12 ramp is read, and the only
  place a slug the project defines no label for is turned into something legible.
  The list row's own cap of two chips (`screen-specs.md:144`) is a `limit`
  argument, not a second implementation. `src/LabelMenu.tsx` is the Labels meta
  row, and it is what V0-16's create surface should hang off rather than the
  comma-separated text field `QuickCreate.tsx` still carries. Definition
  management lives in project settings, because `screen-specs.md` § Project
  settings never mentions labels; a slug is immutable there, deliberately.
- **16 is done, and V0-09, V0-11 and V0-15 all sit on it.** There are two surfaces
  now, and they are both projections of the same store array — do not give either
  one a cache. Bucketing by status lives in `apps/desktop/src/grouping.ts`:
  `groupByStatus(tickets, { compare, keepEmpty })` is called by the board with
  `keepEmpty` and by the list without it, and `seatsFor` builds the seat map both
  keyboard models navigate by, so V0-15's grouping is an argument rather than a
  third layout. The windowing arithmetic is still one function in
  `boardGeometry.ts` — `columnOffsets` was renamed `runningOffsets`, because it
  was never about columns — and `src/listGeometry.ts` composes the list's slots
  and strides without repeating any of it. Do not write a second binary search.
  `src/StatusDot.tsx` is the dot every surface and the status menu now share, and
  `src/tickets.ts` has `isArchived`, which is the predicate V0-11 should take the
  board's archived tickets off with. The perf harness drives either surface:
  `npm run perf:board` and `npm run perf:list`.
- **17 is done, and V0-15 and V0-24 each inherit one edge of it.** Archived is a
  date and not a status (ADR 0004), so an archived ticket now has no status bucket
  at all: `groupByStatus` in `apps/desktop/src/grouping.ts` drops it, which is what
  keeps it off the board without either surface owning a rule of its own, and the
  list still fills its own archived group by asking `isArchived` directly.
  **V0-15's filtering sits on top of that** — if a filter ever wants archived
  tickets inline, it is a new argument to `groupByStatus`, not a filter in a
  surface. The write itself is `setArchived` in `src/App.tsx`, raised there rather
  than through the panel's `save()` because archiving closes the panel and the
  panel's revert, toast, undo and conflict all live in component state; the panel
  holds a ghost button, an `archived` chip, and no write. **V0-24 inherits the
  other half:** `search_tickets` already returns archived tickets and a Rust test
  pins it, but the `· archived` tag on a result (`screen-specs.md:154`, `:236`) is
  unbuilt, because there is no search UI in the app to hang it on. The row carries
  `archivedAt`; rendering the tag is V0-24's.
- **18 is done, and V0-13 and V0-27 each inherit one edge of it.** There is one
  markdown renderer now and there must not be a second:
  `apps/desktop/src/markdown.ts` parses to a tree whose node union has **no
  `html` member**, and `src/MarkdownView.tsx` renders that tree to React
  elements. The app has no sanitizer and needs none — a renderer with no branch
  that can emit markup has nothing to sanitize — so **do not introduce
  `dangerouslySetInnerHTML` anywhere, and do not add a markdown dependency that
  hands back an HTML string.** `headingOffset` exists so a `#` inside a panel
  section becomes an `h4`; **V0-13 should render comment bodies through it**,
  replacing the bare `<p>{prose}</p>` at `src/Timeline.tsx:50`, because a comment
  body is agent-written by definition. **V0-27 inherits the other half:** a
  relative attachment link and an image render as their own markdown text rather
  than as a link or an `<img>`, deliberately, because v0 has no attachment UI
  (ADR 0005) and the webview would navigate the app to a 404. `linkHref` in
  `markdown.ts` is the one place that rule lives. The six formatting actions are
  pure string transforms in `src/markdownToolbar.ts`, which is what lets the
  no-reformatting claim be a unit test rather than a DOM one; a seventh button
  would be a row there, not a new component.
- **19 is done, and V0-09 and V0-16 each inherit an obligation from it.** The
  timeline is complete, and the way it stays complete is that **a new
  `FieldChange.field` needs a sentence**. Turning a wire value into something a
  human reads lives in `apps/desktop/src/timelineEvents.ts` — `describeChange`
  is one branch per field, and `entryShape`/`unfamiliarKind` decide the two
  entry shapes — and it is pinned across the language boundary:
  `src-tauri/tests/fixtures/ipc-contract.json` carries `appliedFieldChanges`,
  Rust asserts its own serialized output equals it in
  `core::ticket::tests::json_contract_applied_field_changes`, and
  `src/timelineEvents.test.ts` reads the same array and asserts each entry has a
  sentence. **So V0-09's Manual mode, which writes `rank`, and V0-16's create
  surface both go red on both sides if they add a field and stop there** — which
  is the point. Do not describe a field inside `Timeline.tsx`, and do not
  re-describe a status, a priority or a label in words: `StatusDot`,
  `PriorityGlyph` and `LabelDot` are the change line's glyph vocabulary.
  **V0-27 inherits one more thing:** 18's subset grew ordered lists and block
  quotes here, so the constructs left outside it are now thematic breaks, setext
  headings, tables and raw HTML, and `markdown.ts`'s header says so.
- **20 is done, and V0-15 inherits the ordering seam whole.** There are two
  comparators now and `comparatorFor(mode)` in `apps/desktop/src/ordering.ts` is
  the only place a mode becomes one: the board and the list both pass it into
  `groupByStatus`, so a third order is a comparator and a menu row rather than a
  sort inside a surface. **Rank allocation is `src/rank.ts` and nothing else may
  allocate one** — LongClaw owns it in v0 (ADR 0003), agents preserve what they
  find, and a rank outside its alphabet is preserved and ordered by but never
  repaired. The mixed case is decided: ranked cards first in rank order,
  unranked after in the priority order they had, which is what makes switching
  mode move nothing and write nothing. Its limitation is decided too — a drop
  that cannot be expressed as a rank on the dragged card alone writes nothing,
  because the alternative is a rank in every file in the column — so **do not
  "fix" it in a surface**; it is `rankForDrop`'s, and changing it is changing the
  trade the plan argues. The board's drop position is `gapAt` in
  `boardGeometry.ts` over the offsets the window is already cut from, which is
  the only reason a drop works past the rendered window; do not reach for the
  element under the pointer. The ordering preference is device-local app state in
  `localStorage` beside `appearance`, keyed by project — **not** in
  `registry.rs`, deliberately; V0-31 later added registry recovery without
  changing that ownership. And reordering has no keyboard path on purpose:
  `keyboard-focus-map.md:158-161` puts it outside v0, so **V0-23 should not add
  one** without reopening that line.
- **21 is done, and V0-23 and V0-24 each inherit one edge of it.** There is one
  place a query narrows the rows now: `filterTickets` in
  `apps/desktop/src/filtering.ts`, called once in `App.tsx` **before** grouping
  and never inside it — the archived exclusion in `groupByStatus` is a statement
  about status and a filter is not, so do not add a third responsibility there.
  The rule is client-side over key, title and label slugs, which is
  `TicketIndex::search`'s rule minus the description a `TicketRow` does not
  carry; **do not reach for `search_tickets` for a filter**, because its
  100-result cap would drop matches off the board without saying so. An
  unreadable row is exempt from the filter and always drawn, deliberately.
  **V0-23 inherits the `Esc` ladder**: the filter is the last rung
  (`keyboard-focus-map.md:19-21`), and it stands down by state while the ticket
  panel or the create modal is open and by `stopPropagation` for menus and the
  description editor — a new layer needs to take its own rung the same way.
  **V0-24 inherits the other half:** search is the surface that *should* call
  `search_tickets`, and it will match descriptions the header filter cannot, so
  it should say on screen that it looks in more places. Two more things not to
  undo: the board drops ADR 0002's fixed scaffold in the no-match state and
  nowhere else (`Board`'s `scaffold` prop, one caller), and both surfaces now
  move focus only for a *new* focus request — a change to the roving key is not
  a licence to grab focus, because a query changes it while a human is typing.

- **22 is done, and it is the last Wave 1 item.** There are two create surfaces and the
  split is the spec's (`screen-specs.md:198-216`): quick create is title and
  status, and everything else is `apps/desktop/src/CreatePanel.tsx`, the panel in
  create mode. It sits **beside** `TicketPanel.tsx` rather than inside it because
  every behaviour there is a function of a file on disk, and shares the panel's
  vocabulary through `src/metaOptions.tsx` — **do not build a second status or
  priority option list, and do not give a create surface a labels text field**;
  `LabelMenuButton` is the row, and a slug typed into free text is a slug the
  project may not define. `DescriptionEditor` now has a `writeOnly` variant with
  no Preview tab and no footer, which is the shape any future surface that edits
  markdown before a file exists should take. **The create write is
  `submitNewTicket` in `App.tsx` and there is still only one write path**: the
  card is optimistic through `mutate()`, but the panel only swaps to view mode
  once the write has returned a real key, because view mode reads a file. **One
  trap worth carrying forward:** a `<button>` inside a `<form>` defaults to
  `submit`, and `Menu.tsx` had no `type` — putting the status menu in quick
  create's form fired a create per click. Every menu button is `type="button"`
  now; keep it that way.
- **23 is done, and V0-29 inherits what it left.** It is a defect fix rather than
  a backlog row, and the rule it settles belongs to the one write path: **a
  conflict never carries a Retry.** `mutate()` in `apps/desktop/src/mutations.ts`
  splits its danger toast on `code === "conflict"` now, because a mutation
  re-sends the `expectedHash` it was built from and a conflict is proof that hash
  is stale — so **do not "fix" a conflict by re-reading the hash and writing
  again**, which is the silent overwrite ADR 0010 and `mvp_plan_order.md` § Step
  14 both forbid. A conflict raised outside the panel gets `conflictMessage`'s own
  copy (the key, the actor from `context`, and the fact that nothing was written)
  plus an **Open ticket** action, wired from a mutation's new optional `review`.
  **Open ticket was not the conflict banner:** `ConflictBanner` is `TicketPanel`
  state and a board-raised conflict could not reach it, so Open ticket showed the
  file as it now reads and no more. Giving a mutation raised outside the panel a
  real two-way resolution — holding the refused edit, offering to write it over a
  newer file — was left to V0-29, and
  [plan 39](../completed/39-v0-29-write-failure-states.md) settles it: **yes, but
  only inside the panel, over content the human has been shown.** `App` holds the
  refused edit, the panel seeds its own banner once it has read the file, and Keep
  mine writes against the hash it rendered. The rule above is unchanged and is
  what makes that safe — nobody re-reads a hash and writes blind.
  `handles` is unchanged and still wins over all of this: a surface that owns its
  own conflicts keeps owning them.

Wave 2's own dependencies, which are tighter than Wave 1's were:

- **24 goes first, and 29 goes last, and both for the same reason.** 24 builds the
  rule the whole wave rests on — *single-key shortcuts suspend while an input has
  focus, chords do not* (`keyboard-focus-map.md:13-15`) — which today exists only as
  an ad-hoc `closest("input, textarea, …")` call in `WriteFeedback.tsx:83-86`. The
  palette is a chord that must stay live inside its own text input, so 25 cannot be
  reasoned about until that rule is a tested seam. 29 is a two-way check against the
  implemented set, and every item before it changes that set.
- **25 → 26 → 27 is one surface built in three passes.** The shell, then the
  sub-mode machinery, then search as the sixth sub-mode. Search is **not** a
  separate screen: `screen-specs.md` enumerates every v0 modal and there is no
  search surface among them.
- **28 is late on purpose, and it costs something.** Its must-pass names the
  palette, so the palette has to exist before the gate can be met. The price is that
  two known `Esc` holes survive until then — quick create and the ticket panel can
  be mounted at once so one press closes both, and `Esc` in the panel's title
  textarea both reverts the draft and closes the panel. Plans 25–27 are told not to
  make them worse; 28 owns fixing them.
- **Three design gaps are named in the plans rather than discovered during them.**
  The palette has **no empty and no no-result state** anywhere in the design bundle
  (25 and 27 derive theirs from `states.md:38-42` and say so); `SEARCH_LIMIT = 100`
  truncates silently with no designed affordance (27 decides); and **V0-25 has no
  design at all** — no trigger, no placement, no anatomy — which is why 29's first
  deliverable is a decision and its owner column says Design.
- **Do not add a keyboard path for reordering.** `keyboard-focus-map.md:158-161`
  puts it outside v0 deliberately and names `S` as the path that exists across
  columns. [20's outcome](../completed/20-board-ordering-and-drag.md) asks V0-23 to
  read that paragraph before touching it: adding one contradicts an approved line
  rather than filling a hole in it.
- **V0-24 closes Wave 1's last open edge.** `search_tickets` already returns
  archived tickets and a Rust test pins it, but the `· archived` tag
  (`screen-specs.md:154`, `:236`) was left unbuilt by V0-11 because there was no
  search UI to hang it on. The row carries `archivedAt`; 27 renders it.
- **09 and 10 are both closed, and no plan is open.** The vanished-path overflow bug
  is fixed in `collect_event`, and the npm-launched native watcher timeout that
  blocked local `npm run verify` no longer reproduces — closed without a fix, so
  treat a recurrence as an environment question and read
  [10's outcome](../completed/10-npm-native-watcher-timeout.md) before reopening
  anything. Wave 0 is clear and M4 is closed, so no code and no gate stood between
  this repository and Step 11, which is now behind it.

## Wave 3 is partly done, and Waves 1–2 no longer are open at all

**Step 16a is also closed, out of order, as
[plan 37](../completed/37-step-16a-ui-polish.md).** It was taken before Step 14
because the founder asked for it, and nothing in it depends on the recovery
work: it is a pass over the surfaces that already exist. Read its § Deferred
discrepancies before assuming a surface matches the design bundle — six real
gaps are recorded there as deliberately open, and Step 14 will build trust
states onto some of them. `scripts/token-guard.mjs` is the durable thing it
left: a literal radius or motion duration outside `src/tokens/` now fails
`tokens:check`, the way a literal hue already did.

Wave 1 and Wave 2 are closed above. **Wave 3's five Step-13 rows — V0-34,
V0-35, V0-36, V0-37 and V0-41 — closed on 2026-08-01 as plans 31–35**, written
one at a time as each was picked up, which is the rule below working as
intended. Most Step-14 recovery work closed on 2026-08-02 in
[plan 38](../completed/38-complete-step-14-recovery.md): V0-26, V0-27, V0-28,
V0-30, V0-31, V0-32, V0-33, and V0-40. **V0-29 closed on 2026-08-04 as
[plan 39](../completed/39-v0-29-write-failure-states.md), which completes Step
14** — the four clauses plan 23 left behind, plus a fifth the planning turned up:
Keep mine re-sent the hash Rust had just refused, and only worked when the
watcher's event won a race. Read plan 39's outcome before touching the write
path: `conflictMessage` in `src/mutations.ts` is the one composer for a conflict,
`src/failure.ts` is the one presentation for a failed write, and the panel is the
only place a refused edit may be re-applied — over a file the human has been
shown. V0-42 is still open, but it belongs to Step 16 because it is the
runner-stable interaction-budget gate, not recovery behavior.

What remains is ordinary sequencing. Wave 2 was written all at once on 2026-08-01
because the founder asked for it; **that is the exception, and the § Step 12 note
above records what it costs.** For Wave 3, write a plan when you pick an item up,
not thirteen plans in advance — the backlog rows already carry the must-pass check
and the reason each exists, which is most of what a plan needs. Take them roughly
in order; that order is final rather than provisional, and
[the retired handoff](../completed/pending-work-after-step-10.md) says what that
is worth, which is not much: it was never tested against a user.

Two risk-based items were taken out of order and are now closed by
[plan 38](../completed/38-complete-step-14-recovery.md): V0-30 (index-loss
recovery) and V0-40 (scope Dependabot to what ships). The third, ~~V0-19~~, was
taken first exactly as this said and
[closed](../completed/11-remove-assignee-from-specs.md) before Step 11 built the
surfaces around it — for the specs and the `proof/` HTML. The committed renders
were not regenerated and still show an assignee, which V0-19's must-pass counts as
a screen that shows one; that half is now **V0-41** in Wave 3, beside V0-37, which
needs the same missing pipeline.

## When a plan is done

1. Its must-pass checks are in the suite and green, and `npm run verify` passes.
2. Add a `## Outcome` section to the plan: what shipped, what you decided, what you
   found that was not in the plan.
3. Move the file to `docs/plans/completed/`.
4. Update the row in [the backlog](../../backlog/v0-backlog.md) and, if it retired
   one, [the release risks](../../release-risks.md).
