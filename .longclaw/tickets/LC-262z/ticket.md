---
format: longclaw.ticket/v1
id: 98ec4c45-4cde-47b3-b072-09449535ea5c
key: LC-262z
title: release-macos treats a local staple failure as Apple saying no, and resubmits
status: todo
priority: p2
labels:
  - platform
  - ready-for-agent
type: bug
created_at: 2026-09-20T11:42:49.580Z
updated_at: 2026-09-20T11:42:49.580Z
---

`release-macos.mjs` asks Apple whether a build is already notarized by trying to
staple it, and treats any failure as "it has not been". That is one question
answering two: a staple can fail because Apple has no ticket, and it can fail
because `stapler` has a ticket and cannot write it into this particular copy of
the bundle. The second reads as the first, and the script then uploads to the
notary service, waits for Accepted, staples again, fails the same way, and dies.

Found on 2026-09-20, running the `--no-build` dry run LC-256a asks for, against
the signed and stapled 0.1.0 bundle sitting in `target/`. The first attempt cost
an upload and left the bundle **worse than it found it**: `stapler staple`
removed the existing ticket before failing to write the new one, so a bundle
that validated as stapled beforehand did not afterwards. A second run spent a
second submission and failed identically.

```
▸ Asking Apple whether this exact build is already notarized
The staple and validate action failed! Error 73.
…
  status: Accepted
▸ Stapling the app
The staple and validate action failed! Error 73.
release-macos: Stapling the app failed (exit 73)
```

Verbose `stapler` names the real failure, and it is local:

```
Downloaded ticket has been stored at file:///var/folders/…/….ticket.
Could not remove existing ticket from …/LongClaw.app/Contents/CodeResources
  because an error occurred. Error Domain=NSCocoaErrorDomain Code=4
  "“CodeResources” couldn’t be removed." … Code=2 "No such file or directory"
```

The ticket downloaded. The write into the bundle is what failed. Apple was never
the question.

**The bundle was not damaged, and its location was not either.** `ditto`ing that
same `.app` to a scratch directory and stapling the copy worked first time, and
so did a copy placed beside the original inside `target/release/bundle/`. Only
that one directory refused, and replacing it with a `ditto` of itself fixed it;
`codesign --verify --deep --strict` passed on both before and after. So this is
a state a bundle directory can get into rather than a broken build, which is
exactly the kind of thing a release should survive rather than resubmit over.

## What a fix has to do

- **Never resubmit on a failure it has not understood.** An upload is minutes of
  someone's release and it is the wrong answer to a local write error.
- **Never leave the bundle less stapled than it found it.** Removing the old
  ticket before the new one is written is a destructive step in a script whose
  header says re-running it is the correct move after any interruption.
- **Keep the question the header already argues for.** Asking `stapler staple`
  rather than "is a ticket attached" is right, and the reasoning in the header
  is worth keeping: a rebuild strips the staple without changing the CDHash, so
  the old ticket still applies. What is missing is the second question, asked
  only when the first fails: did Apple give us a ticket?

`spctl --assess -t exec -vv` is the obvious candidate for that second question —
it reports `source=Notarized Developer ID` for an app Apple has notarized,
stapled or not — but it needs checking on an unstapled bundle rather than
assumed. Stapling a `ditto` copy and swapping it in is the other half worth
considering, since that is what actually worked by hand.

## Related

- LC-256a found this while dry-running the release; its own dry-run item is
  checked off, because the archive, signature and manifest steps it was about
  did run and pass once the bundle was repaired.
- LC-47 is where the notarization half of this script came from.

## Activity

<!-- longclaw:event
id: evt_ef9b7b2b
kind: create
occurred_at: 2026-09-20T11:42:49.580Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_69089f01
kind: comment
occurred_at: 2026-09-20T11:57:39.466Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

The full release run gave the clean contrast this needs, and it narrows the fix.

Building, signing and notarizing from scratch on 2026-09-20, the same first step said:

  ▸ Asking Apple whether this exact build is already notarized
  CloudKit query for LongClaw.app (2/0babf2db3172fa88ea7fe04d492b69901c3c530c) failed due to "Record not found".
  The staple and validate action failed! Error 65.

That is the honest case — Apple genuinely has no ticket for this CDHash — and stapler reports it as **65**, not 73. The local write failure that started this ticket reports **73**. So the two cases the script currently conflates already have different exit codes, and tryStaple throws that away by asking only whether the status was zero.

That does not make the fix a one-liner. 65 means resubmit, 73 means something local is wrong and the bundle may now be worse than it was found, but neither number is documented as a contract and a third code is not something to guess about. What it does mean is that the script has a signal to read rather than needing an spctl probe invented for it, and that the safe default for an unrecognised failure is to stop and say so rather than to upload.

The rest of that run was clean: app submitted, Accepted, stapled, DMG opened read-write, its inner app stapled, sealed, signed, submitted, Accepted, stapled. Exit 0.
<!-- /longclaw:event -->
