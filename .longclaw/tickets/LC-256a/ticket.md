---
format: longclaw.ticket/v1
id: 157695a7-ac33-494c-8a8d-a3d2a37e4dc7
key: LC-256a
title: "Auto-update: the update path, and the experience around it"
status: in_progress
priority: urgent
labels:
  - platform
  - release
  - product
  - ready-for-agent
type: feature
estimate: "3"
created_at: 2026-09-16T07:40:42.050Z
updated_at: 2026-09-19T12:57:23.883Z
---

LongClaw ships as a signed, notarized DMG. An installed copy has no way to
learn that a newer one exists and no way to get one except a fresh install
from the site, so every v0.1.0 in the world is a permanent v0.1.0 — and the
population that has to be told to reinstall by hand grows with every day the
first release is out. LC-47 deferred the updater knowingly; this is the
follow-through.

**Offline stays first-class.** Nothing that works today stops working or
starts needing a network. With no internet, every feature behaves exactly as
v0.1.0 does; the only thing that does not happen is the update check and the
download it can lead to.

**Spec:** [`docs/specs/LC-256a-auto-update.md`](../../../docs/specs/LC-256a-auto-update.md)
— the problem, the user stories, the implementation and testing decisions, the
seams, the offline invariants, and a provisional copy deck. The amendment to
the no-network contract is an ADR, which the spec asks for first.

**The spec's D6 and its provisional deck are superseded** by § Review decisions
below, which is what the UX review settled. Where the two disagree, this ticket
is the one being built.

## Related

- LC-47 deferred this and names the separate signing key.
- LC-257s (the GitHub star control) needs the same network path and follows it.

## Review decisions

Settled 2026-09-19, from the prototype at
[`docs/ux/prototypes/LC-256a-Auto-Update.html`](../../../docs/ux/prototypes/LC-256a-Auto-Update.html).
Each of these changes what D6 describes.

- **The notice lives in the sidebar footer, not on the gear.** The footer gains
  a line that always names the running version, and when an update is waiting
  it adds a dot in the human accent and an `Update` link. **The gear carries no
  mark at all**, which D6 asked for: with no Updates row left in the gear menu,
  a marked gear opened a menu that said nothing about updates.
- **The indicator appears twice.** The sidebar footer, and a dot on the
  `Updates` row of the settings panel's own side nav, so a panel opened for any
  other reason still shows it. Both are 6px, both the human accent, both
  decorative — the footer link and a visually-hidden line carry the words.
- **`Update` opens the pane, it does not update.** Pressing the footer link
  opens the settings panel with `Updates` selected; the release notes and the
  two presses are read there.
- **The gear menu loses two rows.** `Updates` was never added to it, and
  `Command line tool` is removed. Both panes are reached through the settings
  panel, so the gear menu stays about *this project* and the two app-level panes
  live in one place. This is a change to shipped behaviour (`SettingsMenu.tsx`),
  not only to new work.
- **No `Skip this version`.** The button is gone and with it the skipped state.
  This supersedes user story 6 and removes the only writer of D5's
  skipped-version preference field; **drop that field rather than storing one
  nothing sets.** With no way to decline, an available update stays announced
  in the footer until it is installed.
- **No ellipsis on any label.** The rule is now in
  [`docs/design/foundations/components.md`](../../../docs/design/foundations/components.md)
  § Do / don't. The dots survive only on an in-flight frame (`Checking…`,
  `Downloading…`, `Restarting…`), where they are a state rather than a promise
  of a dialog.
- **The check's timing sentence was factually wrong.** D5 runs the check after
  first paint *and* every 24 hours, so "after the app opens" read as
  launch-only. It now says both.
- **The toggle carries no device note.** `Check for updates automatically`
  stands alone. Worth knowing what went with it: the settings nav's foot says
  *stored in longclaw.yaml*, and this pane and `Command line` are the two that
  are not. Nothing on screen says so now.

## Copy deck

Settled. Every user-facing string the update path puts on screen or reads out
loud, including the ones no screen shows. `{version}`, `{age}`, `{date}`,
`{received}` and `{total}` are filled at render. The release notes shown in the
pane are **not** copy: they come from the manifest, which takes them from
`docs/release-notes` (D8).

