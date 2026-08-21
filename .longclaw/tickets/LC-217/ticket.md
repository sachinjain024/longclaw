---
format: longclaw.ticket/v1
id: 50b39ead-8cb4-4622-968d-cd37c43d9293
key: LC-217
title: Do a repo audit
status: in_review
priority: urgent
labels:
  - release
created_at: 2026-08-11T14:59:39.137Z
updated_at: 2026-08-21T10:00:22.233Z
---

Repo audit, completed 2026-08-21. Original questions: can we remove some files, is everything structured properly, is the README up to date? Answers below; actionable fixes are in the checklist.

## Verdict

The repo is structurally healthy — no dead links across 155 docs, all 37 paths cited by the root docs resolve, spike archival and token guarding are exemplary. Findings: ~12 MB of removable tracked content, a README stale by ~386 commits, and one P1 bug — root `CLAUDE.md` is a broken pointer, so Claude Code sessions never load `AGENTS.md` (confirmed first-hand: a session receives the literal text "AGENTS.md" as its entire project instructions).

## Removable files (~12 MB / ~52 files)

- `assets/brand/concepts/` — 11 MB, 11 PNGs from the 2026-08-13 brand exploration round. Chosen mark already materialized in `assets/brand/app-icon/` and `apps/desktop/src-tauri/icons/`; referenced only by prose provenance lines, no code or build step.
- `docs/ux/prototypes/LongClaw Settings Screen UI.zip` (309 KB) — byte-identical archive of the 20 unpacked files beside it; zero references (LC-223 cites the unpacked directory). Also a stray tracked `.thumbnail`. Same cleanup precedent recorded in LC-62.
- `spikes/` (308 KB) — explicitly `# ARCHIVED PROTOTYPE`; the runnable snapshot is preserved in annotated tag `tauri-v2-architecture-m2`. The `spike-manifest-guard` only asserts absence of live manifests, so removal passes the gate. Requires repointing `docs/architecture-spike-report.md:171` (its `cd spikes/… && npm install` instruction is already broken — manifests are `.archived`).
- `docs/matt_pocock_skills.md` (1 KB) — zero inbound references; its own last line names `skills-lock.json` as the authority.

**Trap:** `docs/plans/active/` looks dead (no plans, just a 42 KB milestone narrative) but `apps/desktop/scripts/citation-guard.mjs:87` walks it unconditionally — deleting the directory crashes `npm run verify`. Retitle as archived instead of deleting.

**Checked and deliberately kept:** `.agents/` (content behind all 41 `.claude/skills` symlinks), `fixtures/` (every directory is a live test corpus), `examples/`, `docs/plans/completed/` (cited from live code and `docs/release-risks.md`), `docs/design/fable-design-system-v1.mhtml` (hand-saved, not regenerable), `.design-sync/`, `CONTEXT.md`.

## Structure findings

- **P1 — `CLAUDE.md` broken pointer.** Contains bare text `AGENTS.md\n` — neither a symlink nor the `@AGENTS.md` import syntax, so none of AGENTS.md's rules reach a Claude Code session.
- **P1 — contradictory work-intake workflows.** `AGENTS.md:8-9` (since 2026-08-05) says file tickets, not `docs/plans/` markdown; `docs/plans/active/README.md` still instructs plan-writing, and `docs/plans/completed/LC-201-…md` was added six days after the rule and is linked as LC-201's "spec" from `docs/ux/prototypes/README.md`.
- `docs/acceptance/README.md` calls the 2026-08-04 pass current; `docs/mvp_plan_order.md:786-787` marks it superseded by the two 2026-08-05 records, which the index omits.
- One broken relative link in all of docs: `docs/plans/completed/00-confirm-ci-on-main.md` → `../active/09-rename-is-not-an-overflow.md` (file moved to `completed/`).
- Install instruction split: README/CONTRIBUTING say `npm --prefix apps/desktop install`; AGENTS.md and CI use `ci`. CONTRIBUTING also says `npx playwright@1.62.1 install webkit` while CI uses `playwright-core`.
- App icons byte-identical in `assets/brand/app-icon/icons/` and `src-tauri/icons/` with no declared source of truth (the 1024 master `icon.png` is tracked only in `assets/`).
- Root `package.json` is a hand-maintained 24-script proxy (no `workspaces`); root `package-lock.json` (15 lines, zero packages) and its dependabot npm entry are vestigial; any new script must be added in two files.
- Lint/format stop at `apps/desktop/`, yet `verify` executes `docs/design/foundations/scripts/a11y-check.mjs` — gate-critical code no gate lints.
- `docs/` root mixes snake_case and kebab-case (subdirectories are uniformly kebab); ADRs 0001–0005 and 0011 lack the `**Status:**` line 0006–0010/0012 carry; `apps/desktop/perf/` is roughly half non-perf harnesses (a11y, theme matrix, network audit).

