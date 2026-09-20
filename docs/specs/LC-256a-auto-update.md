---
title: "Auto-update: the update path, and the experience around it"
product: LongClaw
status: proposed
ticket: LC-256a
---

# Auto-update: the update path, and the experience around it

The spec for [LC-256a](../../.longclaw/tickets/LC-256a/ticket.md). Written on
2026-09-18 from the ticket as filed, [LC-47](../../.longclaw/tickets/LC-47/ticket.md),
[LC-257s](../../.longclaw/tickets/LC-257s/ticket.md), ADRs
[0007](../adr/0007-commands-events-and-channels-have-distinct-ipc-jobs.md),
[0009](../adr/0009-rust-owns-filesystem-authority-and-project-persistence.md),
[0010](../adr/0010-errors-cross-ipc-as-a-closed-tagged-shape.md),
[0011](../adr/0011-cli-is-the-creation-surface-agents-use.md) and
[0012](../adr/0012-device-preferences-are-a-file-rust-owns.md), the three network
gates as they stand on `main`, and
[the signing runbook](../release-signing-runbook.md).

## Problem Statement

LongClaw ships as a signed, notarized DMG downloaded from longclaw.io. An
installed copy has no way to learn that a newer one exists, and no way to get
one except the person going back to the site and repeating the install. Every
v0.1.0 in the world is a permanent v0.1.0.

This is the one defect that gets worse with time and cannot be fixed
retroactively. A person who installs today and never returns to the site is
unreachable by every later fix, and the longer the first release is out without
an update path, the larger the population that has to be told to reinstall by
hand.

It was deliberately deferred. LC-47 put the Tauri updater out of scope for
v0.1.0 in as many words — "It carries its own separate signing key and is not
part of v0" — and that was the right call for shipping. This is the
follow-through, not a contradiction of it, and the separate signing key is
still the first real obstacle.

## Solution

LongClaw learns, quietly, that a newer version exists; tells the person which
version and what changed in it; downloads it only when they press a button; and
restarts into it only on a second, separate press, never while a ticket write
is in flight. Turning the automatic check off and checking by hand both live in
Settings, beside *Command line*, the other pane that is about the app rather
than the project. Nothing about the person, their projects or their tickets
travels with the check. Offline, behind a proxy, or with the check failing, the
app behaves exactly as it does today and says nothing about it outside that
pane.

**Nothing that works today stops working, and nothing that works today starts
needing a network.** Offline is the baseline, not a degraded mode: with no
internet at all, every feature the app has — opening a project, the board and
the list, reading and writing tickets, the watcher, search, settings, the
`longclaw` command — behaves identically to v0.1.0, and the only thing that
does not happen is the update check and the download it can lead to. The
invariants that make this true are D10, and the tests that prove it are in
Testing Decisions.

The app's promise is amended rather than broken. Today three gates assert *no
network at all*. The promise they were written to protect is narrower — no
telemetry, no analytics, nothing about the person or their data leaves the
machine — and an update check can sit inside it if it is written to: one
identifier-free request for one static file, to a named host, that the person
can turn off. The gates are rewritten to assert that narrow shape rather than
deleted, and the amendment is recorded as an ADR the audit docs cite instead of
re-arguing.

## User Stories

The actors: a **person using LongClaw** at the keyboard of their own Mac; an
**offline person**, with no network, a proxy, or a network that blocks GitHub;
a **release engineer**, whoever ships the next version by the runbook; a
**release reviewer**, whoever walks the acceptance checklist; a **keyboard-only
person** and a **screen-reader person**; and an **agent** working in this
repository.

### Learning that an update exists

1. As a person using LongClaw, I want the app to notice a newer version on its own, so that I am not a permanent v0.1.0 because I never went back to the website.
2. As a person using LongClaw, I want the check to run only after my board has painted, so that an update check never delays my first frame or my first keystroke.
3. As a person using LongClaw, I want to be told an update exists in a quiet way, so that a version notice never interrupts the ticket I am editing.
4. As a person using LongClaw, I want the notice to name the version and show what changed in it, so that I can decide whether I want it now.
5. As a person using LongClaw, I want "what changed" to be the release notes the site publishes, so that the app and the changelog can never disagree.
6. As a person using LongClaw, I want to skip a version, so that the mark goes away until there is something newer than the one I declined.
7. As a person who leaves the app open for weeks, I want it to check again about once a day, so that I do not have to relaunch to hear about an update.

