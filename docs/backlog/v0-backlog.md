---
title: "Revised v0 backlog"
product: LongClaw
status: active
milestone: "M4 — Pilot direction accepted (Step 10)"
sources:
  - mvp_plan_order.md
  - architecture-spike-risk-register.md
  - design/prototype/screen-specs.md
  - acceptance/pilot-build.md
---

# Revised v0 backlog

This is the Step 10 backlog: everything left between the vertical slice and the
MVP release, ranked, with a stated reason to exist for each item and a must-pass
verification for each one that protects data or trust.

Steps 11–15 in [the execution plan](../mvp_plan_order.md) name the work by
theme. This document is the ranked form of that work, and it is the list to
execute from. Where the two disagree, the plan describes intent and this file
describes order.

## What this backlog is ranked on, and what it is not ranked on yet

Step 10 exists to absorb pilot evidence. **The Step 9 pilot has not run.**
[`docs/pilot/sessions/`](../pilot/sessions/) holds no completed sessions, so no
part of this ranking is supported by observed user behaviour, and no findings
have been invented to stand in for it. What the ranking is built from instead:

| Source | What it justifies |
|---|---|
| [The spike risk register](../architecture-spike-risk-register.md) | Every Wave 0 item. These are recorded, open, code-level risks with named failure modes. |
| [The reported create-project bug](../plans/completed/project-key-derivation-bug.md) | One real onboarding failure, from one real session. Fixed in Step 10 before this ranking was written. |
| [Known pilot limitations](../acceptance/pilot-build.md) | Which absent features the build already admits to, and therefore which breadth a participant would hit first. |
| [The approved prototype and its specs](../design/prototype/) | What "complete" means for each surface, so no item is a fresh design decision. |
| The ADRs | Which plan items are superseded, so nothing is built twice or built wrong. |

Read the consequence honestly:

- **Wave 0 is evidence-backed.** Its items are open defects and named risks. They
  do not need the pilot to justify them, and they should be cleared regardless of
  what the pilot finds.
- **The order *within* Waves 1–3 is a pre-pilot baseline.** It is derived from
  dependency and from the plan's own acceptance criteria, not from watching a
  user. It is the weakest claim in this document and the part the pilot is
  expected to reshuffle.
- **Wave assignment itself should survive the pilot.** Pilot evidence can move an
  item earlier, add an item, or promote something from the deferred register. It
  should not be needed to justify an item that is already here.

The plan's guardrail still holds: *do not continue executing the original breadth
backlog after M3 until the pilot feedback in M4 has been processed.* So Wave 0 is
runnable now — it is blocker work, which Step 10 puts first by definition — and
Waves 1 onward wait for either the pilot evidence or an explicit founder decision
to proceed without it. [The pilot response memo](../pilot/response-memo.md) is
where that evidence lands and where this order gets revised.

## How to read an entry

| Column | Meaning |
|---|---|
| ID | Stable reference for this document only. **Not** a LongClaw ticket key — see § These are not tickets yet. |
| Why it exists | The user consequence or the risk. An item with neither does not belong in the MVP. |
| Must-pass | The check that has to pass before the item is called done. Release-blocking where marked. |
| Owner | The work area, following the risk register's convention. Not a person. |
| Pilot | `re-rank` — evidence may move it; `confirm` — evidence should confirm or kill the current design; `fixed` — position is risk-based and evidence does not move it. |

---

## Wave 0 — Clear before any more breadth

Every item here is a recorded risk of losing work, showing stale state, or
misattributing a change. They come before breadth because breadth built on top of
them is breadth that has to be re-verified afterwards, and because the pilot
measures exactly the trust they threaten.

