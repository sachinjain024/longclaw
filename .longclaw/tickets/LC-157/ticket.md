---
format: longclaw.ticket/v1
id: 98f56db5-e177-4c69-a2e7-80623986dd69
key: LC-157
title: Perf harnesses hardcode port 4173, so a run in one worktree silently drives another worktree's build
status: done
priority: p2
rank: Zz
labels:
  - platform
created_at: 2026-08-06T06:37:59.336Z
updated_at: 2026-08-09T07:37:19.714Z
---

All four Playwright harnesses hardcode \`const ORIGIN = "http://localhost:4173"\` — \`theme-matrix.mjs:32\`, \`a11y-audit.mjs:36\`, \`board-trace.mjs:36\`, \`board-shots.mjs:18\` — and each spawns its own \`vite preview\` without \`--strictPort\`.

Vite auto-increments when the port is taken. So if any other checkout is already serving on 4173, the harness's own server quietly binds 4174, the readiness probe \`fetch(ORIGIN)\` succeeds against **the other checkout**, and the run drives a build that is not the one under test.

Seen while working LC-71/72/73: \`npm run matrix\` failed with \`page.waitForFunction: Timeout 30000ms exceeded\` waiting for \`.ticket-row\`, twice, immediately after a green \`npm run verify\`. The cause was a \`vite preview\` left running from the \`longclaw-lc68\` worktree; \`lsof -nP -iTCP:4173 -sTCP:LISTEN\` named it. Nothing in the failure pointed at the port.

Two ways this bites, and the second is the dangerous one:

1. A confusing timeout that reads as a regression in the code under test.
2. **A run that passes against the wrong build.** If the two checkouts are similar enough that the probes still find their selectors, the harness reports green for code it never loaded. `matrix` and `a11y:audit` are release gates, so this is a gate that can lie.

This is exactly the failure mode \`AGENTS.md\` warns about for \`audit:network\` — "it needs a quiet machine" — but here it is silent and the harness has no control that catches it.

## Checklist

- [x] Pass --strictPort to the spawned vite preview so a busy port fails the run instead of sliding to 4174 <!-- longclaw:item=ck_423b6346 -->
- [x] Or bind an ephemeral port and derive ORIGIN from it, which also lets two worktrees run harnesses at once <!-- longclaw:item=ck_ae5e17f9 -->

## Activity

<!-- longclaw:event
id: evt_b50cdd9f
kind: create
occurred_at: 2026-08-06T06:37:59.336Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_d8466655
kind: update
occurred_at: 2026-08-09T01:16:50.582Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: in_progress
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_b2249ef8
kind: update
occurred_at: 2026-08-09T01:16:58.158Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_423b6346.checked
    from: "false"
    to: "true"
  - field: checklist.ck_ae5e17f9.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_f251afef
kind: comment
occurred_at: 2026-08-09T01:17:10.932Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Both checklist items landed together, because the first is not sufficient on its own: `--strictPort` makes the harness's own server die when 4173 is taken, but the readiness probe then succeeds against whoever holds the port, so the run still drives the wrong build — silently. All six harnesses (the four named here plus `header-probe` and `drag-probe`) now share `perf/preview-server.mjs`, which reserves an ephemeral port, launches with `--strictPort`, and probes nothing until the server it started has printed the URL it is serving on that exact port. Verified by holding 4173 with a second `vite preview` and running `probe:header` clean against its own port.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_a52879e3
kind: update
occurred_at: 2026-08-09T01:19:50.274Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: in_progress
    to: done
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_dc17ef1c
kind: comment
occurred_at: 2026-08-09T01:29:38.186Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Correction to this ticket's premise, found in review: vite was never auto-incrementing. `perf/vite.config.ts` has carried `preview: { strictPort: true }` since 80fa437 (2026-07-31, five days before this was filed), and every harness spawned with `--config perf/vite.config.ts`. So the harness's own server was already dying on a busy 4173 — `stdio: "ignore"` swallowed the complaint, nothing watched the child, and the probe then hit the other checkout. The reported symptom and the danger are exactly as described; only the mechanism named here was wrong, which is why `--strictPort` on its own would not have fixed it.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_328d2ead
kind: update
occurred_at: 2026-08-09T07:37:19.714Z
actor:
  type: human
  id: local
changes:
  - field: rank
    to: Zz
-->
### You updated this ticket
<!-- /longclaw:event -->
