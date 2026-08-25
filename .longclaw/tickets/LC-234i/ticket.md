---
format: longclaw.ticket/v1
id: 294421e9-0eb5-4d37-bc99-bd000d0da05f
key: LC-234i
title: Point the Download CTA at a real release
status: todo
priority: p1
labels:
  - release
  - product
created_at: 2026-08-25T07:33:13.529Z
updated_at: 2026-08-25T07:33:13.529Z
---

The **Download for Mac** button on longclaw.io points at
`https://github.com/sachinjain024/longclaw/releases`, which has no release. Every
page carries it — the hero, the closing CTA, the site header on every route, the
docs Getting started page, and the announcement blog post — so a visitor who
clicks anywhere lands on an empty page.

This is the last thing standing between the site being live and the site being
useful. It was split out of LC-205, whose implementation half is done and
deployed.

## Why it is not just a link change

The link is correct; the release is missing. Three things gate it:

- **The 0.1.0 release notes are still draft.** `docs/release-notes/v0.1.0.md`
  opens with a block saying so and names the acceptance blockers still open.
  Publishing a download before those clear would ship a build the acceptance
  record does not vouch for.
- **The build is unsigned.** That is a recorded decision for v0, and the site
  already documents the Gatekeeper route honestly in Getting started. LC-47
  (signing and notarization) is now in progress and may change what the CTA
  should say.
- **The asset name is already published.** Getting started and the changelog
  both name `LongClaw_0.1.0_aarch64.dmg`. The release asset has to match, or the
  docs become wrong the moment someone follows them.

## What to do

1. Clear the acceptance blockers and lift the draft marker from the release
   notes.
2. Cut the GitHub release with `LongClaw_0.1.0_aarch64.dmg` attached, built so
   `codesign --verify --deep --strict` passes — `npm run release:binary-audit`
   checks exactly this.
3. Point `SITE.releases` in `apps/website/src/lib/site.ts` at the release rather
   than the releases index, so the button lands on the download and not a list.
4. Re-read Getting started and the 0.1.0 changelog entry against the release as
   published, and fix any drift.

## Acceptance

- Clicking **Download for Mac** from any page reaches a page offering a real
  `.dmg`.
- The filename on the site matches the asset.
- The release notes are no longer marked draft.

## Checklist

- [ ] Clear the 0.1.0 acceptance blockers and lift the draft marker from the release notes <!-- longclaw:item=ck_e04eb4b9 -->
- [ ] Cut the GitHub release with LongClaw_0.1.0_aarch64.dmg attached and release:binary-audit passing <!-- longclaw:item=ck_a728e7d1 -->
- [ ] Point SITE.releases at the release rather than the releases index <!-- longclaw:item=ck_41307b1a -->
- [ ] Re-read Getting started and the 0.1.0 changelog entry against the published release <!-- longclaw:item=ck_ccb48b5e -->

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
