---
format: longclaw.ticket/v1
id: 1abe422d-f394-4cd2-9570-5d3f3b268c81
key: LC-49
title: Restore the project that was open, on relaunch
status: backlog
priority: p1
labels:
  - frontend
  - post-mvp
created_at: 2026-08-05T14:23:17Z
updated_at: 2026-08-05T14:23:17Z
---

**Restore the project that was open, on relaunch.** Startup takes the first *reachable* project in registry order (`src/App.tsx:573-575`); `activeProjectId` lives only in the in-memory store (`src/state.ts:16`) and the registry has no field to persist it in. Open p2, quit, relaunch, and p1 is selected

## Why now

Found by the clean-machine pass on 2026-08-05 and reported there as a finding rather than a blocker: nothing is lost or corrupted, and the other project is one click away. It is listed here because the gate's restart row reads *"Last project state reloads from disk"*, and on a strict reading of "last project" that row is met only by the second half. Never regressed — it was never built, and no test restarts the app with two projects registered

## Source

`docs/backlog/post-mvp-backlog.md` — **P5a**, Tier 1, owner Frontend.

## Checklist

- [ ] A relaunch selects the project that was open at quit, falling back to the current behaviour when the record is missing or that project is unreachable — with a test that registers two projects, opens the second, and restarts <!-- longclaw:item=ck_fc11d408 -->

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
