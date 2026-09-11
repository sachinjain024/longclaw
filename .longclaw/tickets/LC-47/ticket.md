---
format: longclaw.ticket/v1
id: 016ec3ad-8e3f-4477-8b2e-0b5e1790132f
key: LC-47
title: Signing and notarization
status: in_progress
priority: p1
labels:
  - release
  - post-mvp
created_at: 2026-08-05T14:23:17Z
updated_at: 2026-09-11T05:55:23.757Z
---

**Signing and notarization.** v0 ships unsigned with a documented Gatekeeper route

## Why now

The release notes tell a user to click through a security warning. That is honest and it is not a resting place: every install after this one pays the same tax, and the instruction trains a habit worth not training

## Source

`docs/backlog/post-mvp-backlog.md` — **P4**, Tier 1, owner Release.

## Where this stands

- `apps/desktop/src-tauri/tauri.conf.json` sets `bundle.macOS.signingIdentity: "-"` — an **ad-hoc** signature. That seals the bundle, which is the whole of `82dac6b`: without it macOS calls a quarantined copy *"damaged"* and offers only *Move to Bin*, so the route the notes document does not exist. Ad-hoc is not a Developer ID and it is not notarization, so first launch is still refused.
- `docs/release-notes/v0.1.0.md` § *Opening the app the first time* is what that costs: four steps through System Settings → Privacy & Security → **Open Anyway**, plus a warning not to press the highlighted *Move to Bin*, paid by every user on every machine.
- `npm run release:binary-audit` (`apps/desktop/scripts/binary-audit.mjs:145`) checks only that the signature verifies and that resources are sealed, and it **tolerates `spctl` refusing the bundle by name** — correct for an unsigned release, and wrong the moment this ticket lands.
- Both branches are already written in `docs/acceptance/release-candidate.md` § *macOS signing and packaging*. This ticket moves the release from the unsigned row to the signed one.

## What needs to happen

### 1. The Apple account — the actual blocker, and not a code change

- Apple Developer Program membership, $99/yr, renewed or the certificate dies with it. Individual or organization is a real decision: an organization enrollment needs a D-U-N-S number and has lead time measured in weeks.
- Decide who holds it. The identity is the release's root of trust and outlives any one machine — record the owner and where the private key is backed up.
- Issue a **Developer ID Application** certificate. That is the one a DMG needs; Developer ID Installer is for `.pkg` and is not in scope.
- Credentials for `notarytool`: prefer an App Store Connect API key (Issuer ID, Key ID, `.p8`) over an Apple ID with an app-specific password — it is revocable on its own and is not tied to a person's account.
- Record the Team ID the build signs under.

### 2. Build configuration

- `bundle.macOS.signingIdentity` becomes the Developer ID Application identity, with the notarization credentials in the environment: Tauri v2 signs, submits, and staples during `tauri build` when they are present.
- **Decide config versus environment before touching the file.** `npm run build:app` runs on every PR (`.github/workflows/ci.yml:37`) on a runner holding no certificate, and that build must keep producing an openable ad-hoc bundle — so the committed default stays `"-"` and the release build overrides it. `docs/acceptance/release-candidate.md` currently states the committed `"-"` as a requirement; that sentence changes with this.
- Hardened Runtime is required for notarization. Confirm what Tauri passes rather than assuming, and check whether the webview needs an entitlement (`bundle.macOS.entitlements`). Add none speculatively — each one is a permission the shipped app then holds.
- Both artefacts, not one: the `.app` inside the DMG, and the DMG.

### 3. Secrets, and where the release build runs

- Two workable shapes: a keychain-held certificate on one named machine, or a base64 `.p12` and the API key in CI secrets. Pick one and write it down — a release only one person can produce is a bus factor, and a signing secret reachable from every PR build is an exfiltration path.
- If it runs in CI, signing belongs to a tag or release job. The PR job must never be handed the credentials.
- Notarization uploads the bundle to Apple. That is the build machine talking to Apple, not the app talking to anyone, and it should be said in those words wherever it could read as a breach of `docs/release-notes/v0.1.0.md` § *The local-only boundary* — because it will be asked.

