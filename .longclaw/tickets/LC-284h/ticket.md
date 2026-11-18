---
format: longclaw.ticket/v1
id: 85542aa7-f3ac-491a-8674-9ccf2faa28a3
key: LC-284h
title: "CLI: list all registered projects (longclaw project list / projects)"
status: todo
priority: p3
labels:
  - product
type: feature
created_at: 2026-11-10T03:25:04.225Z
updated_at: 2026-11-10T03:25:04.225Z
---

The CLI has no way to list registered projects. `project show` only reports the project at `--path` (default: cwd), so seeing every project means reading the desktop app's `project-registry.json` by hand.

Both `longclaw projects` and `longclaw ls` were tried in practice and both failed with `parse_failed: Unknown command`.

## Proposal

`longclaw project list` (alias `longclaw projects`) prints the registry as JSON, in sidebar order, one entry per project:

- id, key, name, rootPath, theme, starred, reachable, order
- ticket counts: total, and open (status not done/canceled)

Unreachable projects are listed with `reachable: false` and null counts rather than failing the command.

Also add `longclaw ls` as an alias for `ticket list`, since that is the first thing people type.

## Checklist

- [ ] Add 'project list' command reading the project registry <!-- longclaw:item=ck_88804e1e -->
- [ ] Include total and open ticket counts per project <!-- longclaw:item=ck_f4cfc9d6 -->
- [ ] Handle unreachable projects without failing <!-- longclaw:item=ck_99a9c91d -->
- [ ] Add 'projects' alias for 'project list' <!-- longclaw:item=ck_305693fe -->
- [ ] Add 'ls' alias for 'ticket list' <!-- longclaw:item=ck_8509e430 -->
- [ ] Document in --help and agent instructions <!-- longclaw:item=ck_0b52806c -->

## Activity

<!-- longclaw:event
id: evt_94ffaa59
kind: create
occurred_at: 2026-11-10T03:25:04.225Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
