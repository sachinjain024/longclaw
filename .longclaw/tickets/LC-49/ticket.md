---
format: longclaw.ticket/v1
id: 1abe422d-f394-4cd2-9570-5d3f3b268c81
key: LC-49
title: Restore project-scoped workspace state on relaunch
status: done
priority: p1
labels:
  - frontend
  - post-mvp
created_at: 2026-08-05T14:23:17Z
updated_at: 2026-08-06T11:29:57.273Z
---

Persist app-owned workspace state so relaunching LongClaw resumes where the user left off instead of rebuilding a default session.

The persisted state has two levels:

- Globally, remember the project that was active when the app last closed. On launch, select it when it is still registered and reachable; otherwise fall back to the first reachable project.
- Per project, remember the selected Board/List surface, ordering mode, and current filter or search query. Switching between projects and restarting the app must restore each project's own workspace state rather than leaking one project's choices into another.

Persist this as application preference state, not in `longclaw.yaml` or ticket files. Missing, stale, or malformed preference data must safely fall back to existing defaults. If a future search surface replaces or supplements the header filter, it should use the same project-scoped restoration contract.

## Why now

The clean-machine pass found that startup always selects the first reachable registry entry because `activeProjectId` exists only in memory. The same reset affects the rest of the working context: board versus list, ordering, and filter/search state are also lost. Together these make every restart discard the user's place even though no project data is lost.

## Related

- LC-151 records the open-project symptom as a cross-cutting prototype finding and is a duplicate reference for that part of this ticket.
- LC-15 originally specified the filter query as session-only state; this ticket intentionally changes that requirement to project-scoped app preference state.

## Source

Originally `docs/backlog/post-mvp-backlog.md` — **P5a**, Tier 1, owner Frontend; expanded from direct user feedback on 2026-08-06.

## Checklist

- [x] A relaunch selects the project that was open at quit, falling back to the current behaviour when the record is missing or that project is unreachable — with a test that registers two projects, opens the second, and restarts <!-- longclaw:item=ck_fc11d408 -->
- [x] Board/List view, ordering mode, and filter or search query are restored independently for each project after both project switches and app relaunches <!-- longclaw:item=ck_9a09bb52 -->
- [x] Workspace preferences are stored as app state and never modify longclaw.yaml or ticket files; missing, malformed, or stale values fall back safely to defaults <!-- longclaw:item=ck_bd095f3a -->
- [x] Restart coverage registers two projects with different workspace states, relaunches, restores the last active project and its state, then switches projects and restores the other state <!-- longclaw:item=ck_ef9d6d70 -->

## Activity

<!-- longclaw:event
id: evt_6c3c0725
kind: create
occurred_at: 2026-08-05T14:23:17Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_ac79bafa
kind: update
occurred_at: 2026-08-06T08:25:54.958Z
actor:
  type: agent
  id: codex
  name: Codex
changes:
  - field: title
    from: Restore the project that was open, on relaunch
    to: Restore project-scoped workspace state on relaunch
  - field: description
  - field: checklist.ck_9a09bb52.added
    to: Board/List view, ordering mode, and filter or search query are restored independently for each project after both project switches and app relaunches
  - field: checklist.ck_bd095f3a.added
    to: Workspace preferences are stored as app state and never modify longclaw.yaml or ticket files; missing, malformed, or stale values fall back safely to defaults
  - field: checklist.ck_ef9d6d70.added
    to: Restart coverage registers two projects with different workspace states, relaunches, restores the last active project and its state, then switches projects and restores the other state
-->
### Codex updated this ticket

Expanded from last-project restoration to the complete project-scoped workspace context reported by the user. LC-151 remains the duplicate cross-cutting reference for the open-project symptom.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_0c757a59
kind: update
occurred_at: 2026-08-06T09:34:20.772Z
actor:
  type: agent
  id: codex
  name: Codex
changes:
  - field: status
    from: backlog
    to: in_progress
-->
### Codex updated this ticket

Implementation started in the dedicated LC-49 worktree. TDD seam agreed: rendered App behavior across project switches and unmount/remount, with app-local storage surviving the restart.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_e64c51da
kind: update
occurred_at: 2026-08-06T11:29:57.273Z
actor:
  type: agent
  id: codex
  name: Codex
changes:
  - field: status
    from: in_progress
    to: done
  - field: checklist.ck_fc11d408.checked
    from: "false"
    to: "true"
  - field: checklist.ck_9a09bb52.checked
    from: "false"
    to: "true"
  - field: checklist.ck_bd095f3a.checked
    from: "false"
    to: "true"
  - field: checklist.ck_ef9d6d70.checked
    from: "false"
    to: "true"
-->
### Codex updated this ticket

Implemented restart-safe workspace restoration in the dedicated LC-49 worktree. The app now restores the last reachable project and keeps board/list view, ordering mode, and filter query per project, with safe fallback for unavailable projects and malformed or stale preferences. Added rendered-App restart tests, consolidated persistence behind a workspacePreferences module, migrated legacy ordering state, and updated the data requirements. Verification: npm run verify passed (546 frontend tests plus Rust, build, and native watcher); perf:board p95 keyboard 15ms, scroll 18ms, filter 26ms, write 16ms; perf:list p95 keyboard 16ms, scroll 18ms, filter 21ms, write 16ms; accessibility audit A1-A5 passed. Formal standards/spec review completed and all findings addressed.
<!-- /longclaw:event -->
