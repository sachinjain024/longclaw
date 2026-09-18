---
format: longclaw.ticket/v1
id: 157695a7-ac33-494c-8a8d-a3d2a37e4dc7
key: LC-256a
title: "Auto-update: the update path, and the experience around it"
status: todo
priority: urgent
labels:
  - platform
  - release
  - product
type: feature
created_at: 2026-09-16T07:40:42.050Z
updated_at: 2026-09-16T07:40:42.050Z
---

LongClaw ships as a signed, notarized DMG downloaded from longclaw.io. There is
no way for an installed copy to learn that a newer one exists, and no way for a
user to get it except by going back to the site and repeating the install. Every
v0.1.0 in the world is a permanent v0.1.0.

This is urgent because it is the one defect that gets worse with time and cannot
be fixed retroactively: a user who installs today and never returns to the site
is unreachable by every later fix. The longer the first release is out without
an update path, the larger the population that has to be told to reinstall by
hand.

## It was deliberately deferred, and that decision is what is being revisited

LC-47 put it out of scope in as many words — "The Tauri updater. It carries its
own separate signing key and is not part of v0." That was the right call for
shipping v0.1.0. This ticket is the follow-through, not a contradiction of it,
and the separate signing key is still the first real obstacle.

## The no-network contract has to be amended, on purpose and in writing

Three gates assert that a running LongClaw never touches the network, and an
updater trips all three:

- `capabilities/main.json` — the webview has no network capability. Whatever
  checks for an update is Rust, and the webview names an intent rather than a
  URL, the same shape as `open_ticket_file` and `install_command_line`.
- `scripts/binary-audit.mjs` — **fails the build** when `CFNetwork` or
  `Network.framework` is linked, and its own summary line currently certifies
  "no HTTP client, telemetry, socket import, or network framework in either
  shipped binary". The updater plugin links one.
- `npm run audit:network` — the release gate's process-monitor pass, whose
  premise is no non-IPC connection at all, offline or online.

`docs/acceptance/release-candidate.md` states the same thing to the release
reviewer twice, including the row "No analytics, telemetry, updater,
crash-reporting, shell, HTTP, or filesystem plugin is directly configured".

None of these are obstacles to route around. They are the product's promise
written as tests, and the promise is narrower than "no network" — it is no
telemetry, no analytics, no phoning home about the user's data. An update check
can be inside that promise if it is written to be: no identifiers, no project
data, nothing about what the user has open. Amend the contracts to say exactly
that, and change the gates to assert the *new* narrow shape rather than deleting
them. A gate that stops asserting anything is worse than a gate that goes red.

**Write an ADR for this.** It is the same class of decision as ADR 0009 and
ADR 0011, and the audit docs should cite it rather than re-arguing it.

## Signing and the manifest

- The updater has its own key pair, separate from the Developer ID identity in
  `docs/release-signing-runbook.md`. Generating it, storing the private half,
  and getting the public half into the bundle are prerequisites to any code.
- Someone has to host the update manifest and the artifacts. GitHub Releases
  plus a static manifest on the existing Pages deployment is the obvious answer
  and should be considered against alternatives in the ADR.
- `scripts/release-macos.mjs` produces the release today; it grows the step that
  signs the update artifact and publishes the manifest. A release that updates
  nobody because the manifest was not refreshed is the failure mode to design
  against.

## The experience, which is half the ticket

The title says "functionality & experience" and the second word is where this
gets decided. Minimum:

- **Consent.** The user is told an update exists and chooses. No silent
  download, no forced restart, no surprise version change under an open project.
- **What changed.** `/changelog` already exists on the site and release notes
  already live in `docs/release-notes/`. The update prompt should show what it
  is offering, not just a version number. One source, not a retyped one — this
  repo already knows how a second copy of a sentence ends.
- **Never mid-write.** A restart while a ticket write is in flight is data loss
  in a product whose whole claim is that the files are yours. The disk-state
  indicator already knows when a write is outstanding; the updater must too.
- **Failure is quiet.** No network, a blocked host, a bad signature, a corrupt
  download — none of these are the user's problem and none produce a dialog they
  cannot act on. Failing to check for an update is not an error state.
- **A way to turn it off,** and a way to check manually. Both belong in
  Settings, next to `Command line` — the other pane that is about the app rather
  than the project.
- **Offline users stay first-class.** LongClaw works with no network and must
  keep working, including never nagging about a check it could not perform.

## Also

- Any new Settings pane is added to `SETTINGS_SECTIONS` in
  `settingsSections.ts`, which holds both the nav label and the menu label so
  the two surfaces cannot drift.
- Controls need explicit `tabIndex` (`scripts/tab-order-guard.mjs`), and a modal
  changes the keyboard contract — `npm run a11y:audit` against
  `keyboard-focus-map.md`.
- Every user-facing string here, including the live region that announces an
  update is ready, belongs in a copy deck before it reaches `src/`.
- The website's copy rule bites once this ships: the brief forbids overselling
  v0.1.0, and "auto-updates" becomes sayable only when it does.

## Related

- LC-47 deferred this and names the separate signing key.
- The GitHub star-count ticket filed alongside this one needs the same network
  path and should follow it rather than build its own.

## Checklist

- [ ] ADR: amend the no-network contract to a narrow, identifier-free update check <!-- longclaw:item=ck_e47d47ec -->
- [ ] Generate the updater signing key pair and get the public half into the bundle <!-- longclaw:item=ck_27060633 -->
- [ ] Decide and document where the update manifest and artifacts are hosted <!-- longclaw:item=ck_83adaa6c -->
- [ ] Wire the updater in Rust; the webview names an intent, never a URL <!-- longclaw:item=ck_0c3bfdb7 -->
- [ ] Update capabilities/main.json, binary-audit.mjs and audit:network to assert the new narrow shape <!-- longclaw:item=ck_11a193e5 -->
- [ ] Update docs/acceptance/release-candidate.md rows that certify no updater <!-- longclaw:item=ck_fa36173f -->
- [ ] Extend release-macos.mjs to sign the update artifact and publish the manifest <!-- longclaw:item=ck_bb8dfd57 -->
- [ ] Update UX: consent, what changed from the existing release notes, no silent restart <!-- longclaw:item=ck_010f03e9 -->
- [ ] Refuse to restart while a ticket write is in flight <!-- longclaw:item=ck_55f6655e -->
- [ ] Quiet failure for offline, blocked, bad-signature and corrupt-download cases <!-- longclaw:item=ck_a8ca9293 -->
- [ ] Settings pane: turn it off, and check manually <!-- longclaw:item=ck_86fd9686 -->
- [ ] Copy deck for every string, including the live region <!-- longclaw:item=ck_42b4fa8a -->
- [ ] Run a11y:audit and probe:header; quote the runs <!-- longclaw:item=ck_743cbe53 -->

## Activity

<!-- longclaw:event
id: evt_ccf136e6
kind: create
occurred_at: 2026-09-16T07:40:42.050Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
