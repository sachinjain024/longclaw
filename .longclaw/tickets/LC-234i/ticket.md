---
format: longclaw.ticket/v1
id: 294421e9-0eb5-4d37-bc99-bd000d0da05f
key: LC-234i
title: Make the first release and Point the Download CTA at a real release
status: in_progress
priority: p1
labels:
  - release
  - product
type: chore
created_at: 2026-08-25T07:33:13.529Z
updated_at: 2026-09-14T06:39:10.637Z
---

Cut LongClaw 0.1.0 — the first public release — and make every **Download for
Mac** button on longclaw.io reach it. The button currently points at
`https://github.com/sachinjain024/longclaw/releases`, which has no release, so a
visitor who clicks the hero, the closing CTA, the site header on any route, the
docs Getting started page or the announcement post lands on an empty page.

This is the last thing standing between the site being live and the site being
useful. It was split out of LC-205, whose implementation half is done and
deployed.

## What has changed since this ticket was filed

Three of the four things that gated it are now done, and one decision has been
taken. The original checklist predates all of it.

- **The acceptance blockers are cleared.** All three named in
  [the 2026-08-04 record](../../docs/acceptance/final-acceptance-2026-08-04.md)
  closed on 2026-08-05, and that record's own header says so. Only the `status:
  draft` marker on `docs/release-notes/v0.1.0.md` is still standing, and it is
  now describing a state that no longer exists.
- **The build is signed and notarized.** LC-47 shipped on 2026-09-11
  ([record](../../docs/acceptance/signed-notarized-2026-09-11.md)). Gatekeeper
  accepts a quarantined DMG as `Notarized Developer ID` with Apple unreachable.
  The release path is `npm run release:macos`; the
  [signing runbook](../../docs/release-signing-runbook.md) is the reference.
- **The unsigned branch of the gate is retired.**
  `release-candidate.md` § macOS signing and packaging now asks for the signed
  row, and says the Gatekeeper walkthrough is to be *deleted* from the user
  documentation rather than softened. The website still carries the unsigned
  version of it.
- **Where the download lives is decided** (2026-09-14), closing open item 2 in
  `docs/design/website-content-brief.md` §7 — see below.

## The decision: both a release and a site-hosted download

The GitHub release is the canonical record — tag, notes, `sha256`, source
tarballs. The **CTA does not point at it.** The same `.dmg` is committed to
`apps/website/public/downloads/` and every Download button links straight to
`https://longclaw.io/downloads/LongClaw_0.1.0_aarch64.dmg`.

Two reasons, and neither is cosmetic:

- **One click rather than two.** A releases tag page is a list of artefacts, a
  changelog and a source tarball; the person who clicked *Download for Mac* has
  already said which of those they want.
- **It survives LC-204.** Transferring the repository to `the.infin8y` moves
  every `github.com/sachinjain024/…` URL behind a redirect that GitHub owns and
  can stop honouring. `longclaw.io` is ours.

The cost is ~4.5 MB of binary in git per release, and GitHub Pages' 100 GB/month
bandwidth soft limit. Both are accepted for v0; revisit at the release where
either bites.

## The build the release ships is not the build that was notarized

The 2026-09-11 record describes `88311ce`. `apps/desktop` has moved since —
the vite 8 bump, LC-241q's comment editing, LC-249a's CLI-offer copy — so that
record no longer describes what would ship, and the DMG sitting in
`target/release/bundle/dmg/` is an unsigned rebuild (`sha256 1e48914b…`, no
stapled ticket) rather than the notarized artefact. **Everything is rebuilt,
re-signed and re-notarized from the release tree**, and a new dated acceptance
record replaces the citation.

Because none of the documentation work below touches `apps/desktop`, the tree
that produced the DMG is identical to the tree the release tag names. The record
pins `git rev-parse <commit>:apps/desktop` so that claim is checkable rather
than asserted.

