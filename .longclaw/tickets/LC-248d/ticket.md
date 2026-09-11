---
format: longclaw.ticket/v1
id: 3a057207-5f71-4b43-842f-3fad73d51287
key: LC-248d
title: A hand-edited longclaw.yaml is invisible to the running app
status: todo
priority: p2
labels:
  - platform
type: bug
created_at: 2026-09-10T08:21:17.603Z
updated_at: 2026-09-10T08:21:17.603Z
---

The watcher watches `.longclaw/tickets/` and nothing else (`engine.rs:633`), and `normalize` discards any path it cannot strip that prefix from (`engine.rs:816`). So an external edit to `.longclaw/longclaw.yaml` produces no event at all, and a running app goes on showing the project as it was: the old name in the header, the old label set in the pickers and the filter, the old theme, and — since LC-227 — the old enabled properties.

It heals on the next rebuild, because `rebuild_now` re-reads the project file. But a rebuild happens on resume, on watcher overflow, on recovery and at launch, none of which the person who just edited the file has any reason to trigger.

## Why it matters more since LC-227

`longclaw help` names `longclaw.yaml` as the place a project turns a ticket property on, because no command does it. So hand-editing the project file is the documented path for a CLI-only project, not a workaround — and the app is the surface that will not notice.

## Found

While folding the LC-214 reconcile into that ticket's branch. LC-214 covers the *generated instruction files* going stale: `reconcile_agent_instructions` now brings `AGENTS.md` and `CLAUDE.md` back in step whenever the project is opened or rebuilt, and on every CLI command. That is the documentation half. This ticket is the other half — the app's own in-memory view of the project.

## Shape of a fix

Watch `.longclaw/` rather than `.longclaw/tickets/`, or watch the project file alongside the tickets root, and route a project-file event to a project reload that emits a snapshot. Two things need care: the watcher is where plan 10 recorded two workarounds as failures, and `.longclaw/` also holds the generated files the app itself writes, so a widened watch needs the reconcile's write-only-what-differs guard to stay exactly as it is or the two feed each other.

## Checklist

- [ ] An external edit to .longclaw/longclaw.yaml reaches the running app: name, theme, labels and enabled properties all refresh without a restart <!-- longclaw:item=ck_ad197581 -->
- [ ] The widened watch does not feed itself with the app's own writes to the generated instruction files <!-- longclaw:item=ck_f6b8887a -->

## Activity

<!-- longclaw:event
id: evt_0ae7c48c
kind: create
occurred_at: 2026-09-10T08:21:17.603Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
