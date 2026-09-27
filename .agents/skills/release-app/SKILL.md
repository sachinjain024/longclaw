---
name: release-app
description: Cut a LongClaw app release end to end. Use when the user asks to release, ship or cut a version — the skill asks for the version number, then runs the full gates, bumps the version, prepares the release notes and changelog, builds, signs, notarizes and staples the DMG, cuts the GitHub release, points the site's download at it, and tracks the whole thing on a release ticket.
---

One version number in, one shipped release out. The steps below are in the
order they depend on each other. The detail lives in the documents this skill
orchestrates rather than repeats — [the signing
runbook](../../../docs/release-signing-runbook.md), [the issue-tracker
rules](../../../docs/agents/issue-tracker.md) and [the website
README](../../../apps/website/README.md) — and in the sibling
[`changelog-entry`](../changelog-entry/SKILL.md) skill.

## Ask for the version first

Nothing runs until the version is named. Read the current one from
`apps/desktop/src-tauri/tauri.conf.json`, propose the next one, and ask. The
version is semver with no `v` in it: the tag, the DMG filename and the
release-notes filename add their `v`, and the changelog entry and
`SITE.version` do not.

## The ticket is the release

Create the ticket before touching anything, and give it every row up front:
the release is this checklist being worked to the bottom. The title is
`Release v0.4.0` for version 0.4.0.

```sh
longclaw ticket create \
  --title "Release v0.4.0" \
  --description "Cut LongClaw 0.4.0: final testing, version bump, release
notes, changelog, the signed and notarized build, the GitHub release, the
site's download link, and the references recorded here." \
  --label release --type chore \
  --checklist "P1 · …" \
  --checklist "P1 · …" \
  --agent-id <id> --agent-name "<Name>"
```

One `--checklist` flag per row; every row is filed open. The rows, in
execution order:

- P1 · Release branch `release/v0.4.0` cut from updated `main`
- P1 · Five version spellings bumped and agreeing: both `package.json` files, `Cargo.toml`, its `Cargo.lock` entry, `tauri.conf.json`
- P1 · Release notes final at `docs/release-notes/v0.4.0.md`; the `status: draft` marker lifted
- P1 · Changelog entry derived at `apps/website/src/content/changelog/0.4.0.md`
- P1 · `SITE.download`, `downloadFile`, `version` and `releases` moved; `downloadSha256` deliberately left on the old digest
- P2 · `npm run verify` passes at the release tree
- P2 · `npm run site:verify` passes
- P2 · `npm run release:macos` builds, signs, notarizes and staples both artefacts, and writes the update artefacts
- P2 · `npm run release:binary-audit` passes
- P2 · `npm run release:gatekeeper-check -- --phase online` passes
- P3 · Stapled DMG committed at `apps/website/public/downloads/LongClaw_0.4.0_aarch64.dmg`
- P3 · `SITE.downloadSha256` set from `shasum -a 256` of the shipped DMG; `npm run site:verify` re-run
- P4 · Branch merged; `v0.4.0` tagged at the merge commit; GitHub release cut with the DMG, the update archive, its signature and `latest.json`
- P4 · Read-back: the manifest reports 0.4.0, and longclaw.io serves the DMG with the matching sha256
- P4 · References comment posted on this ticket: version, build links, changelog
- P4 · `npm run release:gatekeeper-check -- --phase offline` — a person, network off
- P4 · First launch by hand from `/Users/Shared/longclaw-acceptance/` — one dialog expected
- P4 · `npm run audit:network` offline and online — a person on a quiet machine

House rules, from `docs/agents/issue-tracker.md`: `--agent-id` and
`--agent-name` on every create and edit, because the actor is declared and
never inferred; the CLI is the only creation surface, never a hand-written
ticket directory; prefer the installed `longclaw`, and build
`apps/desktop/src-tauri/target/release/longclaw` instead when the tree touches
`cli.rs`, `core/` or `file_format.md`. Check a row off only when its proof
exists — `longclaw ticket edit <KEY> --check ck_…` — with the row's id read
from the `longclaw:item` comments in the ticket file.

The last three rows are a person's. Leave them open rather than checking them
on anyone's behalf, and if the release ships without one, file the follow-up
the way 0.3.0 filed LC-264e for the network audit rather than skipping it
silently.

## Prepare

Cut `release/v0.4.0` from updated `main` and work there. Merging is a later
step, and nothing merges until the build exists.

- **The version is spelled in five places**, and they move together: root
  `package.json`, `apps/desktop/package.json`,
  `apps/desktop/src-tauri/Cargo.toml`, that package's own entry in
  `Cargo.lock`, and `apps/desktop/src-tauri/tauri.conf.json`.
- **`docs/release-notes/v0.4.0.md` is the source of truth.** The update
  manifest's notes and the site's changelog are both derived from it, so the
  app and the site cannot disagree about what changed. Lift the
  `status: draft` marker when the release is cut, and model the file on the
  previous release's notes.
- **Derive the changelog; do not compose it.**
  `apps/website/src/content/changelog/0.4.0.md` follows the
  `changelog-entry` skill, whose gate is that a changelog must not claim a
  release nobody can download. On the release branch the entry and the
  artefact land together; the merge is what publishes.