## Plan

**Phase 1 — make the record true, before building anything.** The build has to
be cut from the commit whose prose describes it.

Release notes lift the draft marker and gain the signing section, comment
editing and the CLI-offer copy. The changelog entry is re-derived from them —
it is the published form of that file, not a second account — and its date
becomes the date the release is actually cut rather than 2026-08-22. Getting
started loses the four-step System Settings walkthrough entirely and gains the
one-dialog flow. The announcement post loses *"The build is also unsigned"*.
The content brief records the hosting decision and drops the two constraints
that have expired. `changelog-entry/SKILL.md` carries a "do not publish ahead of
the release" gate written against the draft marker and the GitHub CTA; both
premises change here.

**Phase 2 — build, sign, notarize, prove.** `release:macos` end to end, then the
automated gate: `binary-audit`, `gatekeeper-check --phase online`, `matrix`,
`a11y:audit`, `perf:rust`, `perf:board`, `perf:list`. Numbers get quoted, not
summarised.

**Phase 3 — the evidence.** A new `docs/acceptance/release-2026-09-14.md`
carrying build identity (revision, `apps/desktop` tree hash, app CDHash, DMG
sha256, notary submission ids), every automated result, and an explicit list of
what it does not prove. Three rows need a person and are named as open:
`gatekeeper-check --phase offline` (needs the network off), `audit:network` in
both phases (needs someone driving the app), and the first-launch dialog
confirmed by hand.

**Phase 4 — publish.** The stapled DMG is copied into the website's public
downloads, `SITE.download` is added beside `SITE.releases`, the five CTA call
sites and the `SoftwareApplication` `downloadUrl` move to it, `site:verify`
passes, the branch merges, and the release is cut at the merge commit with the
DMG attached.

## Acceptance

- Clicking **Download for Mac** from any page — hero, closing CTA, site header
  on every route, docs Getting started, announcement post — downloads a real
  `.dmg` in one click.
- The filename and `sha256` on the site match the asset attached to the release,
  and both match the artefact the acceptance record pins.
- The release notes are no longer marked draft, and no page still describes the
  build as unsigned or routes a reader through System Settings.
- `npm run verify` and `npm run site:verify` both pass at the release commit.

## Checklist


