---
format: longclaw.ticket/v1
id: c4e11fde-c550-40c9-907d-cfc9dd7215ed
key: LC-198
title: Converge the prototype's reference surface onto the real app
status: todo
priority: p3
labels:
  - frontend
created_at: 2026-08-10T07:27:37.190Z
updated_at: 2026-08-10T07:27:37.190Z
---

The prototype does two jobs with one architecture, and only one of them suits it.

- **Job A — exploration.** "What if the card looked like this?" Cheap,
  unconstrained, throwaway. A hand-written parallel implementation is exactly
  right for this, and it is the founder's stated way of working: prototype
  first, then build.
- **Job B — reference.** "This is what the product does in every state."
  `screen-specs.md` cites it, `keyboard-focus-map.md` traces it, and its renders
  are committed as evidence.

Job B as a parallel implementation is guaranteed to drift. It means ~7,000 lines
of HTML/CSS/JS reimplementing a product that also exists in `apps/desktop/src`,
with nothing checking the two agree. The receipt is already in the decision log:
**D16 is a decision about the prototype's gear-button hover diverging from the
app's.** That is the failure mode, recorded once, with nothing stopping the next
one.

LC-192 fixed the token layer — one token file, read by the app and the
prototype alike, enforced by `token-source-guard.mjs`. A theme change can no
longer diverge. Components still can.

**Proposal: converge Job B onto the real app; keep Job A separate and cheap.**

Most of the machinery exists. `perf/vite.config.ts` already builds the real
`App` over stubs and `perf/a11y-audit.mjs` already drives it with no pointer
input anywhere. Extend that: turn the prototype's four driver scenarios into
fixtures the real app can be driven into, and render the prototype screens from
the real app. The driver bar survives as harness chrome. Drift becomes
structurally impossible, because there is one implementation.

**Cost, stated plainly:** a real migration, roughly the size of the scenario
surface, and it removes the ability to prototype something the app cannot yet
do. That is why Job A stays — as an explicitly throwaway sandbox, not as a
committed parallel product cited by the specs.

## Checklist

- [ ] Move the four driver scenarios (agent session, conflict, corrupt file, unplug folder) into app fixtures <!-- longclaw:item=ck_ac10aee7 -->
- [ ] Render the prototype screens from the real App over those fixtures <!-- longclaw:item=ck_07151119 -->
- [ ] Keep the driver bar as harness chrome, not app chrome <!-- longclaw:item=ck_5901728b -->
- [ ] Retire the parallel implementation in prototype.js once the screens are covered <!-- longclaw:item=ck_7813867f -->
- [ ] Keep an explicitly-throwaway sandbox for Job A exploration <!-- longclaw:item=ck_f85639ff -->
- [ ] Repoint screen-specs.md and keyboard-focus-map.md citations at the new surface <!-- longclaw:item=ck_d9d3a6f2 -->

## Activity

<!-- longclaw:event
id: evt_7e8c62e1
kind: create
occurred_at: 2026-08-10T07:27:37.190Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