### 4. Turn the audit around

`binary-audit.mjs` passes today on exactly the state this ticket removes. Once signed it must fail on it:

- `spctl --assess --type execute` must **accept** — today its rejection is tolerated in a comment.
- `codesign -dv --verbose=4` must show a Developer ID authority chain and the runtime flag.
- `stapler validate` must pass on the `.app` and on the DMG.
- Keep the seal check. It costs nothing and it is what caught the defect that shipped through Step 17.
- Give it a `--self-test` inversion, as the other guards have: a run that stays green against an unsigned bundle is a guard that is not watching.

### 5. Prove it the way it failed before

A locally built artefact has never been downloaded, so Gatekeeper never runs on it, and every pass before `82dac6b` was green for that reason. Repeat the simulation recorded in `docs/acceptance/release-candidate.md`:

```sh
xattr -w com.apple.quarantine "0081;$(printf '%x' $(date +%s));Safari;$(uuidgen)" <dmg>
```

The expected result is now **no dialog at all** — a first launch that simply opens. Run it **offline as well as online**: the stapled ticket is what makes that work without a network round trip, and for this app the offline case is the one that matters. Record both, next to `docs/acceptance/clean-machine-2026-08-05.md`.

### 6. The documentation, on landing

- **Delete** § *Opening the app the first time* from `docs/release-notes/v0.1.0.md` — deleted, not softened, which is this ticket's checklist item. The "Why it is unsigned" paragraph goes with it.
- `docs/acceptance/release-candidate.md` § *macOS signing and packaging*: the signed row becomes the branch taken, with the identity and the notarization request recorded.
- `docs/release-risks.md:51`: retire the row with its evidence, in the struck-through form the rows above it use.
- A runbook for the next release — the commands, the credential names, the expiry dates, and where the key lives. This is done once and needed again a year later, by someone who was not here.

## Out of scope

- The Tauri updater. It carries its own separate signing key and is not part of v0.
- Sandboxing and the App Store: still gated on security-scoped bookmarks per ADR 0009.
- An Intel or universal build. The release notes state Apple Silicon only.

## Watch for

- Certificate and API-key expiry are silent until a build fails. The dates belong in the runbook.
- `Security.framework` is a fail condition in the binary audit (`binary-audit.mjs:118`). Nothing here should link it — `codesign` and `notarytool` are external tools — but run the audit and read it rather than assuming.

## Checklist

- [x] Apple Developer Program membership is active, a Developer ID Application certificate is issued, and the notarytool credentials, the Team ID, and the private key backup location are recorded <!-- longclaw:item=ck_c8bff8b2 -->
- [x] The build signs with that identity and notarizes and staples both the .app and the DMG, and `npm run build:app` on a machine holding no certificate still produces an openable ad-hoc bundle, because CI runs it on every PR <!-- longclaw:item=ck_39bdc0a1 -->
- [x] Where the signing credentials live is decided and written down, and no pull-request job can reach them <!-- longclaw:item=ck_1adc935f -->
- [x] binary-audit.mjs requires `spctl` acceptance, a Developer ID authority chain, the runtime flag, and `stapler validate` on both artefacts, and its --self-test fails when the bundle is unsigned <!-- longclaw:item=ck_ffe5a28f -->
- [x] A quarantined DMG opens on one click of Open, offline as well as online, with macOS saying Apple found no malware rather than refusing the app, recorded in an acceptance file <!-- longclaw:item=ck_92a13965 -->
- [x] Section Opening the app the first time is deleted from the release notes rather than softened, the acceptance table takes the signed branch, the release-risks row is retired with its evidence, and a signing runbook exists for the next release <!-- longclaw:item=ck_73bee0af -->

## Activity