- [x] P1 · Release notes: lift the status: draft marker and the draft banner from docs/release-notes/v0.1.0.md <!-- longclaw:item=ck_25fce201 -->
- [x] P1 · Release notes: replace the unsigned story with the signed-and-notarized one — expect one dialog, not none <!-- longclaw:item=ck_e8a907d0 -->
- [x] P1 · Release notes: add what landed after they were written — comment edit/withdraw (LC-241q), the CLI offer that explains itself (LC-249a) <!-- longclaw:item=ck_35334b6c -->
- [x] P1 · Changelog: re-derive apps/website/src/content/changelog/0.1.0.md from the release notes, and date it the day the release is cut <!-- longclaw:item=ck_7667947b -->
- [x] P1 · Getting started: delete the four-step System Settings walkthrough and write the one-dialog notarized flow in its place <!-- longclaw:item=ck_a13642c7 -->
- [ ] P1 · Getting started: point Download at the site-hosted .dmg and name its sha256 <!-- longclaw:item=ck_b0ed899b -->
- [x] P1 · Blog: drop 'The build is also unsigned' from introducing-longclaw.mdx <!-- longclaw:item=ck_e7d815be -->
- [ ] P1 · Content brief: record the download-hosting decision in §7 and drop the two expired constraints in §6 <!-- longclaw:item=ck_8cb3f8bb -->
- [x] P1 · changelog-entry skill: rewrite the 'do not publish ahead of the release' gate — both its premises change here <!-- longclaw:item=ck_6b4300ee -->
- [ ] P1 · release-candidate.md: add this candidate to the table at the top of the gate <!-- longclaw:item=ck_09cb95d6 -->
- [ ] P2 · npm run verify passes at the release tree <!-- longclaw:item=ck_d7a501b2 -->
- [ ] P2 · APPLE_SIGNING_IDENTITY set; npm run release:macos builds, signs, notarizes and staples both artefacts <!-- longclaw:item=ck_5bb01908 -->
- [ ] P2 · npm run release:binary-audit passes on the .app and the DMG <!-- longclaw:item=ck_c2a8af66 -->
- [ ] P2 · npm run release:gatekeeper-check -- --phase online passes on a quarantined copy <!-- longclaw:item=ck_fdc8b380 -->
- [ ] P2 · matrix, a11y:audit, perf:rust, perf:board and perf:list run; quote the numbers <!-- longclaw:item=ck_d68aeefd -->
- [ ] P3 · Write docs/acceptance/release-2026-09-14.md — revision, apps/desktop tree hash, CDHash, DMG sha256, notary ids, every result <!-- longclaw:item=ck_5562d313 -->
- [ ] P3 · Record the three rows that need a person as open: gatekeeper --phase offline, audit:network offline and online, first launch by hand <!-- longclaw:item=ck_bada4fe4 -->
- [ ] P4 · Commit the stapled DMG to apps/website/public/downloads/LongClaw_0.1.0_aarch64.dmg <!-- longclaw:item=ck_fd9d0591 -->
- [ ] P4 · Add SITE.download and SITE.downloadSha256 beside SITE.releases in apps/website/src/lib/site.ts <!-- longclaw:item=ck_96567d72 -->
- [ ] P4 · Move all five CTA call sites and the SoftwareApplication downloadUrl onto SITE.download <!-- longclaw:item=ck_fe42ee61 -->
- [ ] P4 · Point SITE.releases at the v0.1.0 tag rather than the releases index <!-- longclaw:item=ck_a7054d67 -->
- [ ] P4 · npm run site:verify passes; open the built site and follow every Download button <!-- longclaw:item=ck_24e8f3db -->
- [ ] P4 · Merge the branch, tag v0.1.0 at the merge commit, cut the GitHub release with the same DMG bytes attached <!-- longclaw:item=ck_5c21fae2 -->
- [ ] P4 · Confirm the live longclaw.io download serves the .dmg and its sha256 still matches <!-- longclaw:item=ck_3180c64e -->
## Activity

<!-- longclaw:event
id: evt_d351ec19
kind: create
occurred_at: 2026-08-25T07:33:13.529Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_1e4e34fe
kind: update
occurred_at: 2026-09-09T06:47:21.623Z
actor:
  type: human
  id: local
changes:
  - field: type
    to: chore
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_b61a28c9
kind: update
occurred_at: 2026-09-13T02:30:07.426Z
actor:
  type: human
  id: local
changes:
  - field: title
    from: Point the Download CTA at a real release
    to: Make the first release and Point the Download CTA at a real release
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_e0c3a86a
kind: update
occurred_at: 2026-09-14T05:42:40.189Z
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
id: evt_071ee6a0
kind: update
occurred_at: 2026-09-14T05:42:40.212Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_e04eb4b9.removed
    from: Clear the 0.1.0 acceptance blockers and lift the draft marker from the release notes
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_71383d05
kind: update
occurred_at: 2026-09-14T05:42:40.231Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_a728e7d1.removed
    from: Cut the GitHub release with LongClaw_0.1.0_aarch64.dmg attached and release:binary-audit passing
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_5b92035b
kind: update
occurred_at: 2026-09-14T05:42:40.250Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_41307b1a.removed
    from: Point SITE.releases at the release rather than the releases index
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_7d6e918f
kind: update
occurred_at: 2026-09-14T05:42:40.270Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_ccb48b5e.removed
    from: Re-read Getting started and the 0.1.0 changelog entry against the published release
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_3d1930d7
kind: update
occurred_at: 2026-09-14T05:42:56.129Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_25fce201.added
    to: "P1 · Release notes: lift the status: draft marker and the draft banner from docs/release-notes/v0.1.0.md"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_0e754398
