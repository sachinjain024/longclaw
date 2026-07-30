---
title: "Pilot macOS build"
product: LongClaw
status: active
milestone: "M3 — Vertical slice ready (Step 8)"
---

# Pilot macOS build

How to produce and hand over the build used for the mid-v0 pilot (Step 9). This
is a pilot artifact, not a release artifact: signing and notarization are Step 16
work, and this document states the consequence plainly rather than hiding it.

## Produce it

From a clean checkout:

```sh
npm --prefix apps/desktop install
npm run verify          # formatting, lint, types, unit, integration, watcher, build
npm run build:app       # release bundle
```

`npm run verify` must pass before a build is handed to anyone. It runs the
automated half of
[the agent round-trip acceptance scenario](agent-round-trip.md), including the
native-watcher test.

The bundle lands in:

```text
apps/desktop/src-tauri/target/release/bundle/macos/LongClaw.app
apps/desktop/src-tauri/target/release/bundle/dmg/LongClaw_0.1.0_<arch>.dmg
```

## Hand it over

Give each pilot participant:

1. the `.dmg`;
2. the note below about the unsigned build;
3. [`examples/agent-context/`](../../examples/agent-context/) so their agent can
   find the ticket instructions;
4. the [mid-v0 pilot protocol](../pilot/README.md) for the moderator only;
5. nothing else — no account, no key, no configuration. If a participant needs
   anything more to reach a board, that is a finding.

### Note for participants (unsigned build)

> This build is not signed or notarized yet. macOS will refuse to open it on the
> first try. Open it once from Finder with **right-click → Open**, then confirm.
> After that it launches normally. It makes no network requests and sends no
> telemetry; everything it stores lives in the project folder you choose and in
> the app's own local support directory.

## What to verify on the pilot machine before the session

Run these on the participant's machine, not only on the build machine:

- [ ] the app launches without an account or network connection;
- [ ] first launch reaches an empty board in under a minute;
- [ ] the chosen folder gains `.longclaw/longclaw.yaml`, `.longclaw/AGENTS.md`,
      and `.longclaw/tickets/`;
- [ ] steps 2–6 of [the acceptance scenario](agent-round-trip.md) pass with the
      participant's own agent tool;
- [ ] quitting and relaunching restores the project, its star, and the
      appearance preference.

## Known pilot limitations

State these up front so pilot feedback separates missing breadth from a broken
thesis:

- unsigned build, first-launch Gatekeeper prompt (Step 16);
- one status board and a minimal ticket panel; priority, labels, list view,
  search UI, and the command palette arrive in Steps 11–12;
- the description editor is plain text with no markdown preview yet (Step 11);
- no toast or undo after a mutation — the panel's disk-state line is the only
  write feedback, and there is no `⌘Z` (Step 11);
- ticket creation waits for the write to land instead of appearing instantly
  (Step 11);
- no archive or delete affordance in the panel (Step 11);
- attachments are preserved and read, but there is no attachment UI (ADR 0005).