| ID | Item | Step | Why it exists | Must-pass | Owner | Pilot |
|---|---|---|---|---|---|---|
| ~~V0-01~~ | ~~Close the atomic-replace race~~ **Done 2026-07-31** — `atomic_replace` swaps with `renamex_np(RENAME_SWAP)`, hashes the displaced bytes, restores them and returns a typed conflict on mismatch, and refuses the write where the volume cannot swap. [Plan 01](../plans/completed/01-atomic-replace-race.md) | 14 | — | Passed: driven-interleaving race test in `tests/storage_integration.rs`, confirmed failing against the previous `fs::rename` path | Storage | fixed |
| ~~V0-02~~ | ~~Detect a project-event sequence gap and recover by snapshot~~ **Done 2026-07-31** — a gap raises `reconciling`, `App` fetches exactly one snapshot, and the store resumes from the new `ProjectSnapshot.sequence` boundary. [Plan 02](../plans/completed/02-event-sequence-gap.md) | 14 | — | Passed: loss, reordering, convergence, project-switch, and failed-request tests in `state.test.ts` and `App.test.tsx`, confirmed failing against the previous `applyEvent` | Frontend | fixed |
| ~~V0-03~~ | ~~Validate the project prefix during rebuild and ingest; degrade a mismatch rather than indexing it~~ **Done 2026-07-31** — ownership is decided from the key's prefix in `read_ticket_file`, before the contents are parsed, so rebuild, ingest, detail, and the write refusal all inherit one rule. [Plan 04](../plans/completed/04-project-prefix-validation.md) | 14 | — | Passed: the `invalid-key-foreign-project-prefix` fixture, rename coverage in `tests/watcher_integration.rs`, and degrade/read/refuse/rebuild coverage in `tests/storage_integration.rs`, confirmed failing with the ownership rule removed | Format | fixed |
| V0-04 | Watcher recovery: `NSWorkspaceDidWakeNotification` behind `platform/macos`, overflow diagnostics, coalescing with focus recovery, and an explicit watcher-unavailable state | 14 | FSEvents drops history over sleep, wake, overflow, and removed roots, and macOS gives no `Resumed` callback while the window stays focused. A closed lid is an ordinary event on a laptop; today it can leave the app confidently wrong. | Done 2026-07-31. Watcher integration covers overflow, restored roots, coalescing, and unavailable reporting; a focused-window sleep/wake soak on macOS 26.5.2 confirmed edits appear without click, refresh, or restart | Platform | done |
| V0-05 | Move scans, parsing, and fsync onto bounded blocking workers; publish one snapshot back on the Tauri handle | 14 | A large synchronous rebuild blocks the command it runs on, and will block focus recovery and the future wake callback. It is also the difference between a slow project and a beachballed app. | A rebuild on a large project keeps commands responsive; webview state is never mutated off the main thread; the Step 4 load budget still passes | Platform | fixed |
| V0-06 | Virtualize board and list lanes, subscribe through selectors, and enforce an input-to-paint budget | 16 | The spike proved the data flow, not 5,000 rendered cards. The register asks for this *before* Phase 1 breadth, because the list surface in Wave 1 is the thing that renders them. | Done 2026-07-31 for the board. `npm run perf:board` traces 5,000 tickets in WebKit at 18 ms p95 keyboard, 22 ms p95 scroll, 20 ms p95 external write, against a ≤ 50 ms p95 budget. Lanes are windowed and cards memoized per ticket; the list surface lands on the same geometry under V0-14 | Frontend | done |
| ~~V0-07~~ | ~~Attribute a change from newly appended event IDs only~~ **Done 2026-07-31** — attribution rides on the `ticketChanged` event rather than the row, and comes only from records the file did not have before. [Plan 03](../plans/completed/03-attribution-from-new-records.md) | 14 | — | Passed: unit tests beside `core::attribution` plus record-less, appended, and rewritten-history watcher tests, confirmed failing against the newest-record rule. The round-trip scenario's § 4 walkthrough is still unwalked | Domain | fixed |

Step 10 also cleared one Wave 0 item before writing this list: the
[project-key create-form dead end](../plans/completed/project-key-derivation-bug.md),
reported from a real session, fixed with a shared grammar fixture and the two
create forms merged into one tested component.

---

## Wave 1 — The slice becomes a tracker

Step 11 work. The pilot build tells participants that priority, labels, the list
view, markdown preview, archive, and undo are all absent; this wave is that list.
Internal order is the pre-pilot baseline described above.

