---
title: "LongClaw — MVP Execution Plan"
product: LongClaw
status: proposed
scope: "Phase 0 foundations and Phase 1 local-core MVP"
sources:
  - vision.md
  - design_brief.md
---

# LongClaw — MVP Execution Plan

This document turns the canonical vision and design brief into an ordered build plan. It covers **Phase 0 foundations** and **Phase 1 v0: Local core**, which is the MVP boundary.

The ordering is intentional:

1. Settle the experience before encoding it.
2. Settle the on-disk contract before building around it.
3. Prove the architecture before scaling implementation.
4. Ship the smallest real human-to-agent round-trip before building breadth.
5. Use pilot feedback to reshape the remaining backlog.

## MVP finish line

The MVP is complete when a macOS user can:

- Launch LongClaw without creating an account or enabling telemetry.
- Open or create a local project by selecting a folder.
- Choose a fixed project theme and use the app in light or dark appearance.
- Create, view, edit, organize, search, and navigate tickets through the board, issue list, ticket panel, and command palette.
- See ticket data stored as portable, human-readable files in the selected folder.
- Let an external agent read and update those files, then see the board and ticket update without a manual refresh.
- Distinguish agent activity from human activity and review the resulting description, checklist, status, comment, and activity changes.
- Recover safely from missing folders, invalid files, and concurrent external edits without silent data loss.
- Install and run a signed or otherwise pilot-ready macOS build that has passed the release checks in this plan.

The MVP is **not** complete merely because the screens work with mock data. The file round-trip with a real external agent is the core product proof.

## Scope guardrails

The following stay outside this plan:

- Embedded terminals, PTY integration, and ticket-linked terminal sessions. The shell only reserves room for the Phase 2 terminal panel.
- Cloud sync, accounts beyond the optional waitlist, teams, billing, and team navigation stubs.
- Custom theme colors or a theme builder.
- Windows, Linux, web, or mobile clients.
- Git hosting, code review, chat, integrations, and automations.

## Milestones and gates

| Milestone | Reached after | Gate |
|---|---|---|
| M0 — Experience approved | Steps 1–2 | Founder approves the design system, proposed product choices, screens, states, and handoff bundle. |
| M1 — Data contract approved | Step 3 | The file format is documented, fixture-backed, agent-readable, versioned, and reviewed by a human. |
| M2 — Architecture proven | Step 4 | The Tauri spike proves the riskiest filesystem, watcher, index, and IPC paths on macOS. |
| M3 — Vertical slice ready | Steps 5–8 | One real project and ticket complete a human → disk → agent → disk → UI round-trip. |
| M4 — Pilot direction accepted | Steps 9–10 | Target users have tried the slice and the remaining backlog has been explicitly revised. |
| M5 — Feature-complete v0 | Steps 11–15 | All in-scope workflows and trust states work against real files. |
| M6 — MVP release | Steps 16–17 | Release quality, packaging, documentation, and final acceptance checks pass. |

Do not start mass feature implementation before M2. Do not continue executing the original breadth backlog after M3 until the pilot feedback in M4 has been processed.

---

## Phase 0 — Foundations

Phase 0 is deliberately human-led. Its purpose is to remove expensive ambiguity before implementation fans out.

### Step 1 — Finalize the design system and project themes

**Goal:** Turn the approved Linear-family direction into implementation-ready visual foundations.

**Work:**

- Start from the final approved design direction, not the historical appendices.
- Define typography, spacing, radii, elevation, borders, motion, icons/glyph geometry, system colors, and interaction states.
- Route all human and agent accent usage through theme tokens. Components must not contain hardcoded accent hues.
- Define the fixed theme set: Indigo, Clay, and 2–3 additional proposals.
- Define light and dark values for every preset while keeping neutral, status, warning, error, and label colors theme-independent.
- Test WCAG AA contrast and human/agent distinction, including common color-vision deficiencies.
- Resolve the items marked **[proposed]** that affect implementation:
  - final theme count and colors;
  - whether the agent accent stays in the same green family across themes;
  - status and priority sets and their glyphs;
  - shortcut set;
  - project theme marker in the side panel.