### Choosing to update

8. As a person using LongClaw, I want nothing downloaded until I press a button, so that the app never uses my network without my knowing.
9. As a person using LongClaw, I want to see download progress and keep working while it runs, so that an update never holds my project hostage.
10. As a person using LongClaw, I want the restart to be a separate, explicit press after the download, so that no version change happens under an open ticket without me.
11. As a person using LongClaw, I want the app to refuse to restart while a ticket write is in flight, and to say so, so that an update can never lose the sentence I just typed.
12. As a person using LongClaw, I want the app to come back on the project I had open, so that an update costs me nothing but the relaunch.
13. As a person who installed the `longclaw` command, I want it to still work after an update, so that my agents and my terminal do not break on a version I chose.
14. As a person using LongClaw, I want the updated app to be the same signed, notarized build the site offers, so that an update is never a weaker artifact than a fresh install.

### Failure and offline

15. As an offline person, I want a failed check to make no noise, so that an app that promised to work offline never nags me about a network it does not have.
16. As an offline person, I want the app to work exactly as it does today, so that the update path costs me nothing.
17. As a person behind a proxy or a blocking firewall, I want the check to fail quietly and quickly, so that a blocked host never freezes anything.
18. As a person using LongClaw, I want a download that fails to verify to be discarded and said so, so that the app never installs something it cannot vouch for.
19. As a person using LongClaw, I want a corrupt or interrupted download to be recoverable by trying again, so that one bad network moment does not leave me stuck between versions.
20. As a person using LongClaw, I want a failed download to leave my installed app untouched, so that a failed update is never a broken app.
21. As a person using LongClaw, I want the Settings pane to show when the last successful check was, so that a quiet failure is still visible to someone who goes looking.
22. As an offline person, I want every feature I use today — projects, tickets, the watcher, search, settings, the `longclaw` command — to work identically with no internet, so that the update path is the only thing the network gates.
23. As an offline person, I want no mark on the gear, no changed menu row and no sentence about updates anywhere but the pane, so that a machine that has never checked looks exactly like one that is up to date.
24. As a person on a flaky network, I want a check to try once and stop, so that the app never retries in a loop or burns my connection in the background.
25. As a person launching the app on a plane, I want first paint and project open to take exactly as long as they do today, so that an unreachable host is never a slower launch.
26. As a person whose download was cut off by losing the network, I want the partial file discarded and my installed app untouched, so that going offline mid-download costs me nothing.
27. As a developer running the dev window, I want the app to launch and work with no updater configured, so that a missing key or manifest is a failed check and never a failed launch.

### Control

28. As a person using LongClaw, I want a Settings pane where I can turn the automatic check off, so that a machine I want silent stays silent.
29. As a person using LongClaw, I want a *Check now* button in that pane, so that turning the automatic check off never means I cannot update.
30. As a person using LongClaw, I want the pane to show the version I am running, so that I can answer "which version do you have?" without opening Finder.
31. As a person using LongClaw, I want the choice to be per machine, so that turning it off on my work Mac does not turn it off at home.
32. As a person using LongClaw, I want a way to the download page when the in-app update cannot complete, so that there is always a path to the current version.

### Privacy

33. As a person using LongClaw, I want the check to send nothing about me, my projects or my tickets, so that "no telemetry" stays true in the plain meaning of the words.
34. As a person using LongClaw, I want the pane to say exactly what the check sends and to whom, so that I do not have to take the promise on faith.
35. As a person using LongClaw, I want every update verified against a key that ships inside the app, so that a compromised host cannot hand me a different program.
36. As a person who cares about this, I want the app's network behaviour written in a decision record and enforced by the release gates, so that the amendment is auditable rather than remembered.

### Accessibility

37. As a keyboard-only person, I want every control in the pane and the menu row reachable by Tab and operable by Enter and Space, so that updating never needs a pointer.
38. As a screen-reader person, I want an update becoming available, and a download finishing, announced once through a live region, so that I learn about them without seeing a mark.
39. As a screen-reader person, I want a refused restart announced with its reason, so that I know a save is still in flight rather than that the button is broken.

### The release engineer

