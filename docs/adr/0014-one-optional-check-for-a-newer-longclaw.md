# The app makes one optional check for a newer LongClaw, and nothing else

**Status:** accepted on 2026-09-19, amending the *no network* claim that
[the release audit](../../apps/desktop/scripts/release-audit.mjs), the
[binary audit](../../apps/desktop/scripts/binary-audit.mjs) and the
[runtime network audit](../../apps/desktop/perf/network-audit.mjs) enforce, and
the two rows in [the release-candidate checklist](../acceptance/release-candidate.md)
that certify it. Written for [LC-256a](../../.longclaw/tickets/LC-256a/ticket.md).

LongClaw may make exactly one kind of network request: a `GET` for one static
update manifest, from one named host, carrying nothing that describes the
person, the machine, the build or their projects, which the person can turn off
and which nothing else in the app waits on. Every other network request remains
forbidden, and the gates that used to assert *none* now assert *this one and no
other*.

## Why the promise had to be amended rather than kept

The promise the gates were written to protect is in the bundle's own
description — "No account, no telemetry, no network required" — and in the
introducing post and the site. Three of those four words are about **what leaves
the machine**. The fourth, *no network required*, is about what the app needs to
work, and it stays true: nothing this decision adds is required for anything.

What could not stay is *no network at all*, because it makes the one defect that
gets worse with time permanently unfixable. LongClaw ships as a signed,
notarized DMG downloaded from the site. An installed copy cannot learn that a
newer one exists, so every copy is a permanent v0.1.0 and the population that
has to be told to reinstall by hand grows with every day the first release is
out. There is no version of "work offline" that is served by a security fix
nobody receives.

So the boundary moves from *no connection* to *no information*. A check that
sends nothing and can be switched off does not weaken the promise anyone
actually made; a checkbox that cannot be unticked would.

## What the check is, exactly

- **One request.** A `GET` for one static JSON manifest. No query parameters, no
  headers describing the machine or the build, no identifier of any kind, no
  cookie, no body. The manifest is the same bytes for every caller, so the host
  learns nothing from the request beyond what an HTTP request inherently
  carries: that an IP address asked for a public file.
- **One host.** `github.com`, and the object store it redirects release assets
  to. The allowlist is one constant in Rust and the same list in the runtime
  audit. The update artifacts and the manifest are assets of the same GitHub
  release, so the manifest is refreshed by the act of publishing the release and
  by nothing else.
- **When.** After the board has painted and the first idle frame has passed,
  at most once per launch, and again every 24 hours while the process lives.
  Never before first paint, and never on any other schedule.
- **Turned off** by one control in *Settings → Updates*, per machine, stored in
  the device preferences file ([ADR 0012](0012-device-preferences-are-a-file-rust-owns.md)).
  With it off, no request is made at any point in the process's life. *Check
  now* in the same pane still works, so off never means stranded.
- **Nothing downloads without a press**, and nothing restarts without a second,
  separate press. Neither is ever pressed on the person's behalf.
- **Every update is verified** against a minisign public key that ships inside
  the bundle, so a compromised host can serve a different program and the app
  will refuse it.

## What is still forbidden

Telemetry, analytics, crash reporting, usage counting — including counting how
many copies check. No account, no sign-in, no sync, no remote storage. No
request that carries a ticket, a project path, a query, a machine identifier or
anything derived from one. The webview gains no network capability: the CSP
`connect-src` restriction is unchanged, the capability's permission list is
unchanged, and the updater plugin's own JavaScript commands are never granted
and its npm package is never installed. The `longclaw` CLI links no updater and
stays under the strict no-network control.

## Where the decision lands in the code

The webview names an intent and never a URL, the shape
[ADR 0011](0011-cli-is-the-creation-surface-agents-use.md) chose for the CLI and
that `open_ticket_file` and `install_command_line` already take. Four app-defined
commands — check, download, install and restart, open the download page — run
under `core:default`, and Rust owns the host, the key and the request. Progress
crosses on a Tauri channel rather than the project-event topic, per
[ADR 0007](0007-commands-events-and-channels-have-distinct-ipc-jobs.md); failures
cross as the closed tagged shape of
[ADR 0010](0010-errors-cross-ipc-as-a-closed-tagged-shape.md), carrying a reason
the pane turns into a sentence.

Scheduling is the frontend's, because ADR 0012 has Rust keep the device
preferences without reading them, and the automatic-check preference lives
there. Rust performs the request. That split adds no second reader of the
preferences document.

## Offline is the baseline, not a degraded mode

This decision would not be worth making if it cost the offline case anything, so
it costs it nothing, and the claim is held by tests rather than by this
paragraph:

- No existing code path calls into the updater. Project open, ticket read and
  write, the watcher, the index, search, settings, the command-line install and
  the CLI never wait on, consult, or fail because of it.
- Startup issues no request before first paint, so no DNS lookup, proxy
  negotiation or TLS handshake can precede a frame.
- A request is one bounded attempt off the main thread. There is no retry loop
  and no backoff: a failed attempt ends, and the next is the next scheduled one
  or the next press of *Check now*.
- A failed check is not a state the app carries. Nothing outside the Updates
  pane reads it — no mark, no changed menu row, no toast, no dialog — so a
  machine that has never checked is indistinguishable from one that is up to
  date.
- Losing the network mid-download discards the download and leaves the installed
  bundle untouched. No half-applied update exists at any moment.
- A broken or absent updater configuration is a failed check, never a failed
  launch. A dev window reports the update path unavailable, the way the
  *Command line* pane already answers `unavailable` when there is no bundle to
  link.

## What the gates assert now

A gate that stops asserting anything is worse than one that goes red, so none of
the three is deleted and each keeps a self-test that fails on the old broad claim
*and* on a too-broad new one.

- **The static release audit** turns its forbidden-dependency list into an
  allowlist: the updater plugin and its transitive graph are the one permitted
  network-capable arrival in the macOS dependency tree, and any other
  network-capable crate still fails the build. The JavaScript updater package
  stays forbidden, as do the capability, permission and CSP assertions.
- **The binary audit** replaces *no network framework linked* with an enumerated
  expectation for the window binary — exactly the network symbols and frameworks
  the updater path links and no others — so the control fails when the set grows
  as surely as when it is absent. The CLI keeps the strict control.
- **The runtime network audit** keeps its offline phase unchanged: no connection
  at all. Its online phase gains an allowlist of the hosts above and a control
  that the check *was observed*, so silence is never mistaken for compliance. A
  third phase runs with the automatic check off and must be silent.

## Consequences

- The acceptance checklist, the user guide, the introducing post and the site
  say what is now true: no account, no telemetry, nothing about your projects
  leaves the machine, and one optional check for a newer LongClaw.
- [LC-257s](../../.longclaw/tickets/LC-257s/ticket.md), the GitHub star control,
  is a second caller on this allowlist rather than a new road, and its first
  checklist item — the amended contract — is answered here.
- The private updater key is a new thing that can be lost. Losing it orphans
  every installed copy, which is the exact problem this decision exists to end,
  so its backup is a prerequisite to shipping rather than a follow-up. The
  [release signing runbook](../release-signing-runbook.md) holds the rule.
- Hosting the manifest on the Pages site was considered and rejected. It would
  be refreshed by a separate site deploy from a separate branch — precisely the
  *manifest was not refreshed* failure mode — and would tie the update path to
  the site's build rather than to the release.
- A silent or automatic install was rejected. Two presses cost the person one
  extra click and buy the guarantee that no version change ever happens under an
  open ticket.
- Rotating the updater key is out of scope and is not decided here.