| Id | Kind | Where | Text |
|---|---|---|---|
| `updates.nav.label` | nav row | Settings side nav, between Command line and Danger zone | Updates |
| `updates.nav.available` | visually-hidden | the Updates row in the settings nav, update waiting | An update is available |
| `updates.footer.version` | note | side panel footer, always | LongClaw {version} |
| `updates.footer.update` | link | side panel footer, update available | Update |
| `updates.footer.update.aria` | aria-label | the footer’s Update link | Update to LongClaw {version} |
| `updates.pane.version` | note | pane, first line | LongClaw {version} |
| `updates.pane.automatic.label` | toggle label | pane | Check for updates automatically |
| `updates.pane.automatic.note` | note | under the toggle | Once a day, and when the app opens. The check fetches one file from LongClaw’s GitHub release and sends nothing about you or your projects. |
| `updates.pane.check` | button | pane, opposite the version line | Check now |
| `updates.pane.checking` | frame | the same button, while a check runs | Checking… |
| `updates.pane.last` | note | pane, under the version line | Last checked {age} |
| `updates.pane.never` | note | pane, no successful check yet | Not checked yet |
| `updates.pane.uptodate` | note | pane, after a check | You’re on the latest version. |
| `updates.pane.available.title` | heading | pane, update pending | {version} is available |
| `updates.pane.available.date` | note | under the heading | Released {date} |
| `updates.pane.download` | button | pane, update pending — press 1 | Update |
| `updates.pane.progress` | frame | pane, during download | Downloading… {received} of {total} |
| `updates.pane.ready` | note | pane, download complete, above the restart button | Downloaded and verified. |
| `updates.pane.restart` | button | pane, download complete — press 2 | Restart to update |
| `updates.pane.restart.blocked` | note | beside the held restart button | Waiting for a save to finish. |
| `updates.pane.restarting` | frame | the restart button, after press 2 | Restarting… |
| `updates.pane.check.failed` | note | pane, check failed | Couldn’t check for updates. |
| `updates.pane.verify.failed` | refusal | pane | The download couldn’t be verified and was discarded. |
| `updates.pane.download.failed` | refusal | pane | The download didn’t finish. |
| `updates.pane.retry` | button | pane, after a failure | Try again |
| `updates.pane.downloadpage` | button | pane, after a failure | Open the download page |
| `updates.pane.unavailable` | note | pane, a build without an updater | This build can’t check for updates. That is what a npm run dev window looks like; an app built from the .dmg can. |
| `updates.live.available` | live region | announced once, when a check finds a version | LongClaw {version} is available. Open Settings, then Updates. |
| `updates.live.ready` | live region | announced once, when the download verifies | LongClaw {version} is downloaded. Restart to update. |
| `updates.live.blocked` | live region | on a refused restart | Restart is waiting for a save to finish. |

Three rows need their reasoning kept:

- `updates.pane.ready` — the spec announced the verified download only through
  the live region, so the pane had nothing visible saying the file was whole
  before the second press.
- `updates.pane.unavailable` — D10 wants the path to report itself unavailable
  the way `Command line` already does. The toggle and `Check now` are hidden in
  that state rather than disabled.
- `updates.live.blocked` — the held `Restart to update` is `aria-disabled`
  rather than `disabled`, so it keeps its tab stop and a press can announce the
  reason. A `disabled` button leaves the tab order and nobody hears why.

`Update` appears on the footer link and on the pane's first press, one step
before `Restart to update`. Confirmed in review; noted because three controls in
one flow carry the word and the first of them downloads rather than updates.

## Checklist