40. As a release engineer, I want a runbook section for the updater key — where it lives, how it is backed up, what losing it costs — so that the next release does not depend on the person who shipped this one.
41. As a release engineer, I want the release script to produce the update artifact, its signature and the manifest in one run, so that a release cannot ship without its update path.
42. As a release engineer, I want the manifest's notes taken from the release notes file, so that I never retype them.
43. As a release engineer, I want the script to read the published manifest back and confirm it names the version just shipped, so that a release that updates nobody is caught before anyone is told about it.
44. As a release engineer, I want the update artifact to carry the stapled, notarized app, so that an updated install is not weaker than a fresh one.
45. As a release engineer, I want the binary audit to check that the bundled public key verifies the manifest's signature, so that a key mismatch fails the build rather than every user's update.
46. As a release engineer, I want the whole thing re-runnable after an interruption, the way notarization already is, so that a network blip during upload does not mean starting over.

### The release reviewer

47. As a release reviewer, I want the acceptance checklist to state the new narrow network shape, so that I am checking the promise the app actually makes.
48. As a release reviewer, I want the runtime network audit to pass on exactly the update check and fail on anything else, so that a second caller cannot ride in on the updater's road unnoticed.
49. As a release reviewer, I want the static audit to permit exactly the updater's dependencies and fail on any other network-capable crate, so that the gate keeps asserting something.
50. As a release reviewer, I want each amended gate to keep a self-test that fails on the old broad claim and on a too-broad new one, so that a gate that stopped watching is caught.

### Agents and the repository

51. As an agent working in this repository, I want the ADR to say why the promise was amended and how narrow the amendment is, so that I never re-argue it in a ticket.
52. As an agent, I want every user-facing string in a copy deck in the ticket before it reaches the source, so that the copy is reviewed once and shipped once.
53. As an agent picking up LC-257s, I want one sanctioned network path with a named host allowlist, so that the star count is a second caller on an existing road.

### The website

54. As a person reading longclaw.io, I want the site to say "auto-updates" only once the version the download gives me has them, so that the site never oversells.
55. As a person reading the changelog, I want the release that ships this to say what the check sends, so that the privacy answer sits beside the feature.

## Implementation Decisions

### D1. The amendment is an ADR, written before any code

A new ADR — the next number in the sequence — records that the app makes one
identifier-free request to learn about updates and nothing else. It states what
is sent (a GET for one static manifest file, with no query parameters, no
identifiers, and nothing that describes the machine, the build or the person
beyond what an HTTP request inherently carries), to whom (the hosts named in
D4), when (D5), how it is turned off (D6), and that every gate asserts exactly
this shape (D7). It considers the hosting alternatives and records the choice.
It is the same class of decision as ADR 0009 and ADR 0011, and the acceptance
document, the user guide and the site cite it rather than restating the
argument.

### D2. Mechanism: Tauri's updater plugin, driven from Rust only

- The official Tauri updater plugin does the check, the download, the signature
  verification and the in-place install. Minisign verification and bundle
  replacement are a security-critical path, and a hand-written one would be a
  second implementation of it, which is the thing ADR 0011 exists to avoid.
- **The webview is granted nothing new.** The capability's permission list
  stays exactly `core:default`, `core:event:default` and `dialog:allow-open`;
  the plugin's own JavaScript commands are never granted and its npm package is
  never installed. The static audit asserts both.
- The webview names an intent and no URL, in the shape of `open_ticket_file`
  and `install_command_line`. Four app-defined commands: *check for an update*,
  *download the pending update*, *install and restart*, and *open the download
  page*. Their results are camelCase DTOs; their failures cross IPC as the
  closed tagged error shape of ADR 0010, carrying a reason the pane can turn
  into a sentence (offline, blocked, bad manifest, bad signature, corrupt
  download, write in flight).
- Download progress crosses as a Tauri channel, per ADR 0007's rule for ordered
  streams, with `started`, `progress` (received and total bytes) and `finished`
  frames. It does not ride the project-event topic, which is for project
  changes.
- The version compared is the one the bundle carries; the comparison is semver
  and happens on the machine. The manifest is static and the request carries no
  templated variables, so the server learns nothing about which build asked.
- Only the Apple Silicon entry exists in the manifest in v0, matching the one
  artifact the release produces.

### D3. The updater signing key

