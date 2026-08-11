---
format: longclaw.ticket/v1
id: 1eac57ce-e258-4ba4-9e63-5c2d2c65913a
key: LC-161
title: "Workspace restoration was untestable: no localStorage in the test environment, and a catch that hid it"
status: done
priority: p2
labels:
  - frontend
  - platform
created_at: 2026-08-06T13:58:51.187Z
updated_at: 2026-08-11T11:33:43.605Z
---

`agrees after a restart` (`App.test.tsx`, the V0-14 suite) failed on `main` from
the moment LC-49 landed. It is not a flake and not LC-49's logic: the test
environment has no `localStorage` at all, so every workspace preference write
silently did nothing and the restart could never restore a view.

## What is actually happening

Node 26 defines its own `localStorage` accessor on `globalThis`, and without
`--localstorage-file` it answers `undefined` — the `ExperimentalWarning` printed
on every vitest run, which reads as noise and is in fact the whole story:

```
descriptor: [ 'get', 'set', 'enumerable', 'configurable' ]
value: undefined
```

That accessor takes precedence over the one jsdom would install, so under
`// @vitest-environment jsdom` the global stays `undefined`. Every call in
`workspacePreferences.ts` therefore threw `TypeError: Cannot read properties of
undefined (reading 'setItem')` into a `try/catch` written for a *refused* write,
which swallowed it. Nothing was reported.

Instrumenting the read/write boundary showed it in three lines:

```
[DEBUG] read {}
[DEBUG] write {"project-fixture":{"view":"list"}}   ← unmount flush, correct
[DEBUG] read {}                                     ← the restart reads nothing back
```

Two things made this hard to see. `findByRole("button", { name: "List",
pressed: true })` fails with `Unable to find role="button" and name "List"`,
which reads as "the header did not render" when the button is present and only
`pressed` differs — the app comes back up on Board. And testing-library
truncates its DOM dump mid-attribute, which appeared to confirm that wrong
reading until `DEBUG_PRINT_LIMIT` was raised.

It presumably passed for whoever wrote LC-49: on a Node without that native
global, jsdom's `localStorage` comes through and the feature works.

## Why the suite did not catch it

Four suites had each hand-rolled the same stub, each with its own comment
re-explaining the same Node fact. LC-49's was the fifth site that needed one and
did not get it — the failure mode of a shim every author has to know about.

## The fix

- `src/testSetup.ts`, loaded by `vite.config.ts` for every suite: one
  `localStorage` that stores, fresh per test. The four hand-rolled copies are
  gone, and the tests that used their `Map` for arrange and assert now speak to
  `localStorage` directly. `workspacePreferences.test.ts` keeps its own store —
  that one is a fixture for the module under test, not an environment shim.
- `workspacePreferences.ts` now resolves the store once through `store()` and
  returns early when there is none, so the `catch` blocks are left to the case
  they were written for. A host with no web storage and a store that refused a
  write are different failures; both still degrade to "this choice does not
  survive the session", but the code can tell them apart.

## Open

The narrowing has no behavioural seam — both paths degrade identically by
design, so no regression test can distinguish them at the module's surface.
Nothing surfaces "this device cannot persist your preferences" at runtime
either. Whether that deserves a signal is a real decision and was not taken
here: the app code carries no `console` calls anywhere, and a toast for a
device-local preference would be the wrong instrument.

## Checklist

- [x] One localStorage shim in a setup file, loaded for every suite <!-- longclaw:item=ck_c0f8ef4a -->
- [x] Remove the four hand-rolled copies <!-- longclaw:item=ck_e3dab91f -->
- [x] Separate no-web-storage from the-write-was-refused in workspacePreferences.ts <!-- longclaw:item=ck_ee8a0f64 -->
- [x] Cover the shape that actually occurs — a global that answers undefined <!-- longclaw:item=ck_0b593a26 -->
- [ ] Decide whether an unpersistable session should say so <!-- longclaw:item=ck_af0d04fc -->

## Activity

<!-- longclaw:event
id: evt_0f0f635b
kind: create
occurred_at: 2026-08-06T13:58:51.187Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_a08dc995
kind: update
occurred_at: 2026-08-06T13:59:11.079Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: in_review
  - field: checklist.ck_c0f8ef4a.checked
    from: "false"
    to: "true"
  - field: checklist.ck_e3dab91f.checked
    from: "false"
    to: "true"
  - field: checklist.ck_ee8a0f64.checked
    from: "false"
    to: "true"
  - field: checklist.ck_0b593a26.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Fixed on `fix/lc-161-test-localstorage`.

`src/testSetup.ts` gives every suite a `localStorage` that stores, fresh per test, wired through `vite.config.ts`. The four hand-rolled copies are gone, along with the module-level descriptor capture-and-restore in `App.test.tsx` that existed to put the absent global back; the two suites that used their own `Map` for arrange and assert now read and write `localStorage` directly. `workspacePreferences.test.ts` keeps its own store, because that one is the fixture for the module under test rather than a shim for the environment.

`workspacePreferences.ts` resolves the store once through `store()` and returns early when there is none, leaving the catches to the refused write they were written for.

`agrees after a restart` passes, and it passes for the right reason: the sole change that turned it green was giving the environment a working store. `npm run verify` is green at 562 tests, up one — the new case is a global that answers `undefined`, which is what actually happens here and what the existing 'storage disabled' test, a getter that throws, did not cover.

The last item is left open on purpose. The narrowing has no behavioural seam — both paths degrade identically by design — so nothing at the module's surface can distinguish them, and whether an unpersistable session should announce itself is a product decision rather than a cleanup.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_081aedb1
kind: update
occurred_at: 2026-08-11T11:33:43.605Z
actor:
  type: human
  id: local
changes:
  - field: status
    from: in_review
    to: done
-->
### You updated this ticket
<!-- /longclaw:event -->