- [x] ADR: amend the no-network contract to a narrow, identifier-free update check <!-- longclaw:item=ck_e47d47ec -->
- [x] Generate the updater signing key pair and get the public half into the bundle <!-- longclaw:item=ck_27060633 -->
- [ ] Back the NEW updater private key and its password up off this machine and confirm both read back — the first pair's backup is worthless now <!-- longclaw:item=ck_bf4c8dd0 -->
- [x] Decide whether the updater key stays passwordless — settled 2026-09-19: it does not. The bare pair was discarded and replaced before anything shipped <!-- longclaw:item=ck_8a4d4d38 -->
- [x] Release shell exports TAURI_SIGNING_PRIVATE_KEY and its password from the keychain, signs for the committed public key, and refuses an empty password <!-- longclaw:item=ck_f85a62ac -->
- [ ] Dry run release:macos --no-build once, so the archive, signature and manifest steps have run before a real release depends on them <!-- longclaw:item=ck_0ec492d4 -->
- [ ] Run release:binary-audit against a signed bundle; the updater-key and manifest-signature checks have never run <!-- longclaw:item=ck_49b83bcf -->
- [x] Decide and document where the update manifest and artifacts are hosted <!-- longclaw:item=ck_83adaa6c -->
- [x] Wire the updater in Rust; the webview names an intent, never a URL <!-- longclaw:item=ck_0c3bfdb7 -->
- [x] IPC contract: the update DTO, its error reasons and the progress frames join the shared JSON fixture <!-- longclaw:item=ck_5d2c7f46 -->
- [x] Update capabilities/main.json, binary-audit.mjs and audit:network to assert the new narrow shape <!-- longclaw:item=ck_11a193e5 -->
- [x] Update docs/acceptance/release-candidate.md rows that certify no updater <!-- longclaw:item=ck_fa36173f -->
- [x] Revise the user guide's no-network sentences to the narrow shape <!-- longclaw:item=ck_0877db02 -->
- [ ] Revise the site's no-network sentences, in their own pull request, once the download longclaw.io offers is a version that has the check <!-- longclaw:item=ck_3ba05d6d -->
- [x] Extend release-macos.mjs to sign the update artifact and publish the manifest <!-- longclaw:item=ck_bb8dfd57 -->
- [x] Update UX: consent, what changed from the existing release notes, no silent restart <!-- longclaw:item=ck_010f03e9 -->
- [x] Sidebar footer names the running version, and gains a dot and an Update link when one is waiting <!-- longclaw:item=ck_d823993a -->
- [x] A dot on the settings nav's Updates row, so a panel opened for any other reason still shows it <!-- longclaw:item=ck_36bea4c4 -->
- [x] The Update link opens the Updates pane; it never starts the download itself <!-- longclaw:item=ck_882d2b0e -->
- [x] Refuse to restart while a ticket write is in flight <!-- longclaw:item=ck_55f6655e -->
- [x] Quiet failure for offline, blocked, bad-signature and corrupt-download cases <!-- longclaw:item=ck_a8ca9293 -->
- [x] Settings pane: turn it off, and check manually <!-- longclaw:item=ck_86fd9686 -->
- [x] Device preferences: an automatic-check flag and a last-check record, and no skipped-version field <!-- longclaw:item=ck_fb5c9a8d -->
- [x] Copy deck for every string, including the live region <!-- longclaw:item=ck_42b4fa8a -->
- [ ] Retire the prototype once its copy is in the source <!-- longclaw:item=ck_accacb47 -->
- [ ] Write the Updates pane's rows into keyboard-focus-map.md and re-pin the citations, so a11y:audit has an oracle to cite <!-- longclaw:item=ck_20c23547 -->
- [ ] Perf harness serves an available update behind a flag, so a11y:audit can drive the pane, the footer link and the held restart button <!-- longclaw:item=ck_91432a40 -->
- [ ] Run a11y:audit for the pane, the footer link and the held restart button; quote the run <!-- longclaw:item=ck_743cbe53 -->
- [x] Offline invariants: no existing code path calls the updater, and startup issues no request before first paint <!-- longclaw:item=ck_4bf45090 -->
- [x] Bounded single attempt off the main thread; no retry loop, no backoff <!-- longclaw:item=ck_80d7940d -->
- [x] A broken or absent updater configuration is a failed check, never a failed launch <!-- longclaw:item=ck_2fc77e43 -->
- [x] Regression proof: npm run verify green, and every existing test that changed names a behaviour that changed rather than accommodating the update path <!-- longclaw:item=ck_b71178f7 -->
- [x] Regression proof: every other operation survives a dead, hanging or absent updater <!-- longclaw:item=ck_ea629ace -->
- [ ] Regression proof: nothing outside the Updates pane changes when a check fails <!-- longclaw:item=ck_d03644b2 -->
- [ ] Run audit:network offline, and again online with the automatic check off; both must record zero connections; quote the runs <!-- longclaw:item=ck_027b4aa2 -->
- [ ] Re-run perf:startup against a built bundle; quote it unchanged <!-- longclaw:item=ck_9619080c -->
- [ ] Changelog entry for the release that ships this, through the changelog-entry skill <!-- longclaw:item=ck_35214e39 -->
- [ ] Tell LC-257s that its amended-contract item is answered by ADR 0014, and that D4's allowlist is the road it reuses <!-- longclaw:item=ck_bb34228b -->

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