- Generated once with Tauri's signer. The public half is committed in the Tauri
  configuration under the updater plugin's section, which is how it gets into
  every bundle. The private half and its password live in the release machine's
  login keychain beside the Developer ID identity — the runbook's *one machine,
  no CI signing* rule holds for this key too — and are backed up by the account
  holder outside the repository, at a location the published runbook
  deliberately does not name.
- The runbook gains a section for it: a row in the identity table, the backup
  rule, and the consequence in plain words. Losing the private key orphans every
  installed copy, which can then only be updated by hand — the exact problem
  this ticket exists to end — so the backup is a prerequisite to shipping, not
  a follow-up. Rotation is out of scope and said to be.
- At release time the binary audit verifies the manifest's signature against
  the public key read out of the built bundle, so a mismatch fails the build
  rather than every update.

### D4. Hosting: GitHub Releases, for the manifest and the artifacts

- The update archive, its signature, the DMG the site links, and the manifest
  are all assets of the same GitHub release, uploaded by the release script in
  one step. The app reads the manifest from the release's stable *latest*
  download URL, so the manifest is refreshed by the act of publishing the
  release and by nothing else.
- Allowed hosts: `github.com`, and the object store it redirects release assets
  to. The allowlist is one constant in Rust and the same list in the runtime
  audit, and it is the road LC-257s reuses.
- Considered and rejected, and recorded so in the ADR: a manifest on the Pages
  site. It would be refreshed by a separate site deploy from a separate branch —
  precisely the *manifest was not refreshed* failure mode the ticket names — and
  it would tie the update path to the site's build rather than to the release.

### D5. Scheduling lives in the frontend; the request lives in Rust

- ADR 0012 has Rust keep the device-preferences file and never read it, and the
  automatic-check preference lives there. So the frontend, which already reads
  that document before first render, decides *when* to ask, and Rust performs
  the request when asked. This keeps the intent shape of D2 and adds no second
  reader of the preferences.
- The first check runs after the board has painted and the first idle frame has
  passed, never before first paint, and at most once per launch. While the
  process lives it checks again every 24 hours. *Check now* checks regardless.
  A check requested while one is in flight joins it rather than starting a
  second.
- The device-preferences document gains: whether the automatic check is on
  (default on), the version the person skipped, and the time and result of the
  last successful check. Device-local because the answer is about this Mac, as
  the command-line offer already is. Validated in the frontend like every other
  field; a value this build does not recognise is dropped, not carried.

### D6. The experience

- **The notice is quiet.** When an update is available and not skipped, the
  gear control in the header carries a mark and its menu gains a row naming the
  version, which opens the *Updates* pane. No modal, no dialog on launch, and
  not a toast — the toast stack belongs to mutations and a new one supersedes
  the last. The live region announces the availability once.
- **The pane** is a new settings section beside *Command line*, added to the one
  list that holds both the nav label and the menu label. It shows: the running
  version; the automatic-check toggle with one sentence saying what the check
  sends and to whom; *Check now*; when the last successful check was. When an
  update is available it adds the version, its release date, the release notes
  from the manifest rendered as Markdown, and two buttons: *Download* and *Skip
  this version*. During a download it shows progress and stays usable. After
  the download it offers *Restart to update*.
- **Consent is two presses.** Nothing downloads until *Download*; nothing
  restarts until *Restart to update*. Neither is ever pressed for the person.
- **Never mid-write.** The frontend disables *Restart to update* and says why
  while the mutation store — the same store the header's disk-state indicator
  reads — has a write outstanding, and re-enables it when the disk settles.
  Rust refuses too, with a typed error, from a count of writes in flight kept
  around the atomic write seams, because ADR 0009 puts the invariant with the
  write rather than with the button. The frontend's sentence is the experience;
  the Rust refusal is the guarantee.
- **Restart reopens the same project**, which the last-open-project preference
  already does. The `longclaw` symlink survives because the bundle is replaced
  in place at the same path.
- **Failure is quiet and specific.** A failed check changes nothing outside the
  pane, where it reads as *couldn't check* beside the last successful time. A
  download that fails to verify is discarded and the pane says so, offering
  *Try again* and *Open the download page*. An interrupted download offers the
  same. No failure produces a dialog, and an offline machine that has never
  checked reads, outside the pane, exactly like one that checked and is up to
  date.
- **Turning it off** is the toggle; *Check now* still works with it off, so off
  never means stranded.
- **Every string is copy**, including the gear's `aria-label` when it carries
  the mark, the live-region sentences and the disabled button's reason. The
  provisional deck is in Further Notes and is settled in the ticket before any
  of it reaches the source.