kind: update
occurred_at: 2026-09-14T05:42:56.153Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_e8a907d0.added
    to: "P1 · Release notes: replace the unsigned story with the signed-and-notarized one — expect one dialog, not none"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_478e2eb4
kind: update
occurred_at: 2026-09-14T05:42:56.176Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_35334b6c.added
    to: "P1 · Release notes: add what landed after they were written — comment edit/withdraw (LC-241q), the CLI offer that explains itself (LC-249a)"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_4aec4af6
kind: update
occurred_at: 2026-09-14T05:42:56.200Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_7667947b.added
    to: "P1 · Changelog: re-derive apps/website/src/content/changelog/0.1.0.md from the release notes, and date it the day the release is cut"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_b15cd93e
kind: update
occurred_at: 2026-09-14T05:42:56.221Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_a13642c7.added
    to: "P1 · Getting started: delete the four-step System Settings walkthrough and write the one-dialog notarized flow in its place"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_5f3c0bcb
kind: update
occurred_at: 2026-09-14T05:42:56.243Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_b0ed899b.added
    to: "P1 · Getting started: point Download at the site-hosted .dmg and name its sha256"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_e9cf1133
kind: update
occurred_at: 2026-09-14T05:42:56.267Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_e7d815be.added
    to: "P1 · Blog: drop 'The build is also unsigned' from introducing-longclaw.mdx"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_7fcaf105
kind: update
occurred_at: 2026-09-14T05:42:56.287Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_8cb3f8bb.added
    to: "P1 · Content brief: record the download-hosting decision in §7 and drop the two expired constraints in §6"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_8151c7e0
kind: update
occurred_at: 2026-09-14T05:42:56.309Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_6b4300ee.added
    to: "P1 · changelog-entry skill: rewrite the 'do not publish ahead of the release' gate — both its premises change here"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_49c4f7f7
kind: update
occurred_at: 2026-09-14T05:42:56.327Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_09cb95d6.added
    to: "P1 · release-candidate.md: add this candidate to the table at the top of the gate"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_f4eaa4e4
kind: update
occurred_at: 2026-09-14T05:42:56.347Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_d7a501b2.added
    to: P2 · npm run verify passes at the release tree
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_efdcc03c
kind: update
occurred_at: 2026-09-14T05:42:56.367Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_5bb01908.added
    to: P2 · APPLE_SIGNING_IDENTITY set; npm run release:macos builds, signs, notarizes and staples both artefacts
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_f7e70964
kind: update
occurred_at: 2026-09-14T05:42:56.387Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_c2a8af66.added
    to: P2 · npm run release:binary-audit passes on the .app and the DMG
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_efb97a38
kind: update
occurred_at: 2026-09-14T05:42:56.407Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_fdc8b380.added
    to: P2 · npm run release:gatekeeper-check -- --phase online passes on a quarantined copy
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_bdb99ad3
kind: update
occurred_at: 2026-09-14T05:42:56.430Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_d68aeefd.added
    to: P2 · matrix, a11y:audit, perf:rust, perf:board and perf:list run; quote the numbers
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_244f728b
kind: update
occurred_at: 2026-09-14T05:42:56.454Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_5562d313.added
    to: P3 · Write docs/acceptance/release-2026-09-14.md — revision, apps/desktop tree hash, CDHash, DMG sha256, notary ids, every result
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_4a7d4914
kind: update
occurred_at: 2026-09-14T05:42:56.478Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_bada4fe4.added
    to: "P3 · Record the three rows that need a person as open: gatekeeper --phase offline, audit:network offline and online, first launch by hand"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_17f6c552