<!-- longclaw:event
id: evt_16102dbf
kind: update
occurred_at: 2026-09-18T07:05:53.211Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: labels
    from: platform, release, product
    to: platform, release, product, ready-for-agent
  - field: description
-->
### Claude Code updated this ticket

Wrote the spec to docs/specs/LC-256a-auto-update.md and moved the ticket's design content there. The description now holds the problem and the link; the checklist is unchanged. Labelled ready-for-agent.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_f5f59b91
kind: update
occurred_at: 2026-09-18T08:07:05.558Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: description
  - field: checklist.ck_4bf45090.added
    to: "Offline invariants: no existing code path calls the updater, and startup issues no request before first paint"
  - field: checklist.ck_80d7940d.added
    to: Bounded single attempt off the main thread; no retry loop, no backoff
  - field: checklist.ck_2fc77e43.added
    to: A broken or absent updater configuration is a failed check, never a failed launch
  - field: checklist.ck_b71178f7.added
    to: "Regression proof: npm run verify green with no existing test rewritten to accommodate the update path"
  - field: checklist.ck_ea629ace.added
    to: "Regression proof: every other operation survives a dead, hanging or absent updater"
  - field: checklist.ck_d03644b2.added
    to: "Regression proof: nothing outside the Updates pane changes when a check fails"
  - field: checklist.ck_027b4aa2.added
    to: Run audit:network offline, and again online with the automatic check off; both must record zero connections; quote the runs
  - field: checklist.ck_9619080c.added
    to: Re-run perf:startup against a built bundle; quote it unchanged
-->
### Claude Code updated this ticket

Made the offline guarantee explicit at the user's request. The spec gains D10, a set of offline invariants: no existing code path calls the updater, startup issues no request before first paint, a request is one bounded attempt off the main thread with no retry loop, a failed check is not a state the app carries outside the pane, losing the network mid-download discards the download and leaves the installed bundle untouched, and a broken updater configuration is a failed check rather than a failed launch. Testing Decisions gains a section that proves each one, including that the existing gate passes with no test rewritten. Six user stories were added for the offline person, the flaky network, the plane, and the dev window. Eight checklist items here carry the same ground.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_b50151ea
kind: update
occurred_at: 2026-09-18T08:18:12.572Z
actor:
  type: human
  id: local
changes:
  - field: estimate
    to: "3"
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_a39f0bb9
kind: update
occurred_at: 2026-09-19T00:19:55.152Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: description
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_2cf63034
kind: update
occurred_at: 2026-09-19T00:22:07.254Z
actor:
  type: human
  id: local
changes:
  - field: status
    from: todo
    to: in_progress
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_41102740
kind: comment
occurred_at: 2026-09-19T00:50:18.144Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Split out: LC-261h removes `Command line tool` from the gear menu. That half of the review changes behaviour that shipped in 0.1.0, so it carries its own ticket rather than riding inside this one.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_2c927394
kind: update
occurred_at: 2026-09-19T01:13:05.566Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_42b4fa8a.checked
    from: "false"
    to: "true"
  - field: checklist.ck_5d2c7f46.added
    to: "IPC contract: the update DTO, its error reasons and the progress frames join the shared JSON fixture"
  - field: checklist.ck_fb5c9a8d.added
    to: "Device preferences: an automatic-check flag and a last-check record, and no skipped-version field"
  - field: checklist.ck_d823993a.added
    to: Sidebar footer names the running version, and gains a dot and an Update link when one is waiting
  - field: checklist.ck_36bea4c4.added
    to: A dot on the settings nav's Updates row, so a panel opened for any other reason still shows it
  - field: checklist.ck_882d2b0e.added
    to: The Update link opens the Updates pane; it never starts the download itself
  - field: checklist.ck_accacb47.added
    to: Retire the prototype once its copy is in the source
  - field: checklist.ck_0877db02.added
    to: Revise the user guide and the site's no-network sentences to the narrow shape
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_f0bf066a
kind: update
occurred_at: 2026-09-19T01:13:48.546Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_743cbe53.text
    from: Run a11y:audit and probe:header; quote the runs
    to: Run a11y:audit for the pane, the footer link and the held restart button; quote the run
  - field: checklist.ck_5d2c7f46.moved
    from: "22"
    to: "5"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_3f3148ab