- The pane's controls carry explicit `tabIndex`; the new menu row and the
  disableable button change the keyboard contract, so `a11y:audit` runs against
  the focus map, and `probe:header` runs because the gear's mark lives in the
  header.

### D7. The gates assert the narrow shape rather than being deleted

- **The static release audit** turns its forbidden-dependency lists into an
  allowlist: the updater plugin and its transitive graph are the one permitted
  network-capable arrival in the macOS dependency tree, and any other
  network-capable crate still fails the build. The JavaScript updater package
  stays forbidden. The capability, permission and CSP assertions are unchanged.
  The rule that this crate's own shipped source calls no HTTP client stays,
  because only the plugin speaks HTTP.
- **The binary audit** replaces *no network framework linked* with an
  enumerated expectation for the window binary: exactly the network symbols and
  frameworks the updater path links, and no others — a control that fails when
  the set grows as surely as when it is absent. The CLI keeps the strict
  no-network control, because it starts no updater. A new check verifies the
  bundled public key against the manifest signature (D3). Its self-test must go
  red on the old summary line and on an extra network symbol.
- **The runtime network audit** keeps its offline phase unchanged: no
  connection at all. Its online phase gains an allowlist of the D4 peers, a new
  control that the update check *was observed* — so that silence is never
  mistaken for compliance — and fails on any other peer. A third recorded phase
  runs with the automatic check off and must be silent. The step list the
  operator followed is recorded beside the result, as it is today.
- **The acceptance document's** two rows that certify no updater and no
  connection are rewritten to the narrow shape and cite the ADR. The user
  guide's sentence about needing no network, the introducing blog post's
  paragraph and the site's boundary copy are revised to say what is now true:
  no account, no telemetry, nothing about your projects leaves the machine, and
  one optional check for a newer LongClaw.

### D8. The release script grows the update step

- The order is: build, sign, notarize, staple, **then** archive the stapled app,
  sign the archive with the updater key, write the manifest with the notes
  taken from that version's release notes file, create the GitHub release with
  every asset, and finally fetch the published manifest back and assert that it
  names the version just shipped and that its signature verifies against the
  bundle's key. The archive is made after stapling so the app an update
  installs is the same stapled, notarized app a fresh install gets.
- Every step is skipped when already done, the way stapling is, so an
  interrupted run is resumed rather than restarted.
- The manifest's notes come from the release notes under `docs/release-notes`,
  which the site's changelog entry already follows. One source, so the sentence
  the pane shows is the sentence the site shows.
- The manifest step and the notes extraction are pure functions with their own
  check in the gate, so a release is never the first time they run.

### D9. The CLI is untouched

The CLI links no updater and stays under the strict no-network control. It is
updated when the app is, because it ships inside the bundle that is replaced,
which is the property LC-233 chose it for.

### D10. Offline invariants: nothing else needs the network, ever

These hold on every build, and each one is asserted by a test named in Testing
Decisions rather than by this sentence.

- **No existing code path calls into the updater.** Project open, ticket read
  and write, the watcher, the index, search, settings, the command-line
  install and the CLI are unchanged and never wait on, consult, or fail because
  of the update path. The update module is called by exactly two things: the
  frontend's schedule and the pane's buttons.
- **Startup never touches the network.** The first check is issued after the
  board has painted and the first idle frame has passed, from the frontend, so
  no DNS lookup, proxy negotiation or TLS handshake can precede a frame. The
  startup budgets in `perf:startup` are unchanged and re-measured.
- **A request is bounded and runs off the main thread.** One attempt per
  schedule slot, with a short connect timeout and a bounded total, on Rust's
  side; the webview and the engine never block on it. There is no retry loop
  and no backoff: a failed attempt ends, and the next is the next scheduled one
  or the next press of *Check now*.
- **A failed check is not a state the app carries.** Nothing outside the pane
  reads it. No mark, no changed menu row, no live-region sentence, no toast, no
  dialog. A machine that has never checked and a machine that is up to date are
  indistinguishable outside the pane, and the pane says *not checked yet*
  rather than reporting an error.
- **Losing the network mid-download discards the download.** The partial file
  is thrown away, the installed bundle is untouched, and the pane offers *Try
  again*. No half-applied update exists at any moment.