- Produce the owl mark only as an original abstract/geometric design, with no close likeness to the protected character.

**Deliverables:**

- Design-token source covering system tokens and all theme presets.
- Component foundations and interaction-state specifications.
- Decision log for all accepted or rejected proposed choices.
- Accessibility/contrast results.

**Expected outcome / exit gate:**

- A board renders correctly in at least two project themes × two appearances.
- Switching a project theme changes tokens only; it does not change component layout or require component-specific color overrides.
- Human and agent activity remain visually distinct in every tested theme.
- The founder approves the token system and fixed preset set.

### Step 2 — Complete the v0 prototype and handoff bundle

**Goal:** Settle the full MVP experience before the storage model and production UI are built.

**Work:**

- Design the app shell, with only Local and Starred populated in v0.
- Reserve the collapsed/expanded geometry for the future bottom terminal region without designing or building its interior.
- Design:
  - first launch and project creation;
  - project settings and theme selection;
  - board;
  - issue list;
  - ticket panel;
  - markdown description editing;
  - first-class checklists;
  - merged comments/activity timeline;
  - command palette;
  - quiet waitlist signup;
  - light and dark appearance.
- Cover quick ticket creation and full ticket creation.
- Prototype the real agent round-trip moment: external update, card acknowledgement, checklist update, agent comment/activity, and human review.
- Design all trust states:
  - no projects;
  - empty project;
  - missing or moved folder;
  - unparseable ticket file;
  - external edit while the same ticket is being edited in-app.
- Specify keyboard paths, focus states, optimistic states, and meaningful motion of roughly 150 ms or less.
- Spot-check key screens in Clay after completing them in the default Indigo theme.

**Deliverables:**

- Reviewed end-to-end prototype.
- Component and layout specifications.
- Keyboard/focus map.
- Empty, loading, error, conflict, and external-update state specifications.
- Exported handoff bundle committed beside the product documents.

**Expected outcome / exit gate:**

- Every MVP flow can be demonstrated without inventing missing screens or states during implementation.
- The prototype visibly communicates the folder-on-disk model and keeps first launch to a sub-one-minute interaction path.
- The data needed by every screen and activity state is identifiable.
- The founder signs off on the experience and handoff bundle before the file format is finalized.

### Step 3 — Specify the on-disk file format and data model

**Goal:** Create the durable, agent-first contract that serves as the source of truth for both the app and external agents.

**Approved foundation:** [On-Disk File Format & Data Model](file_format.md). Complete the fixtures, compatibility tests, and editing guide below before closing the M1 gate.

**Work:**

- Use the reviewed screens from Step 2 to enumerate all required entities, fields, relationships, and activity events.
- Decide and document:
  - project folder layout and project metadata/config location;
  - where the selected project theme is stored;
  - ticket filename and stable ID rules;
  - schema versioning and future migration rules;
  - status, priority, labels, human assignee, timestamps, and ordering;
  - description and first-class checklist representation;
  - human comments, agent comments, and change/activity attribution;
  - how an actor is identified as a human or agent without allowing an agent assignee;
  - create/update semantics for both the app and external tools;
  - deletion, cancellation, and archival semantics;
  - unknown-field preservation and forward compatibility;
  - atomic-write expectations;
  - invalid/partial file behavior;
  - external-edit and conflict detection inputs;
  - index rebuild rules and the fact that the index is disposable, not authoritative.
- Keep the representation readable in ordinary editors and easy for an LLM to change reliably.
- Avoid a monolithic shared file or other choices that make future git merges unnecessarily conflict-prone.
- Define a minimal agent-facing instruction contract with examples of safe reads and mutations.
- Decide whether a CLI/JSON projection is required for v0 or should remain a later enhancement. Do not let an optional CLI delay the direct file round-trip.