<!-- longclaw:event
id: evt_e5e122eb
kind: create
occurred_at: 2026-08-05T14:23:17Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_f4da9677
kind: update
occurred_at: 2026-08-22T08:13:22.932Z
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
id: evt_78ca8126
kind: update
occurred_at: 2026-08-22T08:45:34.230Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_c8bff8b2.text
    from: A Developer ID identity and a notarization request are recorded, and the release notes' § Opening the app the first time is deleted rather than softened
    to: Apple Developer Program membership is active, a Developer ID Application certificate is issued, and the notarytool credentials, the Team ID, and the private key backup location are recorded
  - field: checklist.ck_39bdc0a1.added
    to: The build signs with that identity and notarizes and staples both the .app and the DMG, and `npm run build:app` on a machine holding no certificate still produces an openable ad-hoc bundle, because CI runs it on every PR
  - field: checklist.ck_1adc935f.added
    to: Where the signing credentials live is decided and written down, and no pull-request job can reach them
  - field: checklist.ck_ffe5a28f.added
    to: binary-audit.mjs requires `spctl` acceptance, a Developer ID authority chain, the runtime flag, and `stapler validate` on both artefacts, and its --self-test fails when the bundle is unsigned
  - field: checklist.ck_92a13965.added
    to: A quarantined DMG opens with no dialog at all, offline as well as online, recorded in an acceptance file
  - field: checklist.ck_73bee0af.added
    to: Section Opening the app the first time is deleted from the release notes rather than softened, the acceptance table takes the signed branch, the release-risks row is retired with its evidence, and a signing runbook exists for the next release
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_ff734c48
kind: update
occurred_at: 2026-08-24T15:15:50.319Z
actor:
  type: human
  id: local
changes:
  - field: status
    from: backlog
    to: in_progress
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_0e1a4316
kind: comment
occurred_at: 2026-09-11T00:30:20.378Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Step 1 of *The Apple account* is partly done, verified on this machine rather than reported.

- Apple Developer Program membership is active, valid through 2027-09-02. Individual enrolment, so the identity is held by one person and that is the decision the section asks to record.
- A **Developer ID Application** certificate is issued and its private key is in the login keychain. `security find-identity -v -p codesigning` returns one valid identity: `Developer ID Application: Sachin Jain (97864HG7U4)`. Developer ID Installer was not issued and is not in scope.
- **Team ID: `97864HG7U4`** — this is the identity the build signs under. Not a secret; it is in the authority chain of every signed binary.

Still open on this checklist item, so it stays unchecked:

- The App Store Connect API key for `notarytool` (Issuer ID, Key ID, `.p8`), preferred here over an Apple ID with an app-specific password because it is revocable on its own.
- Where the signing private key is backed up, recorded as a location. The ticket directory is committed to git, so the location goes here and never the key, the `.p12` password or the `.p8` bytes.
- Certificate expiry, which is silent until a build fails, and belongs in the runbook next to the membership renewal date.

Xcode Cloud was considered and is not relevant: it builds Xcode schemes, and this app is built by cargo and npm. Signing needs the certificate and the notarytool credentials, nothing from that panel.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_fa909d8e
kind: update
occurred_at: 2026-09-11T01:21:19.446Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_c8bff8b2.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

The first checklist item is complete.

- `notarytool` credentials are stored in the login keychain as a profile, created with `notarytool store-credentials` and confirmed against Apple with `notarytool history`. The `.p8` was deleted afterwards, so no file on this machine holds the API key — the build references the profile by name.
- The signing private key is exported from the login keychain and backed up off this machine, encrypted.

**The backup location is deliberately not recorded here.** The item asks for it, and this ticket directory is published to GitHub, so the location is held by the account holder instead. Noted as a decision rather than left as a gap, because a later reader would otherwise read the absence as an oversight.

Two things this leaves for the runbook in section 6, both silent until a build fails: the certificate expiry, and the membership renewal on 2027-09-02.

Also settled, ahead of its own checklist item: signing happens on this machine only, from the login keychain. No CI-based signing is planned, so no pull-request job can reach the credentials — structurally, since the committed `signingIdentity` stays `"-"` and only this machine's environment overrides it.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_1481d708
kind: update
occurred_at: 2026-09-11T05:49:23.615Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_92a13965.checked
    from: "false"
    to: "true"
  - field: checklist.ck_ffe5a28f.checked
    from: "false"
    to: "true"
  - field: checklist.ck_92a13965.text
    from: A quarantined DMG opens with no dialog at all, offline as well as online, recorded in an acceptance file
    to: A quarantined DMG opens on one click of Open, offline as well as online, with macOS saying Apple found no malware rather than refusing the app, recorded in an acceptance file