- **A broken updater configuration is a failed check, never a failed launch.**
  A dev window, the perf harness, a `vitest` render, or a bundle whose key or
  manifest is missing all launch and work; the update path reports itself
  unavailable, the way the *Command line* pane already answers `unavailable`
  when there is no bundle to link. The plugin is initialised so that a
  configuration fault degrades the update path and nothing else.
- **The preference is honoured before the first request.** With the automatic
  check off, no request is made at any point in the process's life, which the
  runtime audit's third phase records.
- **The CLI makes no connection.** It links no updater and the binary audit
  keeps its strict no-network control (D7).

## Testing Decisions

A good test here asserts what a person or a reviewer can observe — the sentence
the pane shows in a state, the connection the audit sees or does not, the
refusal a write in flight produces, the manifest a release publishes — and
never how the plugin was called or which function ran. The plugin is Tauri's;
its network behaviour is covered by the runtime audit, not by a unit test
pretending to be the internet.

### Seams, highest first

1. **The Rust update module's inner functions**, split from the Tauri commands
   the way the command-line install splits its describing function from the
   command that calls it: the plugin, the clock and the count of writes in
   flight are handed in, so the suite drives every state without a network —
   up to date, available, skipped, each failure reason, verification failed,
   restart refused. This is the highest seam, and where most of the feature's
   logic is tested, with `cargo test`.
2. **The frontend over the mocked `api` module**, exactly as the *Command line*
   pane's test does it: render the pane and the gear menu, drive each state,
   and assert the sentences; assert *Restart to update* is disabled with its
   reason while the mutation store has a write outstanding and enabled once it
   settles; assert the live-region text and that *Skip this version* removes
   the mark. The new preference fields are covered where the other
   device-preference fields are: a stored value this build does not know is
   dropped.
3. **The IPC contract**: the update-state DTO, the error reasons and the
   progress frames join the shared JSON fixture that Rust asserts and the
   frontend replays, which is ADR 0007's existing seam for keeping the two
   sides on one visible contract.
4. **The gates' self-tests**: each amended gate must go red on the
   pre-amendment broad state and on an over-broad one — a second
   network-capable crate, a second peer, a second symbol — and green on
   exactly the narrow shape. A gate whose self-test still passes after the
   amendment is a gate that stopped watching.
5. **The existing runs**: `a11y:audit` for the new pane, the menu row and a
   button that can be disabled; `probe:header` because the gear's mark is in
   the header. Both are quoted in the ticket.

No new seam is created for the network itself. The one seam this spec adds is
the first: the module boundary between the update decisions and the plugin
that carries them out.

### Proving nothing else broke, and that offline is unchanged

The offline invariants of D10 are regression claims, and each one is an
assertion in the suite or a recorded run:

- **The whole existing gate passes unchanged.** `npm run verify` — the Rust
  suite, the frontend suite, the native watcher round trip and every guard —
  runs green with the update path present, with no test rewritten to
  accommodate it. A test that had to change to stay green is a behaviour that
  changed.
- **Every other operation survives a dead updater.** Through seam 1, the Rust
  suite drives the update module with a plugin that fails every call, hangs, or
  is absent, and asserts that project open, ticket write, the watcher's
  rebuild and search complete exactly as they do without it. The same test
  proves a configuration fault is a failed check and not a panic at startup.
- **Nothing outside the pane changes when a check fails.** Through seam 2, the
  frontend suite renders the app with the check rejecting for each reason —
  offline, blocked, bad manifest — and asserts the header, the gear, the menu
  and the live region render byte for byte as they do with no update path at
  all.
- **Startup issues no request before paint.** Through seam 2, the suite asserts
  the check is not invoked until after the board has painted and the idle
  frame has passed, and `perf:startup` is re-run against a built bundle and
  quoted, unchanged.
- **Offline is measured, not assumed.** The runtime audit's offline phase must
  still record zero connections across launch, project open, create, edit,
  archive, search and restart; its third phase, automatic check off and the
  machine online, must record zero as well. Both runs are quoted in the ticket.
- **One attempt, then silence.** The Rust suite asserts that a failed check
  makes exactly one request per schedule slot and none afterwards, against an
  injected clock.

### Prior art

- The command-line install's describing function, split out so the suite can
  drive it against a temporary directory rather than `/usr/local/bin`.
