---
title: "macOS signing and notarization runbook"
product: LongClaw
status: reference
---

# macOS signing and notarization runbook

For whoever ships the next release, who was probably not here for this one. The
recorded pass this was written from is
[the 2026-09-11 acceptance record](acceptance/signed-notarized-2026-09-11.md);
the reasoning is [LC-47](../.longclaw/tickets/LC-47/ticket.md).

## The identity

|                         |                                                                                                                                  |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Certificate             | `Developer ID Application: Sachin Jain (97864HG7U4)`                                                                             |
| Team ID                 | `97864HG7U4`                                                                                                                     |
| **Certificate expires** | **2027-02-01**                                                                                                                   |
| Membership renews       | 2027-09-02                                                                                                                       |
| Notarization credential | an App Store Connect API key, stored as the `longclaw-notary` keychain profile                                                   |
| Private key backup      | held by the account holder, outside this repository. The location is deliberately not written here — this directory is published |

Nothing in that table is a secret. The Team ID and the certificate name are in
the authority chain of every binary the release signs, readable by anyone who
downloads the DMG.

**Both dates fail silently.** An expired certificate does not break anything
already shipped — a signature with a secure timestamp stays valid past expiry —
but it blocks signing anything new, and the first sign of it is a release build
that will not go out. Note that the certificate expires more than six months
_before_ the membership does, which is not the usual five-year Developer ID
validity; check the portal rather than assuming either date.

The `.p8` was deleted once `notarytool store-credentials` had stored it, so the
keychain profile is the only copy of that credential. Losing it costs five
minutes — revoke the key in App Store Connect and issue another. Losing the
_signing_ key is the serious one: Apple has never held it, so it cannot be
reissued, only replaced by a new identity users have not seen before.

**If the machine dies, do not revoke the certificate.** Revocation is what
breaks builds already in people's hands; expiry is not. Revoke only if the key
is actually exposed, where breaking them is the point.

## Where signing happens

One machine, from its login keychain. No CI signing, deliberately: no
pull-request job can reach a credential that only exists in one keychain. The
cost is a bus factor, and the private-key backup is what buys it down.

`bundle.macOS.signingIdentity` in `tauri.conf.json` stays `"-"` — an _ad-hoc_
signature — because `npm run build:app` runs on every pull request on a runner
holding no certificate, and that build must keep producing an openable bundle.
The release overrides it from the environment; the bundler prefers
`APPLE_SIGNING_IDENTITY` over the configured value.

Notarization is not Tauri's. Tauri will notarize during `tauri build`, but only
from `APPLE_API_KEY` + `APPLE_API_ISSUER` + `APPLE_API_KEY_PATH`, or an Apple ID
and an app-specific password — it has no notion of a keychain profile, and both
of its routes want a credential in a file at build time. So the build signs and
`release-macos.mjs` notarizes.

## Shipping a release

```sh
export APPLE_SIGNING_IDENTITY="Developer ID Application: Sachin Jain (97864HG7U4)"
npm run release:macos
```

That builds, signs both binaries and the DMG, notarizes the app, staples it,
repacks the DMG around the stapled app, signs and notarizes _that_, and staples
it. Then:

```sh
npm run release:binary-audit
npm run release:gatekeeper-check -- --phase online
```

and, with the network off and run by a person rather than an agent:

```sh
npm run release:gatekeeper-check -- --phase offline
```

Finish by double-clicking the copy it leaves in
`/Users/Shared/longclaw-acceptance/`. **Expect one dialog** — _"…downloaded from
the internet. Are you sure you want to open it?"_, saying Apple found no malware,
with a highlighted **Open**. That is the pass. _"Apple could not verify…"_,
_"damaged"_, **Move to Bin**, or any trip through System Settings is a failure.

## Five things that will waste an afternoon

**Apple's notary service takes minutes, and killing the wait cancels nothing.**
The first submission from a new Team ID took about twenty-five. `notarytool
--wait` printing dots is not a hang. If you do kill it, the submission is still
Apple's: `xcrun notarytool info <id> --keychain-profile longclaw-notary`.

**Re-running is the correct recovery, and it is cheap.** `release-macos.mjs`
asks Apple whether this exact build is already notarized — `stapler staple`
looks the ticket up by CDHash — before it considers submitting. An unchanged
rebuild has an identical CDHash, so the old ticket still applies.

**`bundle_dmg.sh` drives a real Finder window** to lay the image out, and it is
indistinguishable from an install window. Do not click in it and do not drag the
app out of it; either fails the build with nothing but `failed to run`.

**A mounted `LongClaw` or leftover `dmg.*` volume fails the DMG step** the same
opaque way. `release-macos.mjs` refuses to start with one mounted and names it;
`hdiutil detach` clears it.

**`xcrun stapler validate` asks Apple**, so it reports a missing ticket on a
perfectly stapled artefact when the network is down. Offline, read the ticket
locally instead: `codesign -dvvv <artefact>` prints `Notarization Ticket=stapled`.

## Reissuing the certificate

Xcode → Settings → Accounts → the team → Manage Certificates… → **+** →
**Developer ID Application**. Export the new private key immediately —
Keychain Access → My Certificates → the _outer_ row → Export as `.p12` — and
back it up before signing anything with it. Then update the identity string in
this runbook, and in whatever environment the release build reads it from.
