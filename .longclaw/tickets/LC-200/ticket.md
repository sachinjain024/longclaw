---
format: longclaw.ticket/v1
id: 6af5777d-834f-421a-851c-09dc2105f882
key: LC-200
title: The root package.json passthroughs ate every flag, so four documented --self-test runs were ordinary passes
status: in_review
priority: none
labels:
  - frontend
created_at: 2026-08-10T22:44:30.848Z
updated_at: 2026-08-10T22:44:44.493Z
---

Found while adding `probe:checklist` for LC-193, and fixed there because that
ticket's own `--self-test` could not otherwise be run as documented. Filed so
the repair is on the record rather than buried in an unrelated commit.

## What it was

Every root script is a passthrough of the form

    "a11y:audit": "npm --prefix apps/desktop run a11y:audit"

and npm does not forward trailing arguments through one. `npm run a11y:audit --
--self-test` becomes `npm --prefix apps/desktop run a11y:audit --self-test`,
where npm reads `--self-test` as its own config and drops it. Proven with a
one-line script that printed `process.argv`: `ARGV: []`.

So every inversion AGENTS.md and CONTRIBUTING.md document at the root ran as an
ordinary pass and printed its ordinary green:

    npm run a11y:audit -- --self-test
    npm run probe:header -- --self-test
    npm run probe:drag -- --self-test
    npm run audit:network -- --self-test

A `--self-test` that quietly does not invert is worse than none: it is a gate
reporting that it cannot lie, while lying. The same swallowing took `--only=`,
`--widths=`, `--tickets=` and `--phase=` at the root.

## The fix

The passthroughs for the eight scripts that take flags now end in `--`, which is
what makes npm hand the rest on. Verified: `ARGV: ["--self-test"]`, and
`npm run probe:checklist -- --self-test` reaches the probe and inverts it.

## Left open

Nobody has re-run the four inversions that were never really run. They should
be, since none of them has been exercised through the documented command:
`a11y:audit`, `probe:header`, `probe:drag`, `audit:network`.

## Activity

<!-- longclaw:event
id: evt_134def92
kind: create
occurred_at: 2026-08-10T22:44:30.848Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_20bfc00b
kind: update
occurred_at: 2026-08-10T22:44:36.955Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: in_review
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_c7353ccc
kind: update
occurred_at: 2026-08-10T22:44:44.493Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: title
    from: The root package.json passthroughs ate every flag, so six documented --self-test runs were ordinary passes
    to: The root package.json passthroughs ate every flag, so four documented --self-test runs were ordinary passes
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->