- The *Command line* pane's test, whose whole argument is that five states and
  one refusal get six different sentences.
- The IPC request tests and the shared fixture from ADR 0007.
- The `--self-test` inversions on the binary audit, the runtime audit, the
  header probe and the citation guard.
- The device-preferences tests, for a field that must be validated and dropped.

## Out of Scope

- Windows, Linux, Intel and universal builds. v0.1.0 is an Apple Silicon build
  and so is the first update.
- Silent or automatic download, install on quit, or any restart the person did
  not press.
- Delta updates, update channels such as a beta track, and rollback or
  downgrade.
- Rotation of the updater key.
- The GitHub star control, LC-257s, which follows this path rather than
  building its own.
- A `--version` flag on the CLI. Noted as separately useful, since the
  changelog already lists its absence.
- Any change to the Developer ID identity, the notarization flow or the DMG the
  site links.
- App Store or sandboxed distribution.
- Telemetry of any kind, including counting how many copies check.

## Further Notes

**Order of work.** The ADR first, because it is what the gates and the docs
cite. Then the key and its runbook section, because nothing can be verified
without it. Then hosting and the release script, so a manifest exists to check
against. Then the Rust module and the gates together, since the gates are what
tell the module it is honest. Then the pane, the menu row and the copy. Then
the acceptance document, the user guide and the site.

**LC-257s.** Once the ADR lands, that ticket's first checklist item — the
amended contract — is answered, and its fetch is a second caller on the D4
allowlist rather than a new road.

**The site.** The release that ships this gets a changelog entry through the
`changelog-entry` skill, and the *no network* sentences on the site change
through `website-change`, in their own pull request, once the download the site
offers is the version that has the check.

**The ticket's checklist** mirrors D1 through D10 item for item and is the
record of progress; this document is the record of intent.

### Provisional copy deck

Every row is new. Ids are for replies (`updates.pane.restart.blocked → …`).
`{version}`, `{age}`, `{date}`, `{received}` and `{total}` are filled at
render. The deck is settled in the ticket before any string reaches the source.

| Id | Kind | Where | Text |
|---|---|---|---|
| `updates.nav.label` | nav row | Settings side nav | Updates |
| `updates.menu.label` | menu row | gear menu, no update pending | Check for updates… |
| `updates.menu.available` | menu row | gear menu, update pending | Update to {version}… |
| `updates.gear.aria` | aria-label | gear control while the mark shows | Settings. An update is available. |
| `updates.pane.version` | note | pane, first line | LongClaw {version} |
| `updates.pane.automatic.label` | toggle label | pane | Check for updates automatically |
| `updates.pane.automatic.note` | note | under the toggle | Once a day, after the app opens. The check fetches one file from LongClaw's GitHub release and sends nothing about you or your projects. |
| `updates.pane.check` | button | pane | Check now |
| `updates.pane.checking` | frame | pane, while a check runs | Checking… |
| `updates.pane.last` | note | pane | Last checked {age} |
| `updates.pane.never` | note | pane, no successful check yet | Not checked yet |
| `updates.pane.uptodate` | note | pane, after a check | You're on the latest version. |
| `updates.pane.available.title` | heading | pane, update pending | {version} is available |
| `updates.pane.available.date` | note | under the heading | Released {date} |
| `updates.pane.download` | button | pane, update pending | Download {version} |
| `updates.pane.skip` | button | pane, update pending | Skip this version |
| `updates.pane.progress` | frame | pane, during download | Downloading… {received} of {total} |
| `updates.pane.restart` | button | pane, download complete | Restart to update |
| `updates.pane.restart.blocked` | note | beside the disabled restart button | Waiting for a save to finish. |
| `updates.pane.check.failed` | note | pane, check failed | Couldn't check for updates. |
| `updates.pane.verify.failed` | refusal | pane | The download couldn't be verified and was discarded. |
| `updates.pane.download.failed` | refusal | pane | The download didn't finish. |
| `updates.pane.retry` | button | pane, after a failure | Try again |
| `updates.pane.downloadpage` | button | pane, after a failure | Open the download page |
| `updates.live.available` | live region | announced once | LongClaw {version} is available. Open Settings, then Updates. |
| `updates.live.ready` | live region | announced once | LongClaw {version} is downloaded. Restart to update. |
| `updates.live.blocked` | live region | on a refused restart | Restart is waiting for a save to finish. |