**Deliverables:**

- Versioned file-format and data-model specification.
- Canonical example project containing representative tickets and activity.
- Valid, invalid, partially written, unknown-field, and version-mismatch fixtures.
- Round-trip invariants and compatibility policy.
- Agent editing guide with before/after examples.

**Expected outcome / exit gate:**

- Two independent implementations could parse and write the same project without guessing.
- Every field and state in the approved prototype maps to the on-disk contract.
- App writes can be parsed by an external agent, and conforming agent writes can be parsed by the app.
- Invalid content is surfaced without being silently discarded or rewritten.
- A human review explicitly approves the format before storage implementation begins.

### Step 4 — Run and review the Tauri v2 architecture spike

**Goal:** Prove the high-risk technical paths on macOS and establish a small architecture that Phase 1 can extend.

**Work:**

- Establish the Tauri v2 project structure and trust boundaries.
- Choose and record frontend state management, Rust domain boundaries, IPC conventions, and error representation.
- Prove, with real files:
  - native folder selection and persisted project references;
  - scoped filesystem permissions;
  - parsing and atomic writes;
  - filesystem watcher event delivery;
  - watcher debouncing/coalescing and self-write suppression;
  - disposable local indexing and full rebuild;
  - propagation from disk → Rust → IPC → visible UI state;
  - propagation from UI → IPC → disk → watcher/index without loops.
- Establish performance budgets for app startup, project load, large-board interaction, search, and external-change visibility.
- Leave a typed streaming/event path that can later carry PTY output, without implementing the terminal.
- Exercise app sleep/wake, folder removal, rapid successive edits, and rename/write patterns used by common editors.
- Record rejected approaches and their failure modes.

**Deliverables:**

- Working spike using the approved format and representative fixtures.
- Architecture decision records for state, IPC, watcher/index behavior, persistence, and error handling.
- Risk register with mitigations.
- Recommended production project structure.

**Expected outcome / exit gate:**

- A real external file edit reaches a visible Tauri UI state reliably.
- An in-app edit reaches disk atomically without creating a watcher loop or duplicate activity.
- The local index can be deleted and rebuilt entirely from project files.
- The architecture has a credible extension point for Phase 2 PTY streaming.
- Human review accepts the spike before broad implementation begins.

---

## Phase 1 — v0 Local Core

### Step 5 — Create the production foundation

**Goal:** Convert the reviewed spike into a maintainable, reproducible application base.

**Work:**

- Scaffold the production Tauri v2 macOS application using the approved architecture.
- Add the MPL 2.0 license and basic open-source repository documentation.
- Establish formatting, linting, unit tests, integration tests, build checks, and CI.
- Add typed error/result boundaries and structured local diagnostics that do not transmit telemetry.
- Implement the shell layout and design-token pipeline.
- Add fixture loading for development and visual review without coupling production behavior to mock data.

**Deliverables:**

- Reproducible development and production builds.
- Automated quality checks.
- Token-driven shell in light and dark appearance.
- Contributor setup instructions.

**Expected outcome / exit gate:**

- A clean checkout can be built, tested, and launched using documented commands.
- CI rejects formatting, type, lint, test, or build failures.
- No account, network dependency, analytics, or telemetry is required for local use.

### Step 6 — Implement the storage engine, index, and watcher

**Goal:** Make project files the reliable source of truth.

**Work:**

- Implement schema-aware parsing, validation, serialization, and atomic writes.
- Preserve supported unknown fields according to the format contract.
- Implement project scanning and a disposable local index.
- Implement file watching with debounce/coalescing, self-write suppression, rename handling, and index updates.
- Represent malformed files as degraded records containing raw-content access and parse diagnostics.
- Add conflict/version detection inputs for files being edited in-app.
- Add contract tests from every Step 3 fixture.
- Add integration tests for app write → disk → reload and external write → watcher → index.

