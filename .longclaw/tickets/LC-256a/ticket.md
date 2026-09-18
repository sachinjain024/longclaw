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
  - ready-for-agent
type: feature
created_at: 2026-09-16T07:40:42.050Z
updated_at: 2026-09-18T08:07:05.558Z
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

## Related

- LC-47 deferred this and names the separate signing key.
- LC-257s (the GitHub star control) needs the same network path and follows it.

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