| ID | Item | Step | Why it exists | Must-pass | Owner | Pilot |
|---|---|---|---|---|---|---|
| V0-08 | Priority end-to-end: field, glyph, menu (`P`), and priority ordering within a column | 11 | Priority is the field that makes a board a plan rather than a list, and ADR 0003 makes it the default board order. Without it every column is arbitrary. | Priority round-trips to disk, orders columns per ADR 0003, and an agent-written priority is read without rewriting the field | Domain | re-rank |
| V0-09 | Board ordering control with Manual mode, rank allocation, and drag-and-drop | 11 | ADR 0003 makes ordering a view preference with two modes. Manual is how a human expresses a plan the priority enum cannot. | Drag is available only in Manual; `rank` is written only by manual reordering; Priority mode writes no rank; the ordering choice never rewrites files | Domain | re-rank |
| V0-10 | Project-scoped labels: definitions in `longclaw.yaml`, chips on cards and rows, label menu | 11 | Labels are the only grouping axis in v0 that the user defines, and the format already reserves them. Agents can already write label slugs. | Label slugs round-trip; a renamed label definition rewrites no ticket; an unknown slug on a ticket is preserved and rendered legibly | Domain | re-rank |
| V0-11 | Archive and unarchive, with the archived group in the list and `· archived` in search | 11 | ADR 0004 puts archival in v0: it is how a long-lived local project stays tidy without a destructive operation. Canceled is a workflow outcome, not tidying. | Archiving sets `archived_at` and never moves or deletes the ticket directory; archived tickets leave the board, stay findable, and unarchive cleanly | Domain | re-rank |
| V0-12 | Markdown write/preview editor with the common-formatting toolbar | 11 | The description is where a human hands context to an agent. The pilot build ships a plain textarea, so the primary authoring surface is the least finished one. | Round-trip of every markdown construct the format documents, with no reformatting of content the user did not touch | Frontend | confirm |
| V0-13 | Complete the merged timeline: human comments, agent comments, and change events with the approved attribution treatment | 11 | The merged record is the product thesis made visible. The slice shows it; Step 11 is where every event kind and the agent treatment are complete. | Every event kind renders with correct actor type and `via file edit` provenance; an agent is never rendered as an assignee (ADR 0001) | Frontend | confirm |
| V0-14 | The dense issue list surface, grouped by status | 11 | The board answers "what is in flight"; the list answers "what exists". It is also the archive surface (ADR 0004) and the only surface that shows Canceled reliably. | List and board agree after app edits, external edits, restart, and rebuild; the list renders inside the interaction budget with V0-06 in place | Frontend | re-rank |
| V0-15 | Sort, filter, and grouping behaviour from the prototype | 11 | Without filtering, a real repository's board becomes unusable at exactly the size where the product should start paying off. | Filter with no matches shows the designed state, not an empty board; sort and grouping are view state and never rewrite files | Frontend | re-rank |
| V0-16 | Full ticket create surface with every approved field | 11 | Quick create covers title, description, checklist, and status. A user planning real work needs priority and labels at creation, not as a second pass. | A ticket created with every field parses identically to the same ticket assembled by edits | Frontend | re-rank |
| V0-17 | Optimistic create, per-mutation write feedback, and undo | 11 | The build admits creation waits for the write and there is no undo. Both are trust surfaces: waiting reads as a hang, and no undo makes every edit feel irreversible on files the user cares about. | A tick appears before the write returns; a failed write reverts the optimistic state and says so; undo restores the previous file content through the ordinary write path | Frontend | re-rank |
| V0-18 | Preserve attachment registry records losslessly with no attachment UI | 11 | ADR 0005 ships the on-disk attachment format without UI. An agent may already register attachments, and the app must not drop what it does not render. | A ticket carrying attachment records survives every app mutation byte-identically in those records, including unsupported media types | Storage | fixed |
| V0-19 | Remove assignee from the prototype specs and the data requirements | 11 | ADR 0001 removed assignee from local mode, and its own consequences section says the Step 2 specs must be revised. A spec that still shows it will get built. | No spec, screen, or data requirement in `docs/design/` shows an assignee in local mode | Design | fixed |

---

## Wave 2 — Keyboard-first

Step 12 work. The plan calls a pointer-only tracker a failure of the product's
speed claim, and the palette is where several Wave 1 features become reachable
without hunting for a menu.

| ID | Item | Step | Why it exists | Must-pass | Owner | Pilot |
|---|---|---|---|---|---|---|
| V0-20 | `⌘K` palette shell and the approved root command set, with the Phase 2 terminal command present and disabled | 12 | The palette is the product's primary navigation claim and the cheapest path to every command once the commands exist. | Every root command in the screen spec runs against the correct project and focused ticket; the terminal row is visible, disabled, and tagged `PHASE 2` | Frontend | re-rank |
| V0-21 | Palette sub-modes for status, priority, ordering, theme, project, and search | 12 | A flat command list cannot express "change status to…" without a second surface, and `Esc` stepping back rather than out is the behaviour the spec defines. | Sub-modes show the crumb, `Esc` steps back to root, and a command with no target is disabled with an inline explanation rather than failing | Frontend | re-rank |
| V0-22 | Single-key actions on the focused ticket | 12 | The speed claim is about the keys a user presses most, not the palette they open occasionally. | Every single-key action in the keyboard map acts on the focused ticket and on nothing else | Frontend | re-rank |
| V0-23 | Arrow and `j`/`k` navigation, predictable focus return, and the escape contract | 12 | Focus lost behind a panel or modal is the failure mode that makes keyboard support unusable in practice. | Automated focus tests for the critical flows: focus is never lost behind the panel, a modal, a menu, or the palette, and returns where the map says | Frontend | re-rank |
| V0-24 | Search UI over the existing index, with empty and no-result states | 12 | The backend already searches; without a surface the user cannot find a ticket they cannot see, which is the normal case in a real repository. | Search matches keys, titles, labels, and descriptions inside the Step 4 budget; no-result and empty states match the spec | Frontend | re-rank |
| V0-25 | Shortcut reference | 12 | A keyboard-first product that never states its keys is keyboard-first only for the person who wrote it. | Every shortcut the app implements appears in the reference, and nothing appears that is not implemented | Design | re-rank |

