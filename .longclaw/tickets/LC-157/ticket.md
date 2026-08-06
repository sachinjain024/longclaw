---
format: longclaw.ticket/v1
id: 98f56db5-e177-4c69-a2e7-80623986dd69
key: LC-157
title: Perf harnesses hardcode port 4173, so a run in one worktree silently drives another worktree's build
status: todo
priority: p2
labels:
  - platform
created_at: 2026-08-06T06:37:59.336Z
updated_at: 2026-08-06T06:37:59.336Z
---

All four Playwright harnesses hardcode \`const ORIGIN = "http://localhost:4173"\` — \`theme-matrix.mjs:32\`, \`a11y-audit.mjs:36\`, \`board-trace.mjs:36\`, \`board-shots.mjs:18\` — and each spawns its own \`vite preview\` without \`--strictPort\`.

Vite auto-increments when the port is taken. So if any other checkout is already serving on 4173, the harness's own server quietly binds 4174, the readiness probe \`fetch(ORIGIN)\` succeeds against **the other checkout**, and the run drives a build that is not the one under test.

Seen while working LC-71/72/73: \`npm run matrix\` failed with \`page.waitForFunction: Timeout 30000ms exceeded\` waiting for \`.ticket-row\`, twice, immediately after a green \`npm run verify\`. The cause was a \`vite preview\` left running from the \`longclaw-lc68\` worktree; \`lsof -nP -iTCP:4173 -sTCP:LISTEN\` named it. Nothing in the failure pointed at the port.

Two ways this bites, and the second is the dangerous one:

1. A confusing timeout that reads as a regression in the code under test.
2. **A run that passes against the wrong build.** If the two checkouts are similar enough that the probes still find their selectors, the harness reports green for code it never loaded. `matrix` and `a11y:audit` are release gates, so this is a gate that can lie.

This is exactly the failure mode \`AGENTS.md\` warns about for \`audit:network\` — "it needs a quiet machine" — but here it is silent and the harness has no control that catches it.

## Checklist

- [ ] Pass --strictPort to the spawned vite preview so a busy port fails the run instead of sliding to 4174 <!-- longclaw:item=ck_423b6346 -->
- [ ] Or bind an ephemeral port and derive ORIGIN from it, which also lets two worktrees run harnesses at once <!-- longclaw:item=ck_ae5e17f9 -->

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