## README and docs freshness

README last touched 2026-08-04 (commit 1ff010b); 386 commits since. Nothing in it is broken — all links resolve, all commands exist — but:

- The `npm run verify` description names 11 of 18 gates; the ten design/structure guards are unmentioned. The same stale list is duplicated in `CONTRIBUTING.md:45-48` and `apps/desktop/README.md:21-24`.
- No feature list: board, dense list, ticket panel, checklists, command palette, quick create, themes, timeline with Activity/Comments split, markdown editor, filter/group/order, undo — all undocumented at root.
- The `longclaw` CLI (second shipped binary, `src-tauri/src/cli.rs`; the mechanism behind the README's own agent-collaboration claim and mandated by ADR 0011) is never mentioned.
- Doc list omits everything post-Aug-4: `docs/user-guide.md`, the 12 ADRs, `docs/agents/`, `docs/release-notes/v0.1.0.md`. There is no `docs/README.md` index, so the root README's rotted list is the only index.
- Platform line under-specifies: macOS 13+ (`tauri.conf.json:47`), Apple Silicon only, unsigned.
- No logo or screenshot despite the brand kit shipping 2026-08-13 (LC-62).
- `.longclaw/` layout diagram omits `longclaw.yaml` and `.longclaw/AGENTS.md` — the on-disk contract behind the core pitch.
- `CONTEXT.md` near-orphaned (last touched 2026-07-30, referenced only from `README.md:29`) and missing load-bearing terms: Project, Label, Status/Priority, Checklist item, Archive, Field (LC-220 named the vocabulary; no glossary entry exists). `docs/agents/domain.md:16-20` also diagrams a root `src/` that does not exist.


## Checklist

- [x] Fix root CLAUDE.md: replace bare 'AGENTS.md' text with '@AGENTS.md' import so Claude Code loads the rules <!-- longclaw:item=ck_4cae3235 -->
- [x] Remove assets/brand/concepts/ (11 MB dated brand explorations; chosen mark already materialized) <!-- longclaw:item=ck_1a576e48 -->
- [x] Remove docs/ux/prototypes 'LongClaw Settings Screen UI.zip' and stray .thumbnail; index the unpacked prototype in the prototypes README <!-- longclaw:item=ck_ca56608d -->
- [x] Remove spikes/ (preserved in tag tauri-v2-architecture-m2); repoint docs/architecture-spike-report.md:171 and decide fate of archived-spikes:check <!-- longclaw:item=ck_96606385 -->
- [x] Remove docs/matt_pocock_skills.md (orphaned; skills-lock.json is the authority) <!-- longclaw:item=ck_2323ee86 -->
- [x] Retitle docs/plans/active/README.md as an archived record and strip plan-authoring instructions (citation-guard.mjs:87 walks the dir — do not delete it); repoint LC-201 spec link to the ticket <!-- longclaw:item=ck_1f22d398 -->
- [x] Rewrite README.md: feature list, longclaw CLI section, corrected verify gate description, macOS 13+ Apple Silicon line, post-Aug-4 doc links, logo/screenshot, .longclaw layout with longclaw.yaml and AGENTS.md <!-- longclaw:item=ck_0a608942 -->
- [x] Standardize on 'npm --prefix apps/desktop ci' in README and CONTRIBUTING; fix CONTRIBUTING's playwright install line to playwright-core <!-- longclaw:item=ck_93430349 -->
- [x] Update stale verify gate list copies in CONTRIBUTING.md and apps/desktop/README.md (or stop enumerating and link CONTRIBUTING) <!-- longclaw:item=ck_e8bb87fa -->
- [x] Update docs/acceptance/README.md index to the 2026-08-05 records; fix broken ../active/09 link in docs/plans/completed/00-confirm-ci-on-main.md <!-- longclaw:item=ck_4c1f2e93 -->
- [x] Declare assets/brand/app-icon as icon source of truth in its README (or gitignore the generated src-tauri copy) <!-- longclaw:item=ck_041c2252 -->
- [x] Root package hygiene: adopt workspaces or document the forwarder; drop vestigial root package-lock.json and the dependabot npm root entry <!-- longclaw:item=ck_a8043a4f -->
- [x] Refresh CONTEXT.md glossary (Project, Label, Status/Priority, Checklist item, Archive, Field) and fix docs/agents/domain.md repo diagram <!-- longclaw:item=ck_0c8004c2 -->
- [x] Backfill **Status:** lines on ADRs 0001-0005 and 0011 <!-- longclaw:item=ck_1b3d95a3 -->
## Activity

<!-- longclaw:event
id: evt_39cb7086
kind: create
occurred_at: 2026-08-11T14:59:39.137Z
actor:
  type: human
  id: local
-->
### You created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_eb5e6829
kind: update
occurred_at: 2026-08-21T08:50:10.802Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: description
  - field: checklist.ck_4cae3235.added
    to: "Fix root CLAUDE.md: replace bare 'AGENTS.md' text with '@AGENTS.md' import so Claude Code loads the rules"
  - field: checklist.ck_1a576e48.added
    to: Remove assets/brand/concepts/ (11 MB dated brand explorations; chosen mark already materialized)
  - field: checklist.ck_ca56608d.added
    to: Remove docs/ux/prototypes 'LongClaw Settings Screen UI.zip' and stray .thumbnail; index the unpacked prototype in the prototypes README
  - field: checklist.ck_96606385.added
    to: Remove spikes/ (preserved in tag tauri-v2-architecture-m2); repoint docs/architecture-spike-report.md:171 and decide fate of archived-spikes:check
  - field: checklist.ck_2323ee86.added
    to: Remove docs/matt_pocock_skills.md (orphaned; skills-lock.json is the authority)
  - field: checklist.ck_1f22d398.added
    to: Retitle docs/plans/active/README.md as an archived record and strip plan-authoring instructions (citation-guard.mjs:87 walks the dir — do not delete it); repoint LC-201 spec link to the ticket
  - field: checklist.ck_0a608942.added
    to: "Rewrite README.md: feature list, longclaw CLI section, corrected verify gate description, macOS 13+ Apple Silicon line, post-Aug-4 doc links, logo/screenshot, .longclaw layout with longclaw.yaml and AGENTS.md"
  - field: checklist.ck_93430349.added
    to: Standardize on 'npm --prefix apps/desktop ci' in README and CONTRIBUTING; fix CONTRIBUTING's playwright install line to playwright-core
  - field: checklist.ck_e8bb87fa.added
    to: Update stale verify gate list copies in CONTRIBUTING.md and apps/desktop/README.md (or stop enumerating and link CONTRIBUTING)
  - field: checklist.ck_4c1f2e93.added
    to: Update docs/acceptance/README.md index to the 2026-08-05 records; fix broken ../active/09 link in docs/plans/completed/00-confirm-ci-on-main.md
  - field: checklist.ck_041c2252.added
    to: Declare assets/brand/app-icon as icon source of truth in its README (or gitignore the generated src-tauri copy)
  - field: checklist.ck_a8043a4f.added
    to: "Root package hygiene: adopt workspaces or document the forwarder; drop vestigial root package-lock.json and the dependabot npm root entry"
  - field: checklist.ck_0c8004c2.added
    to: Refresh CONTEXT.md glossary (Project, Label, Status/Priority, Checklist item, Archive, Field) and fix docs/agents/domain.md repo diagram
  - field: checklist.ck_1b3d95a3.added
    to: Backfill **Status:** lines on ADRs 0001-0005 and 0011
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_3290d12e
kind: update
occurred_at: 2026-08-21T09:48:30.600Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: in_progress
  - field: checklist.ck_4cae3235.checked
    from: "false"
    to: "true"
  - field: checklist.ck_1a576e48.checked
    from: "false"
    to: "true"
  - field: checklist.ck_ca56608d.checked
    from: "false"
    to: "true"
  - field: checklist.ck_96606385.checked
    from: "false"
    to: "true"
  - field: checklist.ck_2323ee86.checked
    from: "false"
    to: "true"
  - field: checklist.ck_1f22d398.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Batch 1 on branch chore/lc-217-repo-audit, commit 83e5a81. CLAUDE.md now imports @AGENTS.md. Removed assets/brand/concepts/, the settings-prototype zip and its .thumbnail, spikes/, and docs/matt_pocock_skills.md — 62 files, 11,211 lines. Deleting spikes/ also cleared 4.5 GB of orphaned untracked build output and retires the LC-155 trap where tauri dev from the repo root found the spike's tauri.conf.json first. spike-manifest-guard.mjs and its archived-spikes:check left the gate with the directory it guarded. docs/architecture-spike-report.md now points reviewers at tag tauri-v2-architecture-m2 instead of an npm install that could not work. docs/plans/active/README.md is status: record with the plan-authoring procedure retired; the directory stays because citation-guard walks it without an existence check. citations:check and format:check pass.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_00c4b7f4
kind: update
occurred_at: 2026-08-21T09:54:24.071Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_e8bb87fa.checked
    from: "false"
    to: "true"
  - field: checklist.ck_4c1f2e93.checked
    from: "false"
    to: "true"
  - field: checklist.ck_041c2252.checked
    from: "false"
    to: "true"
  - field: checklist.ck_a8043a4f.checked
    from: "false"
    to: "true"
  - field: checklist.ck_0c8004c2.checked
    from: "false"
    to: "true"
  - field: checklist.ck_1b3d95a3.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Batch 2, commit f91fb57. The gate is now described once in CONTRIBUTING, grouped by what each stage protects; README and apps/desktop/README point at it rather than keeping their own copies, which is how all three came to name eleven of eighteen checks. CONTRIBUTING also gained the two rules that lived only in AGENTS.md — file a ticket through the CLI, and branch before changing anything — plus playwright-core and the macOS 13 Apple Silicon line. Root package.json declares that it is deliberately not a workspace and forwards the five scripts AGENTS.md spelled out by hand; its empty package-lock.json and the dependabot entry watching it are gone. Acceptance index now lists all four runs with the 2026-08-05 pair as current. CONTEXT.md gained Project, Status, Priority, Label, Checklist item, Archive and Field, each checked against the code rather than invented. domain.md no longer diagrams a root src/. All 12 ADRs carry a Status line. Remaining: the README rewrite.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_baa78e6f
kind: update
occurred_at: 2026-08-21T10:00:22.233Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: in_progress
    to: in_review
  - field: checklist.ck_0a608942.checked
    from: "false"
    to: "true"
  - field: checklist.ck_93430349.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

All 14 items done, commit abc797d. The README is rewritten against what ships: a feature list (board, list, panel, checklists, palette, quick create, watcher and acknowledgement, five themes), a longclaw CLI section, the corrected platform and install lines, the post-Aug-4 doc index, the .longclaw layout including longclaw.yaml and AGENTS.md, and the mark that shipped on 2026-08-13. The CLI example is verified by running it — project init, label add, ticket create, ticket edit, ticket list in a temp directory, producing the tree the layout section draws. The first draft was wrong in the way this audit was about: it carried --label storage into a project with no labels defined, which the CLI refuses; running it is what found that.

npm run verify passes end to end: exit 0, 15 guards clean, 1024 frontend tests, 157 Rust tests, watcher integration green.

One finding is filed separately rather than fixed here: LC-225, screen-specs.md:114 still lists four theme presets while the app ships five (Graphite arrived with LC-192). It is left open because screen-specs.md is a pinned citation document, so the fix requires a reviewed citations:update rather than a one-line edit.

Work is on branch chore/lc-217-repo-audit, three commits, not merged.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_a1e94a09
kind: comment
occurred_at: 2026-08-21T10:11:11.699Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Follow-up on the README header image. The first version used longclaw-mark-ochre.png, which assets/brand/app-icon/README.md scopes to paper/white surfaces — but a README renders in the reader's GitHub theme, and that mark is transparent, so on dark it sat around 4.2:1. Switched to app-tile-rounded-512.png, which carries its own ochre ground and so renders identically in both themes without a <picture> swap, and is the icon users recognise from the dock. Commit 47a84cb.
<!-- /longclaw:event -->