-->
### Claude Code updated this ticket

Signed, notarized and stapled, and the acceptance run is recorded in `/Users/Shared/longclaw-acceptance/`.

**Section 5 predicted the wrong result, and this corrects it.** It expected *"no dialog at all"*. That is not achievable for a downloaded app: `com.apple.quarantine` earns a one-time confirmation however impeccable the signature, and the only way to avoid it is to strip the attribute — which the release notes tell people not to do. What notarization changes is **which** dialog, and the difference is the whole release:

| | Today (unsigned) | Now |
|---|---|---|
| Wording | "Apple could not verify LongClaw is free of malware" | "…downloaded from the internet. Are you sure you want to open it?" with "Apple checked it for malicious software and none was detected" |
| Buttons | Done / **Move to Bin**, the destructive one highlighted | Cancel / **Open**, Open highlighted |
| Cost | System Settings → Privacy & Security → Open Anyway, plus authentication, four steps, on every machine | one click, once |

Offline, that malware sentence is rendered from the stapled ticket — no network was consulted to produce it. The checklist item is reworded to the achievable claim and ticked.

`npm run release:gatekeeper-check -- --phase offline|online` is the run, and it refuses a phase the machine contradicts rather than recording it. Both phases pass. The offline one is the load-bearing half and it was nearly lost to a bad probe: the staple rows originally used `xcrun stapler validate`, which asks Apple, so with the network down it failed on the exact DMG that had passed minutes earlier. `codesign -dvvv` reports `Notarization Ticket=stapled` by reading the file, and that is what the rows assert now.

`binary-audit.mjs` passes against the notarized artefacts and its `--self-test` still catches an ad-hoc bundle on all five signing rows.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_439ee54c
kind: update
occurred_at: 2026-09-11T05:55:23.757Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_39bdc0a1.checked
    from: "false"
    to: "true"
  - field: checklist.ck_1adc935f.checked
    from: "false"
    to: "true"
  - field: checklist.ck_73bee0af.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

The remaining items are done; the ticket is complete on `lc-47-signing-credentials`.

**The CI half was proven rather than argued.** `tauri.conf.json` is unchanged — `signingIdentity` stays `"-"` — because `APPLE_SIGNING_IDENTITY` overrides it, which section 2 had left as a decision to make and which turned out to need no config change at all. To check the claim rather than reason about it, the signed artefacts were set aside and `npm run build:app` run with nothing in the environment, as a runner would: `Signing with identity "-"`, `flags=0x10002(adhoc,runtime)`, `Sealed Resources version=2`, and `codesign --verify --deep --strict` passes — openable, not damaged, and refused by Gatekeeper, which is the correct answer for an unsigned build. The signed artefacts were then restored bit-for-bit (same sha256) and re-audited clean.

**Where the credentials live** is one machine's login keychain, written up in [the runbook](../../../docs/release-signing-runbook.md). No CI signing, so no pull-request job can reach them — structurally, not by policy. The cost is a bus factor and the private-key backup is what buys it down.

**Documentation:** § *Opening the app the first time* is deleted from the release notes, with its "Why it is unsigned" paragraph — 44 lines, and nothing left in the notes claims the build is unsigned. `release-candidate.md` takes the signed row and records why the committed `"-"` stays. The `release-risks.md` row is struck through with its evidence. The runbook carries the identity, the Team ID, the profile name, both expiry dates and the five traps that cost an afternoon each.

Hardened Runtime needed no work: Tauri passes `--options runtime` itself, which the ad-hoc build shows too (`adhoc,runtime`). No entitlements were added.

Left for whoever ships next, and not a defect here: the certificate expires **2027-02-01**, before the membership renews on 2027-09-02.
<!-- /longclaw:event -->