**Deliverables:**

- Storage/domain library.
- Local index and rebuild operation.
- Watcher pipeline.
- Contract and integration test suites.

**Expected outcome / exit gate:**

- Valid projects round-trip without data loss or unstable formatting.
- Restarting or rebuilding the index produces the same visible domain state.
- External changes appear without manual refresh and without duplicate application of self-authored changes.
- Invalid files remain untouched and visible with actionable diagnostics.

### Step 7 — Build first launch, local projects, and the app shell

**Goal:** Let a user reach an empty local project quickly and understand where its data lives.

**Work:**

- Implement Welcome → Open folder / Create project → native folder picker → preset theme → empty board.
- Keep Indigo preselected so theme choice never blocks onboarding.
- Show the selected filesystem path clearly.
- Maintain the local project registry and Starred state as app state.
- Implement the Local and Starred side-panel sections only; do not add Teams/cloud placeholders.
- Implement project switching, project settings, theme change, locate-folder, and remove-from-app actions.
- Never delete project files when removing a project reference from the app.
- Handle moved, missing, inaccessible, empty, existing, and invalid project folders.

**Deliverables:**

- Complete first-launch flow.
- Local project registry and navigation shell.
- Project creation/opening/settings flows.
- Empty and unreachable project states.

**Expected outcome / exit gate:**

- A new user can reach an empty board in under a minute without an account.
- Reopening the app restores known projects, stars, and appearance preferences.
- Missing projects remain listed as unreachable and can be relocated or removed safely.
- The project folder and source-of-truth model are evident in the interface.

### Step 8 — Deliver the minimum real vertical slice

**Goal:** Prove the central product thesis before building the complete tracker.

**Work:**

- Support one local project with a functional status board.
- Add the minimum ticket creation and editing path needed to define a title, description, checklist, and status.
- Persist every mutation using the real Step 3 file format and Step 6 storage path.
- Open the ticket in a minimal panel and show checklist/activity changes.
- Use a real external agent such as Claude Code or Cursor to:
  1. discover the project instructions and ticket;
  2. read the ticket context;
  3. update the description or status;
  4. check off a checklist item;
  5. add an agent-attributed comment/activity record.
- Ingest those changes through the real watcher and display a designed agent-update acknowledgement.
- Record the demo as a repeatable acceptance scenario, not a one-off manual trick.

**Deliverables:**

- End-to-end board and ticket slice.
- Example agent instruction/context files required for reliable execution.
- Automated storage/watcher coverage plus a repeatable manual real-agent test.
- Pilot-ready macOS build.

**Expected outcome / exit gate:**

- A human creates a ticket in the UI, sees the correct file on disk, lets a real external agent update it, and sees the changes return to the UI without refresh or manual reconciliation.
- Agent activity is visually distinct and never turns the agent into the human assignee.
- The same flow succeeds after an app restart and after an index rebuild.
- This milestone is shown to target users before the remaining feature backlog is executed.

### Step 9 — Run the mandatory mid-v0 pilot

**Goal:** Test whether the vertical slice solves the planning/execution split for the intended users.

**Work:**

- Recruit a small set of active Claude Code and/or Cursor users, including solo builders and small-team members where possible.
- Give them the build and ask them to use it with a real repository and real ticket.
- Observe rather than over-script:
  - folder/project setup;
  - comprehension of the file model;
  - ticket authoring;
  - agent discovery and mutation;
  - recognition and trust of incoming agent changes;
  - recovery when something goes wrong.
- Capture task success, blockers, data-loss fears, confusion, repeated manual work, and feature requests.
- Separate failures of the core thesis from missing breadth or polish.

**Deliverables:**

- Pilot notes linked to observed sessions.
- Ranked problem list with severity and frequency.
- Evidence summary for the agent round-trip and onboarding flows.

**Expected outcome / exit gate:**