---

## Wave 3 — Recovery, then theme completeness

The rest of Step 14 plus Step 13. These sit after breadth because each one
handles a failure the app already surfaces safely in its worst case, unlike the
Wave 0 items, which fail silently.

| ID | Item | Step | Why it exists | Must-pass | Owner | Pilot |
|---|---|---|---|---|---|---|
| V0-26 | Unsupported and newer schema versions as a first-class read-only state | 14 | A future build's file must be legible and untouched, not broken. The parser already refuses to write it; the UI has to explain it. | A newer-version ticket is read-only, explains itself, is never rewritten, and does not block the rest of the project | Frontend | re-rank |
| V0-27 | Partially written files: debounce, stability check, retry on later events | 14 | Editors and agents expose partial content mid-write. Treating a truncated file as corrupt trains users to distrust the app for something that resolves in a second. | Truncated-write fixtures resolve to the final content without a permanent degraded row and without rewriting the file | Storage | re-rank |
| V0-28 | Deleted or renamed ticket while it is open | 14 | The panel currently has a ticket that no longer exists. Where it goes and what happens to unsaved edits has to be decided, not discovered. | An unsaved draft is never lost silently; the panel states what happened and offers a next action | Frontend | re-rank |
| V0-29 | Permission and disk-write failures as actionable, typed states | 14 | A read-only folder or a full disk is ordinary. ADR 0010 already gives the shape; the surfaces have to use it instead of showing `internal`. | Every write failure path reports a typed, recoverable error naming the file, and the file is left as it was | Frontend | re-rank |
| V0-30 | Corrupt or deleted index recovery; idempotent rebuild | 14 | The index is disposable by design, and that promise is only real if losing it is a non-event. | Deleting or corrupting the index and reopening produces the same visible state; rebuild is idempotent and safe to repeat | Index | fixed |
| V0-31 | A recoverable copy of the project registry before any registry schema change | 14 | Registry corruption strands every known project path. Parsing already fails closed and never auto-resets; recovery is the missing half. | A corrupt registry never auto-resets, and a documented recovery restores known projects without editing app internals | Persistence | re-rank |
| V0-32 | Clean up after an I/O failure during project creation | 14 | Step 10's validate-first fix stops the reported dead end, but an I/O failure between `create_dir_all` and the write still leaves a partial `.longclaw/` in the user's repository. Residue in a real repository works directly against the trust the product is asking for. | A creation that fails after the directory exists leaves the chosen folder as it was, or names exactly what it left and why | Storage | fixed |
| V0-33 | Fault-injection and concurrency test suite | 14 | Every Wave 0 and Wave 3 item above needs a harness to be verified under stress rather than argued about. Rapid external edits and concurrent app/external edits are the two cases the register keeps naming. | Rapid-edit and concurrent-edit stress runs pass repeatedly; every fault-injection case has a stated expected outcome | Storage | fixed |
| V0-34 | Apply every token to every production component and state; add a regression check for hardcoded accents and missing theme values | 13 | The foundations exist and the shell uses them; Step 13 is where the rest of the app stops carrying literal colors. A check is what keeps it that way. | A build fails on a hardcoded accent or a missing theme value; every component renders from tokens in all four presets | Design | fixed |
| V0-35 | System-matched appearance plus explicit light/dark override, persisted | 13 | The app already has an appearance control; matching the system is the default a macOS user expects, and the preference has to survive a restart. | Appearance follows the system until overridden, persists across restart, and never changes layout | Frontend | re-rank |
| V0-36 | Instant per-project theme selection at creation, in settings, and from the palette | 13 | Theme is the project's identity in a multi-project sidebar, and the design specifies an instant accent crossfade with no layout movement. | Changing theme crossfades accent surfaces only, moves no layout, and persists to the location the format specifies | Frontend | re-rank |
| V0-37 | Visual regression matrix: every preset × light and dark on the core screens | 13 | Four presets across two appearances over board, list, panel, menus, dialogs, errors, timeline, and external-update states is more than a human re-checks reliably. | The matrix runs in CI and fails on a contrast or actor-distinction regression | Design | fixed |
| V0-40 | Scope Dependabot to what actually ships, so its alert list means something | 14 | [Triage](../plans/completed/08-dependabot-triage.md) found all three standing advisories unreachable — two are Linux-only Rust code never compiled for a macOS-only app, one is a `devDependencies` linter transitive. None will clear on its own: the Rust pair needs a Tauri bump the register makes expensive, and the npm one needs a breaking ESLint major. A permanently non-empty alert list is one nobody reads, which is how a genuinely reachable advisory gets missed. The archived `spikes/` prototype ships nothing and still reports alerts indistinguishable from the real app's. | Every open alert on the default branch is either resolved or carries a recorded reachability decision; an archived spike generates none; a newly introduced *reachable* advisory is visibly distinguishable from the standing set | Platform | fixed |