kind: update
occurred_at: 2026-09-19T01:13:48.568Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_fb5c9a8d.moved
    from: "23"
    to: "13"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_6d755cec
kind: update
occurred_at: 2026-09-19T01:13:48.587Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_d823993a.moved
    from: "24"
    to: "10"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_800d94d3
kind: update
occurred_at: 2026-09-19T01:13:48.605Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_36bea4c4.moved
    from: "25"
    to: "11"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_e24b99d9
kind: update
occurred_at: 2026-09-19T01:13:48.621Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_882d2b0e.moved
    from: "26"
    to: "12"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_ab3a6805
kind: update
occurred_at: 2026-09-19T01:13:48.638Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_accacb47.moved
    from: "27"
    to: "18"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_30fafd62
kind: update
occurred_at: 2026-09-19T01:13:48.658Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_0877db02.moved
    from: "28"
    to: "8"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_0084312f
kind: update
occurred_at: 2026-09-19T02:00:09.697Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_e47d47ec.checked
    from: "false"
    to: "true"
  - field: checklist.ck_83adaa6c.checked
    from: "false"
    to: "true"
  - field: checklist.ck_0c3bfdb7.checked
    from: "false"
    to: "true"
  - field: checklist.ck_5d2c7f46.checked
    from: "false"
    to: "true"
  - field: checklist.ck_11a193e5.checked
    from: "false"
    to: "true"
  - field: checklist.ck_fa36173f.checked
    from: "false"
    to: "true"
  - field: checklist.ck_bb8dfd57.checked
    from: "false"
    to: "true"
  - field: checklist.ck_010f03e9.checked
    from: "false"
    to: "true"
  - field: checklist.ck_d823993a.checked
    from: "false"
    to: "true"
  - field: checklist.ck_36bea4c4.checked
    from: "false"
    to: "true"
  - field: checklist.ck_882d2b0e.checked
    from: "false"
    to: "true"
  - field: checklist.ck_55f6655e.checked
    from: "false"
    to: "true"
  - field: checklist.ck_a8ca9293.checked
    from: "false"
    to: "true"
  - field: checklist.ck_86fd9686.checked
    from: "false"
    to: "true"
  - field: checklist.ck_fb5c9a8d.checked
    from: "false"
    to: "true"
  - field: checklist.ck_4bf45090.checked
    from: "false"
    to: "true"
  - field: checklist.ck_80d7940d.checked
    from: "false"
    to: "true"
  - field: checklist.ck_2fc77e43.checked
    from: "false"
    to: "true"
  - field: checklist.ck_ea629ace.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_ba583aaf
kind: comment
occurred_at: 2026-09-19T02:00:33.411Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Implemented, with `npm run verify` green. What landed:

ADR 0014 records the amendment: one identifier-free GET for one static manifest, two named hosts, off by one control, and the offline invariants D10 asks for.

Rust. `update.rs` holds the decisions behind a port — `Updater`, `Clock` and the count of writes in flight are injected — so the suite drives every state without a network; `update_plugin.rs` is the Tauri adapter. Four intent commands, all `async` over `spawn_blocking`, so nothing that draws a frame waits on a socket. Progress crosses on a channel; failures cross as ADR 0010's shape with a `reason` from a closed set. A check is one bounded attempt per 24-hour slot, with no retry: a failed check makes exactly one request and none afterwards, against an injected clock. The restart guard reads a count kept around `atomic_write` and `atomic_replace`, and `tests/update_offline.rs` proves the refusal from inside the replace window itself.