- The team knows whether users can complete and trust the core round-trip without developer intervention.
- Critical workflow and data-integrity failures are identified before more UI breadth is built.
- There is enough evidence to revise the remaining plan rather than relying on internal preference.

### Step 10 — Re-plan the remaining v0 backlog

**Goal:** Absorb pilot evidence into execution while keeping the product vision stable.

**Work:**

- Fix any data-loss, parse, watcher, onboarding, or agent-discovery blocker first.
- Re-rank Steps 11–15 by observed user value and risk.
- Split feedback into:
  - required for MVP;
  - useful after MVP;
  - Phase 2/3;
  - rejected or inconsistent with the vision.
- Update acceptance criteria where pilot evidence showed that the original criterion was insufficient.
- Record any proposed change to the vision separately; do not silently expand MVP scope.

**Deliverables:**

- Revised, prioritized ticket backlog.
- Pilot response memo mapping evidence → decision.
- Updated release risks and acceptance tests.

**Expected outcome / exit gate:**

- Every remaining MVP ticket has a user- or risk-based reason to exist.
- Critical pilot failures have an owner and must-pass verification.
- Deferred requests cannot leak into the MVP backlog without an explicit scope decision.

### Step 11 — Complete the ticket domain and primary surfaces

**Goal:** Turn the validated slice into a complete local issue-tracking workflow.

**Work:**

- Complete the ticket fields approved in Phase 0:
  - stable ID;
  - title;
  - markdown description;
  - first-class checklist and progress;
  - status;
  - priority;
  - human assignee;
  - project-scoped labels;
  - timestamps.
- Implement full create, read, update, and any approved cancel/archive behavior.
- Complete the board, dense issue list, and ticket side panel against real data.
- Implement the GitHub/Trello-style markdown write/preview editor and common-formatting toolbar.
- Implement the merged timeline for human comments, agent comments, and change events.
- Show agent description edits and checklist/status changes with the approved attribution treatment.
- Add sort, filter, and grouping behavior defined by the prototype.

**Deliverables:**

- Feature-complete ticket domain.
- Board, list, and ticket panel backed only by the storage engine.
- Timeline and markdown/checklist editing.
- Domain and end-to-end tests for all ticket mutations.

**Expected outcome / exit gate:**

- A user can manage the full lifecycle of a ticket without editing files manually.
- An agent can make every permitted contribution through the documented file contract.
- All three primary surfaces show consistent state after app edits, external edits, restarts, and index rebuilds.
- Agents can contribute but cannot be selected or represented as assignees.

### Step 12 — Add keyboard-first navigation, command palette, and search

**Goal:** Reach the speed and navigability expected of the product rather than shipping a pointer-only tracker.

**Work:**

- Implement `Cmd+K` and the approved command set:
  - create ticket;
  - go to project;
  - change status;
  - assign;
  - search tickets;
  - star project;
  - toggle appearance;
  - change project theme.
- Reserve but do not expose or implement the Phase 2 terminal command.
- Implement approved single-key actions on focused tickets.
- Add arrow and/or j/k navigation, predictable focus return, escape behavior, and visible focus states.
- Ensure every pointer action in the core workflow has a keyboard path.
- Implement indexed ticket search with clear empty/no-result behavior.

**Deliverables:**

- Command palette and search.
- Keyboard navigation system and shortcut reference.
- Automated keyboard/focus tests for critical flows.

**Expected outcome / exit gate:**

- A user can create, find, open, update, and navigate tickets without leaving the keyboard.
- Commands operate on the correct project and focused ticket with no ambiguous context.
- Focus is never lost behind the ticket panel, modal, menu, or command palette.

### Step 13 — Finish themes, appearance, and project-level preferences

**Goal:** Make project identity and light/dark appearance complete across the real application.

**Work:**

- Apply every system and theme token to every production component and state.
- Implement system-matched appearance plus explicit light/dark override.
- Implement instant per-project theme selection at creation, settings, and the command palette.
- Persist theme location according to the Step 3 decision.
- Validate all presets across board, list, panel, menus, dialogs, errors, timeline, and external-update states.
- Add regression checks that detect hardcoded accent colors or missing theme values.