kind: update
occurred_at: 2026-09-14T05:42:56.501Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_fd9d0591.added
    to: P4 · Commit the stapled DMG to apps/website/public/downloads/LongClaw_0.1.0_aarch64.dmg
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_e674890d
kind: update
occurred_at: 2026-09-14T05:42:56.525Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_96567d72.added
    to: P4 · Add SITE.download and SITE.downloadSha256 beside SITE.releases in apps/website/src/lib/site.ts
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_e5f49aa6
kind: update
occurred_at: 2026-09-14T05:42:56.555Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_fe42ee61.added
    to: P4 · Move all five CTA call sites and the SoftwareApplication downloadUrl onto SITE.download
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_14be6493
kind: update
occurred_at: 2026-09-14T05:42:56.574Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_a7054d67.added
    to: P4 · Point SITE.releases at the v0.1.0 tag rather than the releases index
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_bace9821
kind: update
occurred_at: 2026-09-14T05:42:56.601Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_24e8f3db.added
    to: P4 · npm run site:verify passes; open the built site and follow every Download button
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_5cff6594
kind: update
occurred_at: 2026-09-14T05:42:56.624Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_5c21fae2.added
    to: P4 · Merge the branch, tag v0.1.0 at the merge commit, cut the GitHub release with the same DMG bytes attached
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_ef838f47
kind: update
occurred_at: 2026-09-14T05:42:56.651Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_3180c64e.added
    to: P4 · Confirm the live longclaw.io download serves the .dmg and its sha256 still matches
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_e148a405
kind: update
occurred_at: 2026-09-14T05:43:29.484Z
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
id: evt_0a7ad991
kind: update
occurred_at: 2026-09-14T06:00:22.722Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_25fce201.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_9683ea8b
kind: update
occurred_at: 2026-09-14T06:00:22.755Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_e8a907d0.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_dd7e3e00
kind: update
occurred_at: 2026-09-14T06:00:22.777Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_35334b6c.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_eabcee0c
kind: comment
occurred_at: 2026-09-14T06:00:22.799Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

P1 release notes done. Draft marker lifted (status: published, milestone M6 — Release); § Installing it written for the signed-and-notarized build — one dialog, the two failure messages that mean the copy is not this one, and drag-to-Applications; a comments bullet added for LC-241q (reword/withdraw, your own only, enforced in Rust); the CLI section updated for LC-249a (the offer argues for itself first, Ask again, Try again) and corrected from 'Project settings' to the 'Settings › Command line' the app actually says. One paragraph was cut as a duplicate of an existing bullet. citations:check clean.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_bdedb225
kind: update
occurred_at: 2026-09-14T06:39:10.537Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_7667947b.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_39e07c35
kind: update
occurred_at: 2026-09-14T06:39:10.573Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_a13642c7.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_68c72a25
kind: update
occurred_at: 2026-09-14T06:39:10.607Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_e7d815be.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_3b3d3b12
kind: update
occurred_at: 2026-09-14T06:39:10.637Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_6b4300ee.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_e5571633
kind: comment
occurred_at: 2026-09-14T06:39:20.534Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

P1 website copy done: changelog re-derived from the release notes (comments, the CLI, signing; date 2026-08-22 → 2026-09-14; limitations widened from 3 of the release notes' 6 to 5), Getting started's four-step System Settings walkthrough replaced by the one-dialog notarized flow, the announcement post's 'the build is also unsigned' replaced and moved out of § What is deliberately not here, and the changelog-entry skill's publish gate rewritten — it asked whether the release notes were draft, which is now always no.

Two things found while in there, both fixed: the announcement post says '0.1.0 is out today' and was dated 2026-08-22, three weeks before the release it announces; and apps/website/README.md's honesty-constraints rule still read 'The build is unsigned and the docs say so', which is the rule every future website change is checked against.

site:verify passes — astro check 0/0/0, 15 pages. Getting started's Download section and the blog footer button still point at GitHub Releases; both move in P4 with SITE.download.
<!-- /longclaw:event -->