---

## Wave 4 — Conditional

| ID | Item | Step | Why it exists | Must-pass | Owner | Pilot |
|---|---|---|---|---|---|---|
| V0-38 | Decide the waitlist endpoint and privacy handling, or decide to omit the waitlist | 15 | The plan's own instruction: if no reviewed endpoint exists, omit the feature from the binary rather than ship a form that silently fails. This is a decision, not an implementation. | A recorded decision naming the endpoint and the data collected, or a recorded decision to omit | Release | fixed |
| V0-39 | Waitlist UI, consent copy, success, offline, and error states | 15 | Only if V0-38 lands with an endpoint. Interest in the paid layer is worth measuring; a broken form is not. | Signup is optional and quiet, gates no local feature, introduces no telemetry, and a failure never touches local projects | Frontend | confirm |

---

## Deferred register

The scope gate. Everything here is out of the MVP **until** an entry in
[the pilot response memo](../pilot/response-memo.md) moves it, with evidence, a
must-pass verification, and a named acceptance change. Nothing enters the MVP
backlog by accumulating enthusiasm.

| Request | Decision | Reason |
|---|---|---|
| Attachment upload, gallery, and preview UI | Useful after MVP | ADR 0005: the on-disk format ships in v1 so adding the UI later is not a migration. |
| User-defined, renamable, recolorable statuses | Useful after MVP | ADR 0002: v0 ships the fixed set; the format needs no status registry, which keeps the agent contract smaller. |
| Assignees, the people registry, and identity UI | Phase 3 | ADR 0001: assignment expresses accountability between team members, and a local project has one human. |
| Ticket deletion | Rejected for v0 | ADR 0004: archival covers tidying without introducing a destructive operation. |
| Custom theme colors or a theme builder | Rejected | Vision guardrail: fixed presets only, no custom-color affordance anywhere. |
| Embedded terminal, PTY, ticket-linked sessions | Phase 2 | Plan guardrail. v0 reserves the collapsed geometry and a typed streaming path, nothing more. |
| Cloud sync, teams, accounts, billing | Phase 3 | Plan guardrail. The waitlist (V0-38/39) measures interest without building any of it. |
| Comprehensive canonical conformance-fixture corpus | Post-MVP product v1 | Step 3 records this deferral; focused real-file compatibility tests cover the v0 contract. |
| CLI or JSON projection of the ticket store | Useful after MVP, with one caveat | Step 3 left it optional and told us not to let it delay the file round trip, which it did not. The caveat is below. |

### The CLI caveat, recorded rather than resolved

This repository cannot file its own tickets. The issue-tracker rules forbid an
agent minting a ticket key, and there is no creation surface outside the app's
GUI, so a real defect found while building LongClaw gets written to
[`docs/plans/`](../plans/) instead of into `.longclaw/`. That is why the
create-project bug arrived as a Markdown file, and it is why this backlog is a
document rather than 39 tickets.

That is real evidence for a creation surface, but it is evidence about *our*
workflow, not the pilot user's. It stays deferred. If the founder wants LongClaw
tracked in LongClaw before the MVP ships, that is a scope decision to record in
the memo, not a gap to quietly fill here.

---

## These are not tickets yet

`V0-01`-style IDs are references inside this document. They are deliberately not
LongClaw ticket keys: [the issue-tracker rules](../agents/issue-tracker.md) give
key allocation to LongClaw, and an agent must not mint one or create
`.longclaw/tickets/<KEY>/` directly.

When this backlog is imported into a LongClaw project, create one ticket per row
through the app, put the "Why it exists" text in the description, put the
must-pass verification in the checklist, and keep the `V0-nn` reference in the
body so this document and the tickets can be reconciled once.

## Vision changes proposed by this backlog

None. Every item here implements something already approved in the vision, the
design brief, the prototype, or an ADR. Anything that would change the product's
boundaries belongs in the memo's vision register, not in this file.
