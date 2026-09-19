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
updated_at: 2026-09-19T00:22:07.254Z
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
- [ ] Offline invariants: no existing code path calls the updater, and startup issues no request before first paint <!-- longclaw:item=ck_4bf45090 -->
- [ ] Bounded single attempt off the main thread; no retry loop, no backoff <!-- longclaw:item=ck_80d7940d -->
- [ ] A broken or absent updater configuration is a failed check, never a failed launch <!-- longclaw:item=ck_2fc77e43 -->
- [ ] Regression proof: npm run verify green with no existing test rewritten to accommodate the update path <!-- longclaw:item=ck_b71178f7 -->
- [ ] Regression proof: every other operation survives a dead, hanging or absent updater <!-- longclaw:item=ck_ea629ace -->
- [ ] Regression proof: nothing outside the Updates pane changes when a check fails <!-- longclaw:item=ck_d03644b2 -->
- [ ] Run audit:network offline, and again online with the automatic check off; both must record zero connections; quote the runs <!-- longclaw:item=ck_027b4aa2 -->
- [ ] Re-run perf:startup against a built bundle; quote it unchanged <!-- longclaw:item=ck_9619080c -->

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