**Deliverables:**

- Complete fixed-preset theme implementation.
- Appearance preference behavior.
- Visual regression matrix covering themes × appearances on core screens.

**Expected outcome / exit gate:**

- Changing project theme causes a soft accent transition and no layout movement.
- All themes meet the approved contrast and actor-distinction criteria in light and dark appearance.
- No custom-color affordance or hardcoded component accent exists.

### Step 14 — Complete trust, conflict, and recovery behavior

**Goal:** Make direct file editing feel safe enough to rely on.

**Work:**

- Implement the designed behavior for:
  - unparseable ticket files;
  - unsupported/newer schema versions;
  - partially written files;
  - external changes while editing;
  - deleted or renamed tickets;
  - missing/moved project folders;
  - permission and disk-write failures;
  - watcher overflow or missed-event recovery;
  - corrupt or deleted local index.
- Provide reload / keep mine or the approved conflict choices without silently choosing for the user.
- Show raw invalid content and useful parse location/details.
- Ensure retry and index rebuild are safe and idempotent.
- Stress-test rapid external edits and concurrent app/external edits.

**Deliverables:**

- Full degraded/error/conflict state implementation.
- Recovery operations and diagnostic messages.
- Fault-injection and concurrency test suite.

**Expected outcome / exit gate:**

- The app never silently deletes, overwrites, or “repairs” content it cannot safely understand.
- A user can recover from every known failure without editing app-internal state.
- Index loss never causes project data loss.
- Concurrent changes produce an explicit, understandable resolution path.

### Step 15 — Add the optional sync-waitlist signup

**Goal:** Measure interest in the paid collaboration layer without putting an account wall in front of the local product.

**Work:**

- Implement the quiet side-panel signup entry and modal from the approved design.
- Show the value proposition for early access to cloud sync and teams.
- Collect only the approved minimum information, with clear consent and failure states.
- If a network-backed submission endpoint is not ready or approved, omit this step from the binary rather than shipping a misleading form.
- After success, replace the call to action with the subtle confirmed state.

**Deliverables:**

- Waitlist UI and, if available, reviewed submission integration.
- Privacy copy, consent behavior, success, offline, and error states.

**Expected outcome / exit gate:**

- Signup remains optional, quiet, and unrelated to local feature access.
- Failure or offline state never interferes with local projects.
- No telemetry or broader account system is introduced through the waitlist.

### Step 16 — Polish, performance, accessibility, and release hardening

**Goal:** Meet the Linear-grade quality bar on supported macOS hardware and realistic projects.

**Work:**

- Measure and tune against the Step 4 budgets for startup, folder open, index build, board/list interaction, search, and external-change visibility.
- Test representative small, medium, and large local projects.
- Audit keyboard access, focus order, labels, screen-reader semantics, contrast, reduced motion, and zoom/text scaling.
- Verify meaningful motion remains short and does not mask state.
- Test fresh install, upgrade, app restart, sleep/wake, folder moves, and offline operation.
- Audit the binary and runtime for accidental telemetry, unnecessary network calls, and overbroad filesystem permissions.
- Complete macOS icon, metadata, packaging, signing/notarization strategy, and crash-diagnostic guidance.
- Write user documentation for project folders, file format, backups/version control, agent use, and recovery.

**Deliverables:**

- Release-candidate build.
- Performance and accessibility reports.
- Security/privacy and filesystem-permission checklist.
- User and agent documentation.
- Known-issues list with severity and workarounds.

**Expected outcome / exit gate:**

- The release candidate is fast, keyboard-usable, accessible, and stable against realistic project sizes.
- It works locally without an account or network connection.
- Filesystem access is limited to the user-selected project scope and required app state.
- No release-blocking data-integrity, privacy, onboarding, or core-round-trip defect remains.

