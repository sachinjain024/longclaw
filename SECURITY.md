# Security policy

## Reporting a vulnerability

Please report a vulnerability privately, through
[GitHub's private vulnerability reporting](https://github.com/sachinjain024/longclaw/security/advisories/new),
not in a public issue.

Include the LongClaw version (shown in the status bar at the foot of the
window), your macOS version, and the steps that reproduce it. You will get an
acknowledgement, and a fix ships in a release whose notes credit you unless you
would rather they did not.

## Supported versions

Only the latest release gets security fixes. The app checks for updates and
installs one when you press **Update**, so the fix reaches you through the same
path as every other release.

## What is in scope

LongClaw is a local desktop app with no server and no account, so the surface
is on your machine:

- the app and the `longclaw` CLI reading and writing `.longclaw/` in the folders
  you open
- the two network requests it makes, both to this repository: the update check,
  with the signature check on the update it downloads, and the public star count
- the signed, notarized build published on [longclaw.io](https://longclaw.io)
  and on this repository's releases

A build you compiled yourself, or a copy from anywhere else, is outside that
promise.