Frontend. A new `Updates` pane beside `Command line`, the sidebar footer's version line with its dot and `Update` link, and a dot on the nav's own row. Every string comes from `updates.ts`, which is the settled deck; nothing user-facing is typed in a component. Two device preferences — the automatic flag and the last successful check — and no skipped-version field, since the review removed the only thing that would have written one.

Gates. All three rewritten to assert the narrow shape rather than deleted, each with a self-test that goes red on the pre-amendment claim and on a too-broad new one. The static audit's forbidden-crate list became an allowlist — every network-capable crate must arrive under `tauri-plugin-updater` — which is stricter than what it replaced. The binary audit enumerates the socket API and the network frameworks as exact sets. The runtime audit gains a third phase, a sanctioned-peer classifier that refuses the same peer from a WebKit helper, and control C6, which requires the check to have been *observed* in the online phase.

Four things did not land, and each is a real gap rather than an oversight:

1. **The updater key is not generated.** It needs the release machine's keychain and a backup the account holder holds; the runbook now has the section and the empty pubkey is what makes a build report the update path unavailable rather than offering a download it could never verify.
2. **The site's no-network sentences are unchanged**, which is the spec's own rule: they change in their own pull request once the download the site offers is the version that has the check. The user guide, which describes the app being built, is updated.
3. **Three existing tests changed**, so the "no test rewritten" item stays unchecked. Each marks a behaviour that changed rather than an accommodation: `ProjectSettings.test.tsx` gains `Updates` to the nav's expected list, and `SettingsMenu.test.tsx` turns its single deliberate omission into a list of two — the gear offers neither `Danger zone` nor `Updates`.
4. **`a11y:audit` and `probe:header` are green and do not cover the new surfaces.** 140/140 header checks and Part A's six rows pass, which says nothing regressed; neither has a row driving the Updates pane, the footer link or the held restart button, and writing one needs the perf harness to serve an available update.

`audit:network` in all three phases and `perf:startup` need a built, signed bundle and a person, so they stay open.

One deviation from D9 worth reading. The CLI now links `Security.framework` and `SystemConfiguration.framework`, because both binaries are built from one `longclaw_desktop_lib` on purpose (ADR 0011) and `security-framework-sys` declares its links whether or not a caller reaches them. It imports **no socket call at all**, which is the claim that matters and is stronger evidence than the framework line ever was; the binary audit asserts the empty set for it explicitly.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_fc08e2a8
kind: update
occurred_at: 2026-09-19T12:10:07.772Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_0877db02.checked
    from: "false"
    to: "true"
  - field: checklist.ck_0877db02.text
    from: Revise the user guide and the site's no-network sentences to the narrow shape
    to: Revise the user guide's no-network sentences to the narrow shape
  - field: checklist.ck_3ba05d6d.added
    to: Revise the site's no-network sentences, in their own pull request, once the download longclaw.io offers is a version that has the check
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_67dedf5d
kind: update
occurred_at: 2026-09-19T12:10:07.805Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_3ba05d6d.moved
    from: "29"
    to: "9"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_b16534b9
kind: update
occurred_at: 2026-09-19T12:25:51.473Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_27060633.checked
    from: "false"
    to: "true"
  - field: checklist.ck_b71178f7.checked
    from: "false"
    to: "true"
  - field: checklist.ck_b71178f7.text
    from: "Regression proof: npm run verify green with no existing test rewritten to accommodate the update path"
    to: "Regression proof: npm run verify green, and every existing test that changed names a behaviour that changed rather than accommodating the update path"
  - field: checklist.ck_bf4c8dd0.added
    to: Private updater key into the login keychain, the generated file deleted, and the backup confirmed readable — a prerequisite to shipping, not a follow-up
  - field: checklist.ck_f85a62ac.added
    to: Export TAURI_SIGNING_PRIVATE_KEY and its password in the release shell, and do one dry run of release:macos --no-build
  - field: checklist.ck_49b83bcf.added
    to: Run release:binary-audit against a signed bundle; the updater-key and manifest-signature checks have never run
  - field: checklist.ck_20c23547.added
    to: Write the Updates pane's rows into keyboard-focus-map.md and re-pin the citations, so a11y:audit has an oracle to cite
  - field: checklist.ck_91432a40.added
    to: Perf harness serves an available update behind a flag, so a11y:audit can drive the pane, the footer link and the held restart button
  - field: checklist.ck_35214e39.added
    to: Changelog entry for the release that ships this, through the changelog-entry skill
  - field: checklist.ck_bb34228b.added
    to: Tell LC-257s that its amended-contract item is answered by ADR 0014, and that D4's allowlist is the road it reuses
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_2e4a890b
kind: update
occurred_at: 2026-09-19T12:26:09.051Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_bf4c8dd0.moved
    from: "30"
    to: "3"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_9c41bb2f