### Step 17 — Run final MVP acceptance and release

**Goal:** Confirm the build meets the product thesis and release it as the local-core MVP.

**Work:**

- Run the full acceptance scenario on a clean macOS machine:
  1. install and launch;
  2. create/open a folder project;
  3. select a theme;
  4. create and enrich a ticket;
  5. navigate it through board, list, panel, search, and palette;
  6. edit it with a real external agent;
  7. observe and review the agent update;
  8. restart and rebuild the index;
  9. exercise invalid-file and concurrent-edit recovery;
  10. confirm local work remains available offline and without an account.
- Re-run automated tests and the theme/appearance visual matrix against the exact release build.
- Verify documentation and example agent instructions against a clean project.
- Publish release notes that state the local-only boundary and explicitly separate Phase 2 terminals and Phase 3 sync/teams.

**Deliverables:**

- Released MVP build and source.
- Final acceptance record.
- Release notes and known limitations.
- Prioritized post-MVP backlog.

**Expected outcome / exit gate:**

- The complete human-plan / agent-execute / shared-ticket-record loop works on the released artifact.
- Project files remain portable, readable, and authoritative.
- Users can trust failures to be visible and non-destructive.
- The release contains no terminal, sync, team, billing, custom-theme, or cross-platform scope leakage.

---

## Quality strategy across the plan

Testing should follow the architecture rather than being postponed to Step 16:

| Layer | Required proof |
|---|---|
| File contract | Fixture and property/round-trip tests for valid, invalid, partial, unknown-field, and versioned files. |
| Storage/index | Atomic-write tests, full rebuild equivalence, self-write suppression, rapid-edit and rename tests. |
| IPC/domain | Typed contract tests for commands, events, failures, and stale/conflict inputs. |
| UI components | Interaction, keyboard, focus, accessibility, and token/theme tests. |
| End-to-end | First launch, ticket lifecycle, app restart, external-agent round-trip, conflict recovery, and missing-folder flows. |
| Visual | Board and key screens across at least Indigo and Clay, then the complete preset × appearance regression matrix before release. |
| Manual macOS | Clean install, folder permissions, sleep/wake, editor/agent file-write patterns, offline use, signing/package behavior. |

Any test that reveals a file-integrity failure, silent overwrite, watcher loop, incorrect actor attribution, or account/network dependency for local use is release-blocking.

## Required decisions, placed at the correct gates

These are unresolved or explicitly proposed in the source documents. They should be decided once at the named gate rather than rediscovered during implementation.

| Decision | Resolve by | Why it blocks |
|---|---|---|
| Final fixed theme presets and agent-accent policy | Step 1 | Required for tokens, contrast validation, and theme storage examples. |
| Status, priority, glyph, and keyboard defaults | Step 2 | Required for the final prototype and domain enum choices. |
| Local human/assignee identity representation | Step 3 | Tickets require human accountability even though v0 has no accounts or teams. |
| Theme storage location | Step 3 | Determines project portability and project-config parsing. |
| Comment/activity representation and actor attribution | Step 3 | Required for the core human/agent shared record. |
| Conflict and unknown-field preservation rules | Step 3 | Required to prevent destructive app/external edit behavior. |
| Index technology and rebuild/performance budgets | Step 4 | Determines implementation structure but must not change the source-of-truth contract. |
| Waitlist collection endpoint and privacy handling | Before Step 15 | The waitlist must not become an accidental account or telemetry system. |

## Post-MVP handoff

After M6, the next product phase is **Phase 2: Integrated execution**:

- embedded xterm.js terminal backed by a real Rust PTY;
- multiple terminal tabs;
- terminal ↔ ticket linkage held in app state only;
- launching agent work for a ticket with context read from disk.

Only after Phase 2 should **Phase 3: Sync & teams** begin. Before any sync implementation, resolve the parked “tickets in git vs. `.gitignore` for real-time sync” question because it determines the collaboration architecture.
