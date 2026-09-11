---
title: "Signed and notarized first-launch pass — 2026-09-11"
product: LongClaw
status: record
milestone: "LC-47 — signing and notarization"
---

# Signed and notarized first-launch pass — 2026-09-11

The row [the gate](release-candidate.md#macos-signing-and-packaging) has carried
on its unsigned branch since Step 16b. This record moves it to the signed one.

**Both phases pass.** A quarantined DMG, and the app dragged out of it, are
accepted by Gatekeeper as `Notarized Developer ID` — **with Apple unreachable**,
which is the half that matters for a tool that claims to need no network.

## Identity

| Field                   | Value                                                                                                           |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| Date                    | 2026-09-11                                                                                                      |
| Machine                 | the build machine, Apple Silicon                                                                                |
| macOS                   | 26.5.2 (build 25F84, Darwin 25.5.0)                                                                             |
| Branch                  | `lc-47-signing-credentials` at `88311ce`                                                                        |
| Signing identity        | `Developer ID Application: Sachin Jain (97864HG7U4)`                                                            |
| Team ID                 | `97864HG7U4`                                                                                                    |
| Notarization credential | App Store Connect API key, held as the `longclaw-notary` keychain profile                                       |
| App CDHash              | `dcb9b336a8bfd19ec69db1894b08f33de168871e`                                                                      |
| DMG                     | `LongClaw_0.1.0_aarch64.dmg`, 5.0 MB, sha256 `54a3d88a4179eb75d1a890f37a58972c44054b896e35c01c8d2bf5eb32572a17` |
| Notary submissions      | app `624c49b7-d2b0-4437-adc0-13d71d8058b5`, DMG `84a73512-353a-474d-8056-48886a601e0c`, both **Accepted**       |
| Transcripts             | `/Users/Shared/longclaw-acceptance/gatekeeper-{online,offline}.txt`                                             |

## The run

`npm run release:gatekeeper-check -- --phase online|offline`. It gives a copy of
the DMG the `com.apple.quarantine` attribute Safari would write, mounts it, and
copies the app out — then asks about **the copy**, because the app inside the
image and the app a person launches are different files and only the second one
is ever run.

It refuses a phase the machine contradicts. An offline pass recorded on a
connected machine would be the same defect as a quarantine check on an artefact
that was never quarantined, which is the defect that shipped through Step 17.

| Check                                                        | Online                                 | Offline                                |
| ------------------------------------------------------------ | -------------------------------------- | -------------------------------------- |
| Apple reachable (`api.apple-cloudkit.com`, `ocsp.apple.com`) | both reachable                         | **both unreachable**                   |
| Gatekeeper accepts the DMG                                   | pass — `source=Notarized Developer ID` | pass — `source=Notarized Developer ID` |
| The DMG carries a stapled ticket, read from the file         | pass                                   | pass                                   |
| `stapler` agrees, against Apple                              | pass                                   | not asked — see below                  |
| The copy dragged out is quarantined                          | pass — `0281;…`                        | pass — `0281;…`                        |
| The copy carries the stapled ticket                          | pass                                   | pass                                   |
| Gatekeeper accepts the copy                                  | pass — `source=Notarized Developer ID` | pass — `source=Notarized Developer ID` |

`npm run release:binary-audit` passes on the same artefacts, and its
`--self-test` still catches an ad-hoc bundle on all five signing rows.

## What first launch actually looks like

LC-47 §5 predicted _"no dialog at all"_. **That was wrong, and it is not
achievable.** A downloaded app carries `com.apple.quarantine` and earns a
one-time confirmation however impeccable its signature; the only way to avoid it
is to strip the attribute, which the release notes tell people not to do.

What notarization changes is _which_ dialog, and that is the whole release:

|                  | Unsigned (what v0.1.0 ships today)                                                                                      | Signed and notarized                                                                                                                                                            |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wording          | **"LongClaw" Not Opened** — _"Apple could not verify … is free of malware"_                                             | _"…is an app downloaded from the internet. Are you sure you want to open it?"_, with _"As of 11 September 2026, Apple checked it for malicious software and none was detected"_ |
| Buttons          | Done / **Move to Bin** — the destructive one highlighted                                                                | Cancel / **Open** — Open highlighted                                                                                                                                            |
| Cost to the user | System Settings → Privacy & Security → Open Anyway, plus authentication. Four steps, on every machine, on every install | One click, once                                                                                                                                                                 |

Confirmed by hand in both phases. Offline, that malware sentence is rendered
from the stapled ticket: no network was consulted to produce it.

## Two traps, recorded because both cost a run

**`xcrun stapler validate` asks Apple.** The first offline attempt failed both
staple rows on the exact DMG that had passed them online minutes earlier, and
the kept copy — same bytes, untouched — passed again the moment the network came
back. A check that needs the network cannot be the evidence for an offline
claim. `codesign -dvvv` prints `Notarization Ticket=stapled` by reading the
file, and that is what the staple rows assert; `stapler` stays as a second
opinion in the online phase, where it is entitled to reach out.

**`bundle_dmg.sh` drives a real Finder window.** It mounts a scratch image and
lays the window out over AppleScript, which is indistinguishable from an install
window — dragging the app out of it fails the build with nothing but
`failed to run`. A `LongClaw*` or leftover `dmg.*` volume still mounted fails it
the same opaque way. `release-macos.mjs` says so before the build starts and
refuses to run with either mounted.

## What this record does not prove

| Limit                                                                                                                | Standing                                                                                                                                                                                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gatekeeper was **simulated** — the attribute was written onto a copy of the DMG rather than earned by downloading it | Faithful, and the only way to test this at all from a build machine. The same simulation is what found the Step 17 signing defect                                                                                                                                             |
| Not a clean machine, and not a machine that had never seen LongClaw                                                  | Each run works on a fresh copy with a fresh quarantine UUID, because Gatekeeper caches its verdict against that UUID. That covers the caching question; it does not make this a clean-machine pass. See [the 2026-08-05 record](clean-machine-2026-08-05.md) for what that is |
| The certificate expires **2027-02-01**, before the membership renews on 2027-09-02                                   | Not a defect in this release, and silent until a build fails. It belongs to whoever ships next                                                                                                                                                                                |