kind: update
occurred_at: 2026-09-19T12:26:22.744Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_f85a62ac.moved
    from: "31"
    to: "4"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_032e398c
kind: update
occurred_at: 2026-09-19T12:26:22.769Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_49b83bcf.moved
    from: "32"
    to: "5"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_75bf9de7
kind: update
occurred_at: 2026-09-19T12:26:22.791Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_20c23547.moved
    from: "33"
    to: "24"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_d1299c8c
kind: update
occurred_at: 2026-09-19T12:26:22.812Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_91432a40.moved
    from: "34"
    to: "25"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_5230183c
kind: update
occurred_at: 2026-09-19T12:41:34.447Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_bf4c8dd0.text
    from: Private updater key into the login keychain, the generated file deleted, and the backup confirmed readable — a prerequisite to shipping, not a follow-up
    to: Back the updater private key up off this machine and confirm the backup reads back — the keychain is on one Mac, and that Mac dying is what the backup is for
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_93f22fd0
kind: update
occurred_at: 2026-09-19T12:41:34.476Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_f85a62ac.checked
    from: "false"
    to: "true"
  - field: checklist.ck_f85a62ac.text
    from: Export TAURI_SIGNING_PRIVATE_KEY and its password in the release shell, and do one dry run of release:macos --no-build
    to: Release shell exports TAURI_SIGNING_PRIVATE_KEY from the keychain and signs for the committed public key; the key carries no password, so its variable is empty
  - field: checklist.ck_0ec492d4.added
    to: Dry run release:macos --no-build once, so the archive, signature and manifest steps have run before a real release depends on them
  - field: checklist.ck_8a4d4d38.added
    to: Decide whether the updater key stays passwordless — the keychain is its only protection, and a password cannot be added to an existing key. Free to change until the first release
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_e9eb8f8f
kind: update
occurred_at: 2026-09-19T12:41:45.720Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_0ec492d4.moved
    from: "37"
    to: "5"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_94a588e9
kind: update
occurred_at: 2026-09-19T12:41:45.742Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_8a4d4d38.moved
    from: "38"
    to: "4"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_c82b3afc
kind: update
occurred_at: 2026-09-19T12:57:15.983Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_bf4c8dd0.text
    from: Back the updater private key up off this machine and confirm the backup reads back — the keychain is on one Mac, and that Mac dying is what the backup is for
    to: Back the NEW updater private key and its password up off this machine and confirm both read back — the first pair's backup is worthless now
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_79c5800d
kind: update
occurred_at: 2026-09-19T12:57:23.861Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_8a4d4d38.checked
    from: "false"
    to: "true"
  - field: checklist.ck_8a4d4d38.text
    from: Decide whether the updater key stays passwordless — the keychain is its only protection, and a password cannot be added to an existing key. Free to change until the first release
    to: "Decide whether the updater key stays passwordless — settled 2026-09-19: it does not. The bare pair was discarded and replaced before anything shipped"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_c7bc07dd
kind: update
occurred_at: 2026-09-19T12:57:23.883Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_f85a62ac.text
    from: Release shell exports TAURI_SIGNING_PRIVATE_KEY from the keychain and signs for the committed public key; the key carries no password, so its variable is empty
    to: Release shell exports TAURI_SIGNING_PRIVATE_KEY and its password from the keychain, signs for the committed public key, and refuses an empty password
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->