- **Move four of the five download fields** in `apps/website/src/lib/site.ts`
  — `download`, `downloadFile`, `version` and `releases` — and leave
  `downloadSha256` on the previous release's digest. The shipped DMG is
  repacked around the stapled app after notarization, so any checksum written
  now is a checksum of the wrong bytes.

## Final testing

```sh
npm run verify               # the whole gate: guards, release audit, tests,
                              # the native watcher, the vite build
npm run site:verify           # the site's own gate
```

Run `npm --prefix apps/website ci` first if the site's `node_modules` is
missing; the site is a separate package with its own lockfile. Both gates pass
at the release tree before anything is signed. `verify` already runs the
release audit and the update-manifest self-test, and CI's
`npm run build:app` is superseded by the signed build below.

## Build, sign, notarize, staple

One machine, one login keychain, no CI. The shell, from the runbook:

```sh
export APPLE_SIGNING_IDENTITY="Developer ID Application: Sachin Jain (97864HG7U4)"
export TAURI_SIGNING_PRIVATE_KEY="$(security find-generic-password -a "$USER" -s longclaw-updater-key -w | base64 -d)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="$(security find-generic-password -a "$USER" -s longclaw-updater-password -w)"
npm run release:macos
```

`release:macos` builds and signs, notarizes and staples the app, repacks the
DMG around the stapled app and notarizes that, and writes the update
artefacts beside the DMG in
`apps/desktop/src-tauri/target/release/bundle/dmg/`: the
`LongClaw_0.4.0_aarch64.app.tar.gz` an installed copy updates with, its
`.sig`, and `latest.json`. Then:

```sh
npm run release:binary-audit
npm run release:gatekeeper-check -- --phase online
```

The runbook's traps, one line each: the notary service takes minutes and
printing dots is not a hang; re-running after any interruption is the correct
recovery; `bundle_dmg.sh` drives a real Finder window, so leave it alone; a
mounted `LongClaw` or `dmg.*` volume fails the DMG step, and
`hdiutil detach` clears it.

## Publish the download

Copy the stapled DMG to
`apps/website/public/downloads/LongClaw_0.4.0_aarch64.dmg` — the previous
DMGs stay, the site hosts one file per release — set `SITE.downloadSha256` to
its `shasum -a 256`, and re-run `npm run site:verify`. Every Download CTA on
the site reads `SITE.download`, so this one edit is the landing page's link.

## The GitHub release

Merging the branch is what publishes the site: the changelog entry and the
download go live with it. Invoking this skill asks for the release, and the
release is not shipped until the site serves it; still, say which PR is
merging as it merges.

```sh
git push -u origin release/v0.4.0
gh pr create                   # the body describes what ships, as PR #57 did
gh pr merge --squash
git switch main && git pull --ff-only
git tag v0.4.0 && git push origin v0.4.0
gh release create v0.4.0 \
  apps/desktop/src-tauri/target/release/bundle/dmg/LongClaw_0.4.0_aarch64.dmg \
  apps/desktop/src-tauri/target/release/bundle/dmg/LongClaw_0.4.0_aarch64.app.tar.gz \
  apps/desktop/src-tauri/target/release/bundle/dmg/LongClaw_0.4.0_aarch64.app.tar.gz.sig \
  apps/desktop/src-tauri/target/release/bundle/dmg/latest.json \
  --notes-file docs/release-notes/v0.4.0.md
```

Tag the merge commit: the DMG's tree must be the tree the tag names, so
nothing touches the app between the build and the merge. `latest.json` must
be among the assets, because an installed copy reads it from the release's
stable `latest/download` URL and publishing the release is what refreshes the
manifest. Then read it back — the step that catches a release that updates
nobody:

```sh
curl -sSL https://github.com/sachinjain024/longclaw/releases/latest/download/latest.json | jq .version
```

And confirm the live site serves the DMG, with a `sha256` that still matches
`SITE.downloadSha256`.

## The references comment

Post the release's references to the ticket — the version, the links, and the
changelog's contents, not just pointers to them:

```sh
longclaw ticket edit <KEY> --comment "…" \
  --agent-id <id> --agent-name "<Name>"
```

- **Version**: `0.4.0`, tag `v0.4.0`.
- **Build**: the GitHub release URL
  `https://github.com/sachinjain024/longclaw/releases/tag/v0.4.0`, and the
  site download `https://longclaw.io/downloads/LongClaw_0.4.0_aarch64.dmg`
  with its `sha256`.
- **Changelog**: the link `https://longclaw.io/changelog#v0-4-0` **and the
  entry's bullets**, so the ticket reads without a browser.

Then check off the rows that are done, leave the three person-only rows open,
and say what remains.

## Verify

The release is shipped when every one of these holds:

- `npm run verify` and `npm run site:verify` passed at the release tree.
- `release:binary-audit` and `release:gatekeeper-check -- --phase online`
  passed on the built artefacts.
- The GitHub release serves the DMG, the update archive, its signature and
  `latest.json`, and the read-back reports the new version.
- `longclaw.io` serves the DMG, and its `sha256` matches
  `SITE.downloadSha256`.
- The ticket carries the references comment, and the only open rows are the
  three that need a person.
