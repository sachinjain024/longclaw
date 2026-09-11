---
format: longclaw.ticket/v1
id: 56b7f9f7-f384-406c-997b-257ab8bf0b94
key: LC-249a
title: Make installing the longclaw command explain itself
status: in_review
priority: p1
labels:
  - frontend
  - design
created_at: 2026-09-11T06:33:38.630Z
updated_at: 2026-09-11T12:51:02.742Z
---

LC-233 put the `longclaw` binary inside the signed bundle and a button in two
places. What it never did was say **why**. The pane opens on what the button
writes to the filesystem and closes on a promise about folders — a complete
answer to a question nobody has asked yet, because nothing on screen has said
what the command is *for*. A person meeting the first-launch dialog has just
opened a project manager; they are being asked to let an app write outside every
folder they picked, in exchange for something the dialog never names.

This is the experience half of LC-233. No new platform work, no second write to
design — the five states already have a Rust answer each, and every one of them
is already correct.

## The design

Imported from Claude Design, `CLI Install.dc.html`
(project `c0d1f001-38a6-4bc0-9e51-da4d1d011525`). Its strongest idea is a
**preview of the thing being installed**: one real command, its real output,
above the fold in the dialog. That is the sentence the shipped pane is missing.

## What this adds

- **A preview block.** One command, its output, in the inverse surface. The
  argument for pressing the button, made before the button is described.
- **Fewer sentences everywhere else.** A `what it writes` box and a preflight
  line were both drawn and both cut in review — first from the dialog, then from
  the pane — so neither ships. The preflight was the only reader of a proposed
  writability field on `CommandLineStatus`, which is why **nothing is needed
  from Rust**: all five states already have an answer each and every one is
  already correct.
- **A dismissal that says so.** Skipping is currently silent while quietly
  writing a preference that stops the offer ever opening again.
- **An `Ask again` checkbox.** `commandLinePrompted` is written once today and
  has no way back: skip on first launch and that Mac can never be asked again.
- **`Try again` after a refusal.** The button reads `Install` after a failed
  install, so pressing it twice looks like the first press did not register.
- **The buttons together, bottom-right.** Today the primary sits mid-body in
  `.cli-actions` and the dismissal sits in the dialog's own footer, so the two
  halves of one decision are in two places.

## Where the design is wrong

Four things in `CLI Install.dc.html` cannot ship as drawn. The prototype
corrects them rather than transcribing them, and the corrections are the reason
this ticket carries a prototype at all.

1. **The path.** The design links `Contents/Resources/bin/longclaw`. It is
   `Contents/MacOS/longclaw` — a Mach-O under `Resources` is the classic
   notarization rejection, which LC-233 names outright.
2. **The admin prompt.** The design has an `auth` stage: *"macOS is asking you
   to approve the change."* There is no such stage and there cannot be —
   `release-audit.mjs:254` fails the build on `Command::new`, so
   `osascript … with administrator privileges` is unavailable and no privileged
   helper was built. The write is one synchronous `symlink` that succeeds or
   returns `EACCES`.
3. **The commands.** The design's terminal shows `longclaw list --status todo`
   printing a formatted table, and `longclaw --version`. The verb is
   `ticket list`, it takes no `--status`, it prints JSON, and there is no
   `--version` at all. A trust-building block demonstrating a command that does
   not exist inverts the first time somebody runs it.
4. **Four states, not five.** The design covers ask / installing / done / error.
   The app has `linked`, `stale`, `occupied`, `absent` and `unavailable`, and
   `stale` is the interesting one — the state a terminal reports as working
   while it runs the wrong build.

## Settled before drawing

- **UI pass only.** No `Remove link`, no `--version` badge, no
  `Reveal in Finder`, no status-bar chip. Each is new capability, and LC-233
  declined the first two on purpose ("removing a link the app made is a second
  write to design, and nothing asked for one").
- **The pane stays in project settings.** The design re-homes it to an app-level
  Settings window under `Integrations`; no such window exists and building one is
  its own ticket. The row treatment comes across, the re-home does not. The
  closing note that said the pane is not project data was cut in review — see
  the open question about what carries that now.
- **Dismissal is per-Mac, not per-project.** The design says "permanent for this
  project" in one place and "when I open a project" in another.
  `commandLinePrompted` is a device preference, and that is right: the link is a
  fact about the Mac.

## The prototype

[`docs/ux/prototypes/LC-249a-Make-Installing-The-Longclaw-Command-Explain-Itself.html`](../../../docs/ux/prototypes/LC-249a-Make-Installing-The-Longclaw-Command-Explain-Itself.html)
— four scenes (first launch, settings pane, dismissed, copy deck) across all
five states, with a driver for the refusal. Four rounds of review took it from
45 rows to **38: 18 new, 6 changed, 14 unchanged**, and the scenes render from
the deck rather than beside it.

What the review changed, in order: the dialog lost its status line, its
preflight row and its `what it writes` box, and got wider; the dark-mode preview
was a real defect and was fixed; the pane then lost the preflight, the box, the
`absent` sentence and its closing note; and the dialog's title and lede were
taken from the Claude Design canvas with two slips repaired.

### The answers the review settled

1. **The preview stays in the dialog.** The dialog is where the decision is
   actually made, so the argument has to be in it.
2. **The output is an abbreviation, and says so.** `ticket list` prints
   pretty-printed JSON — 251 objects of ~15 fields on this repository — so no
   honest two-line rendering of it exists. The caption carries `example`. Two
   truthful alternatives were considered and not taken: a `| jq -r` pipeline,
   which really does print exactly these two lines and is a noisy thing to put
   in a first-run modal, and a human-readable list mode on the CLI, which is a
   feature and its own ticket.
3. **The human accent, on both surfaces.** LC-233's `.cli-state.ok` argued the
   agent accent as "a machine is involved and it is working" — true of what the
   command does, and the wrong subject: the sentence reports that somebody
   pressed a button. The check on the answered title and the pane's `linked` dot
   are the human accent, and one installed state cannot be two colours on two
   surfaces, so the older comment is the one that went.
4. **`Ask again` belongs to the pane.** Offering somebody the chance to opt out
   of being asked *while they are being asked* is one more control in a
   first-run modal for a decision they have already been handed.
5. **`stale` keeps its sentence in the dialog.** It is the one state whose
   sentence nothing else on that screen carries: the command already works from
   a terminal and is running the wrong build, and `Point it at this app` alone
   would be carrying the whole explanation.

### Still open, and deliberately not answered by this ticket

- **The lede names `PATH` but not the write.** "Add the `longclaw` binary to
  your `PATH`" says something lands somewhere; it does not say *where*. No
  `/usr/local/bin`, no symlink — that path now appears only in the `sudo` line
  after a refusal. This is the one press in the app that writes outside a
  project folder, and LC-233's stated reason for prompting at all was that it
  must never do so silently. The copy came from the design and was confirmed in
  review, so it ships as written and this is filed rather than fixed.
- **Nothing says the pane is not project data.** It sits in the project settings
  panel next to labels and statuses, which are all stored in `longclaw.yaml`,
  and the closing note that said otherwise was cut in review. Something else has
  to carry it, and a paragraph put back without being asked for is not it.

## The settled copy deck

The prototype is deleted once this ticket ships; this is the copy, and it is
what whoever ships it reads. `status` is against what the app shipped before
LC-249a.

#### The offer

| id | text | kind | where | status |
|---|---|---|---|---|
| `offer.title` | Use LongClaw with Agents | dialog title | first launch | changed |
| `offer.title.done` | `longclaw` is on your PATH | dialog title | first launch · after installing | new |
| `offer.lede` | Add the `longclaw` binary to your `PATH` so agents can read, file, update and close tickets. | lede | first launch, settings pane | changed |

#### The preview

| id | text | kind | where | status |
|---|---|---|---|---|
| `preview.caption` | what it gets you · example | caption | first launch, settings pane | new |
| `preview.caption.stale` | what it is running today · example | caption | first launch · stale | new |
| `preview.actor` | claude-code | prompt (decorative) | first launch, settings pane | new |
| `preview.cmd` | longclaw ticket list | sample command | first launch, settings pane | new |
| `preview.out1` | LC-131  Sign release build with hardened runtime | sample output | first launch, settings pane | new |
| `preview.out2` | LC-134  Empty state for a project with no .longclaw folder | sample output | first launch, settings pane | new |

#### The five states

| id | text | kind | where | status |
|---|---|---|---|---|
| `state.absent` | `longclaw` is not on your `PATH` yet. | state | settings pane | ships |
| `state.linked` | `longclaw` is installed at `{link}` and points at this copy of LongClaw. | state | settings pane | ships |
| `state.stale` | `{link}` points at `{stale}`, which is not this copy of LongClaw. Re-linking replaces it. | state | first launch · stale, settings pane | ships |
| `state.occupied` | `{link}` is a file LongClaw did not create, so LongClaw will not replace it. Move or rename it and reopen this pane, or run the line below yourself. | state | settings pane | ships |
| `state.unavailable` | This build has no copy of the command beside it, so there is nothing to install. That is what a `npm run dev` window looks like; an app built from the `.dmg` carries one. | state | settings pane | ships |

#### Refusal, and the way round it

| id | text | kind | where | status |
|---|---|---|---|---|
| `refusal.denied` | LongClaw could not write to {dir}. The line below does the same thing. | refusal | first launch, settings pane | changed |
| `manual.label.refused` | Run this in Terminal instead: | field label | first launch, settings pane | ships |
| `manual.label.offered` | To do it yourself: | field label | settings pane · occupied | ships |
| `manual.copy` | Copy | button | first launch, settings pane | ships |
| `manual.copied` | Command copied | write feedback | toast | ships |

#### Buttons

| id | text | kind | where | status |
|---|---|---|---|---|
| `button.install` | Install | button · primary | first launch, settings pane | ships |
| `button.installing` | Installing… | button · primary, disabled | first launch, settings pane | ships |
| `button.retry` | Try again | button · primary | first launch, settings pane · after a refusal | new |
| `button.relink` | Point it at this app | button · primary | first launch, settings pane · stale | ships |
| `button.skip` | Skip for now | button · ghost | first launch | changed |
| `button.done` | Done | button · primary | first launch · after installing | changed |
| `button.close` | Close | button · ghost | first launch · unavailable | ships |

#### Dismissal

| id | text | kind | where | status |
|---|---|---|---|---|
| `toast.skipped` | Skipped. Settings › Command line has it whenever you want it. | write feedback | dismissed | new |
| `toast.skipped.action` | Open settings | toast action | dismissed | new |
| `toast.installed` | `longclaw` is on your PATH. | write feedback | dismissed · after installing | new |

#### The pane

| id | text | kind | where | status |
|---|---|---|---|---|
| `pane.name` | longclaw | row name | settings pane | new |
| `pane.kind` | command-line interface | row subtitle | settings pane | new |
| `pane.askAgain` | Ask again when I open a project without the command | checkbox label | settings pane | new |
| `pane.askAgain.hint` | — off since you chose Skip for now | checkbox hint | settings pane · after dismissal | new |

#### Copy no screen shows

| id | text | kind | where | status |
|---|---|---|---|---|
| `a11y.dialog.label` | Use LongClaw with Agents | aria-labelledby target | first launch | changed |
| `a11y.live` | (polite live region — announces the state sentence and any refusal) | live region | first launch, settings pane | ships |
| `a11y.preview` | Example of the longclaw command and its output | aria-label | first launch, settings pane | new |
| `a11y.copy` | Copy the install command | aria-label | first launch, settings pane | new |
| `a11y.dot` | (aria-hidden — the state is carried by the sentence, or by the button where there is no sentence) | decorative | settings pane | new |

## Checklist

- [x] The prototype is reviewed and its copy deck settled, and the settled deck is written into this ticket before any of it reaches src/ — the prototype is deleted once the ticket is reviewed, and copy that only ever lived in a deleted file gets re-litigated by whoever ships it <!-- longclaw:item=ck_fe5138d7 -->
- [x] The preview block runs a command that exists — ticket list, which takes no --status and has no --version, so the design's longclaw list --status todo never ships; its output is a deliberate abbreviation and is labelled as illustrative rather than presented as a transcript, because ticket list prints pretty-printed JSON of ~15 fields per ticket and no truthful two-line rendering of it exists <!-- longclaw:item=ck_8241b61f -->
- [x] The command and output the preview shows live as a constant beside COMMAND_NAME rather than as copy in the pane — a demo of the CLI that lives in the frontend goes stale the first time the CLI changes and nothing fails <!-- longclaw:item=ck_4b8a723d -->
- [x] No path anywhere in this feature names Contents/Resources — a Mach-O under Resources is the notarization rejection LC-233 names outright, and the imported design draws it wrong. The what-it-writes box that was going to say so was cut in review, so the surviving carrier is the sudo line, whose source path comes from macos::bundled_beside and is a file inside Contents/MacOS by construction <!-- longclaw:item=ck_d1605f43 -->
- [x] No writability field is added to CommandLineStatus: review cut the preflight line from both surfaces and the preflight was its only reader, and a DTO field nothing renders is a second source of truth about the filesystem with no surface to contradict it. The only Rust change is copy — the three refusal sentences in macos.rs install_into now hand off to the line the app puts underneath them, which is the deck's settled refusal.denied row; each keeps its own first clause, because ADR 0010 keeps a full volume and a refused write apart on purpose <!-- longclaw:item=ck_e390458e -->
- [x] No admin-approval stage is drawn or implied anywhere: the write stays one synchronous symlink, release-audit.mjs:254 still fails the build on Command::new, and Installing… is a frame rather than a step the person is waiting on <!-- longclaw:item=ck_6e45c6f4 -->
- [x] A refused install turns the primary into Try again rather than leaving it reading Install, and the dialog still stays up after a refusal because the refusal is where the line to paste appears <!-- longclaw:item=ck_91a62b85 -->
- [x] commandLinePrompted becomes clearable and the pane carries the Ask again checkbox that clears it — LC-233 wrote it once with no way back, so a person who skipped on first launch could never be asked again on that Mac <!-- longclaw:item=ck_3603f5f2 -->
- [x] Skipping says so, in a toast carrying the way back, worded per-Mac rather than per-project because the preference is a device preference and the link is a fact about the Mac <!-- longclaw:item=ck_a275eaa2 -->
- [x] Every state says its sentence where the sentence is news and nowhere else — absent never does, because the dot and the Install button already say it; stale says it on both surfaces and still reads as wrong rather than done. The pane stays in project settings, and no Remove link, --version badge, Reveal in Finder or status-bar chip is added. The closing note that said the pane is not project data was cut in review and is recorded as an open question rather than put back unasked <!-- longclaw:item=ck_74a4c5f4 -->
- [x] npm run verify passes and a11y:audit Part A passes with both runs quoted — this touches a modal and moves a control's tab position <!-- longclaw:item=ck_2455d240 -->
## Activity

<!-- longclaw:event
id: evt_db4c5701
kind: create
occurred_at: 2026-09-11T06:33:38.630Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_a04b77d7
kind: update
occurred_at: 2026-09-11T06:43:07.409Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: description
  - field: checklist.ck_fe5138d7.added
    to: The prototype is reviewed and its copy deck settled, and the settled deck is written into this ticket before any of it reaches src/ — the prototype is deleted once the ticket is reviewed, and copy that only ever lived in a deleted file gets re-litigated by whoever ships it
  - field: checklist.ck_8241b61f.added
    to: "The preview block demonstrates a command that exists and output the CLI really prints: ticket list prints JSON, takes no --status flag, and there is no --version at all — the design's longclaw list --status todo is fiction, and a trust-building block demoing a command that does not exist inverts the first time somebody runs it"
  - field: checklist.ck_4b8a723d.added
    to: The command and output the preview shows live as a constant beside COMMAND_NAME rather than as copy in the pane — a demo of the CLI that lives in the frontend goes stale the first time the CLI changes and nothing fails
  - field: checklist.ck_d1605f43.added
    to: The what-it-writes box names Contents/MacOS/longclaw and never Contents/Resources — a Mach-O under Resources is the notarization rejection LC-233 names outright, and the imported design draws it wrong
  - field: checklist.ck_e390458e.added
    to: CommandLineStatus gains one field for whether the link's directory can be written or created, set in platform/macos.rs beside the existing probe, and both surfaces say before the press whether it will need an administrator — no new Tauri command, and release-audit.mjs's pinned permission list is unchanged
  - field: checklist.ck_6e45c6f4.added
    to: "No admin-approval stage is drawn or implied anywhere: the write stays one synchronous symlink, release-audit.mjs:254 still fails the build on Command::new, and Installing… is a frame rather than a step the person is waiting on"
  - field: checklist.ck_91a62b85.added
    to: A refused install turns the primary into Try again rather than leaving it reading Install, and the dialog still stays up after a refusal because the refusal is where the line to paste appears
  - field: checklist.ck_3603f5f2.added
    to: commandLinePrompted becomes clearable and the pane carries the Ask again checkbox that clears it — LC-233 wrote it once with no way back, so a person who skipped on first launch could never be asked again on that Mac
  - field: checklist.ck_a275eaa2.added
    to: Skipping says so, in a toast carrying the way back, worded per-Mac rather than per-project because the preference is a device preference and the link is a fact about the Mac
  - field: checklist.ck_74a4c5f4.added
    to: All five states keep a sentence each and stale still reads as wrong rather than done; the pane stays in project settings with its closing note intact, and no Remove link, --version badge, Reveal in Finder or status-bar chip is added
  - field: checklist.ck_2455d240.added
    to: npm run verify passes and a11y:audit Part A passes with both runs quoted — this touches a modal and moves a control's tab position
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_d9891071
kind: update
occurred_at: 2026-09-11T10:30:22.008Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_8241b61f.text
    from: "The preview block demonstrates a command that exists and output the CLI really prints: ticket list prints JSON, takes no --status flag, and there is no --version at all — the design's longclaw list --status todo is fiction, and a trust-building block demoing a command that does not exist inverts the first time somebody runs it"
    to: The preview block runs a command that exists — ticket list, which takes no --status and has no --version, so the design's longclaw list --status todo never ships; its output is a deliberate abbreviation and is labelled as illustrative rather than presented as a transcript, because ticket list prints pretty-printed JSON of ~15 fields per ticket and no truthful two-line rendering of it exists
-->
### Claude Code updated this ticket

Settled in review: the preview keeps the design's two-line output shape rather than real CLI output, and checklist item 2 is amended to match.

The command half of that item stands unchanged — the block runs `longclaw ticket list`, because a block whose whole job is to be believed cannot open on a line that returns `unknown command`. The design's `longclaw list --status todo` is fiction twice over: the verb does not exist and `ticket list` takes no `--status`.

The output half is what changed, and the honest reason is worth recording. The claim that revision 3's compacted one-line JSON was "what the CLI really prints" was wrong. Running it settles it: `ticket list` emits pretty-printed JSON, 251 objects of about fifteen fields each on this repository. Revision 3's line was already a stylisation presented as a transcript, which is the worse of the two failures — it looked literal and was not.

So the abbreviation is now deliberate and marked. Two honest alternatives were considered and not taken: `longclaw ticket list | jq -r '.[] | "(.key)  (.title)"'` prints exactly these two lines and is fully truthful, but is a noisy thing to put in a first-run modal; and a human-readable list mode on the CLI would make the design's line true outright, which is a feature and its own ticket. Either remains available later without changing the dialog's shape.

Also taken from the design this round: the title verbatim, and the lede with two slips repaired ("ito" to "to", "So" to "so"). The lede now names PATH, which partly answers the open question about the dialog never saying that anything lands anywhere — it still does not say /usr/local/bin or symlink.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_d5c43221
kind: update
occurred_at: 2026-09-11T12:40:02.625Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: in_progress
  - field: description
-->
### Claude Code updated this ticket

The settled copy deck is written into the description, which is checklist item 1: the prototype is a file that gets deleted and this is where the copy survives it. Five open questions are answered there with their reasons; two are recorded as still open and are filed rather than fixed, because both were settled copy in review.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_4c359c71
kind: update
occurred_at: 2026-09-11T12:40:13.195Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_d1605f43.text
    from: The what-it-writes box names Contents/MacOS/longclaw and never Contents/Resources — a Mach-O under Resources is the notarization rejection LC-233 names outright, and the imported design draws it wrong
    to: No path anywhere in this feature names Contents/Resources — a Mach-O under Resources is the notarization rejection LC-233 names outright, and the imported design draws it wrong. The what-it-writes box that was going to say so was cut in review, so the surviving carrier is the sudo line, whose source path comes from macos::bundled_beside and is a file inside Contents/MacOS by construction
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_d9be5fac
kind: update
occurred_at: 2026-09-11T12:40:17.597Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_e390458e.text
    from: CommandLineStatus gains one field for whether the link's directory can be written or created, set in platform/macos.rs beside the existing probe, and both surfaces say before the press whether it will need an administrator — no new Tauri command, and release-audit.mjs's pinned permission list is unchanged
    to: "No writability field is added to CommandLineStatus and no Rust changes at all: review cut the preflight line from both surfaces, and the preflight was its only reader. A DTO field nothing renders is a second source of truth about the filesystem with no surface to contradict it, so this ships as a frontend-only change and all five states keep the Rust answers they already had"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_4e5c6001
kind: update
occurred_at: 2026-09-11T12:40:22.229Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_74a4c5f4.text
    from: All five states keep a sentence each and stale still reads as wrong rather than done; the pane stays in project settings with its closing note intact, and no Remove link, --version badge, Reveal in Finder or status-bar chip is added
    to: Every state says its sentence where the sentence is news and nowhere else — absent never does, because the dot and the Install button already say it; stale says it on both surfaces and still reads as wrong rather than done. The pane stays in project settings, and no Remove link, --version badge, Reveal in Finder or status-bar chip is added. The closing note that said the pane is not project data was cut in review and is recorded as an open question rather than put back unasked
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_d395ab21
kind: update
occurred_at: 2026-09-11T12:41:10.644Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: in_progress
    to: in_review
  - field: checklist.ck_fe5138d7.checked
    from: "false"
    to: "true"
  - field: checklist.ck_8241b61f.checked
    from: "false"
    to: "true"
  - field: checklist.ck_4b8a723d.checked
    from: "false"
    to: "true"
  - field: checklist.ck_d1605f43.checked
    from: "false"
    to: "true"
  - field: checklist.ck_e390458e.checked
    from: "false"
    to: "true"
  - field: checklist.ck_6e45c6f4.checked
    from: "false"
    to: "true"
  - field: checklist.ck_91a62b85.checked
    from: "false"
    to: "true"
  - field: checklist.ck_3603f5f2.checked
    from: "false"
    to: "true"
  - field: checklist.ck_a275eaa2.checked
    from: "false"
    to: "true"
  - field: checklist.ck_74a4c5f4.checked
    from: "false"
    to: "true"
  - field: checklist.ck_2455d240.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Shipped. Frontend-only, as the settled prototype said it would be — `CommandLineStatus` and every Rust path are untouched.

**What landed**

- `commandLineDemo.ts` holds the demo command and its two output lines, and `scripts/cli-demo-guard.mjs` holds that constant to a verb `cli.rs` really dispatches: it parses `USAGE`, checks the name against `COMMAND_NAME`, the verb against the commands usage lists, every flag against the ones that verb is given, and that the string is spelled once. Its `--self-test` feeds it the design's own `longclue list --status todo` and fails if any check survives. It runs in `npm run check`.
- `CommandLineInstall.tsx` rewritten: the preview block above everything, the lede from the design, `saysStatus` deciding per surface which sentences are news, the button moved out of the body onto the pane's header row and into the dialog's footer, `Try again` after a refusal, and the `Ask again` checkbox.
- `ConfirmDialog` takes `title: ReactNode`, `className`, `confirmDisabled`, and `cancelLabel: null`. Two focus rules came with the last two: a disabled button is not a tab stop in the hold-focus ring, and a confirm that disables itself under the pointer is given focus back when it returns — the browser blurs it on `disabled`, which drops focus to the body, outside the modal.
- `rememberCommandLinePrompted(false)` clears the preference by deleting the key rather than writing `false`; `adopt` reads only `true`, so an explicit `false` would be a second spelling of one state.
- `Toast` gained a generic `action`, and `ToastStack` is now mounted on the welcome shell — the offer's toast is the one thing that happens on that screen, and a stack that is not mounted is a toast nobody sees. The `Open settings` action is attached only where there is a project to open a panel in.

**Two tokens, and why they were the fix**

The preview is a terminal, so it sits on `--lc-tile`, which is near-black in *both* appearances. Nothing in the scale was the ink for it: `--lc-inverse-ink` is the inverse of the *current* appearance, so it goes dark exactly where the tile stays dark — the defect found in prototype review, in the token rather than in the rule. `tile-contrast-guard.mjs` will not accept a local custom property either, and it is right not to. So `tile-ink` and `tile-ink-2` are added to `design-tokens.json` and proved in `a11y-check.mjs`: 190 contrast pairs, all pass. The tile's own role text already said "anything painted on it must name a light ink"; there just was not one to name.

**The third open question, answered in the stylesheet**

`.cli-state.ok` moved from the agent accent to the human one. LC-233's comment argued green as "a machine is involved and it is working" — true of what the command does, and the wrong subject: the sentence reports that somebody pressed a button. The check on the answered title and the pane's `linked` dot are the human accent, and one installed state cannot be two colours on two surfaces.

**Runs**

- `npm run verify` — green. `cli-demo-guard: 4 claims clean`; `tile-contrast-guard`, `token-guard`, `color-guard`, `citation-guard` (502 citations), `release-audit` (117 files) all clean; 1393 frontend tests and 21 Rust tests pass; `test:watcher` 2 passed.
- `npm run a11y:audit` — Part A passes: A1 keyboard-only core ticket lifecycle; A2 focus order and focus return; A3 visible focus survives panels, overlays and scroll containers; A4 reduced motion preserves state changes; A5 200% zoom does not overlap or hide primary controls.
- `npm run matrix` — 8 axes × 12 states clean, with the eight pre-existing disabled-button exemptions and no new ones.

**Three checklist items were amended rather than ticked as written**, because review cut what they described: the `what it writes` box (item 4), the writability field on `CommandLineStatus` (item 5), and "all five states keep a sentence each … with its closing note intact" (item 10). Each now records what actually ships and why the earlier wording stopped being true.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_ea7a5780
kind: update
occurred_at: 2026-09-11T12:51:02.742Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_e390458e.text
    from: "No writability field is added to CommandLineStatus and no Rust changes at all: review cut the preflight line from both surfaces, and the preflight was its only reader. A DTO field nothing renders is a second source of truth about the filesystem with no surface to contradict it, so this ships as a frontend-only change and all five states keep the Rust answers they already had"
    to: "No writability field is added to CommandLineStatus: review cut the preflight line from both surfaces and the preflight was its only reader, and a DTO field nothing renders is a second source of truth about the filesystem with no surface to contradict it. The only Rust change is copy — the three refusal sentences in macos.rs install_into now hand off to the line the app puts underneath them, which is the deck's settled refusal.denied row; each keeps its own first clause, because ADR 0010 keeps a full volume and a refused write apart on purpose"
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_6250dfcf
kind: comment
occurred_at: 2026-09-11T12:51:33.585Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Code review found three things, all fixed. Two were mine to own.

**1. The deck's `refusal.denied` row was never shipped (spec review).** The row is marked `changed` — "LongClaw could not write to {dir}. The line below does the same thing." — but the sentence a person actually sees comes from `AppError` in `macos.rs`, and I had not touched it, so the app still said LC-233's "LongClaw is not allowed to write to /usr/local/bin. Run the install from Terminal instead." The deck is what ships, per checklist item 1, so the deck wins: `install_into`'s refused write now carries the settled sentence.

Its two siblings took the same hand-off rather than being left behind — the missing-directory refusal and the failed-replace refusal both ended on "Run the install from Terminal instead", and three refusals in one feature speaking in two voices is the drift this file's own header warns about. Each keeps its distinguishing first clause, because ADR 0010 keeps the kinds apart deliberately: "creating it needs an administrator" is information that "could not write" does not carry.

This is also why **checklist item 5 has been corrected a second time**. My earlier amendment said "no Rust changes at all", which overstated the review's decision: review cut the *writability field*, and I turned that into a claim about the whole language. The item now says what is true — no DTO field, one copy change.

**2. `CONTRIBUTING.md` lists the guards `check` runs, and I added one without updating it (standards review, hard violation).** §Quality gates step 2 enumerates them by name. It now names the CLI demo guard, and says that it and `ticket-key-guard.mjs` are the two that read outside the shipping tree — that one into `.longclaw/tickets/`, this one into `cli.rs`.

**3. A fourth ad hoc cascade over the five states (standards review, judgement call).** `CommandLineSection` computed the dot with `state === "linked" ? " ok" : state === "occupied" ? " warn" : ""`, which is precisely the shape `STATES`' own doc comment argues against — "the shape where a sixth state gets added to two of them, and the one it misses is the one that silently offers a button that can only fail". The dot is a fourth column on `STATES` now, so a sixth state cannot be added without answering for it.

**One more defect, found re-reading my own diff rather than by either review:** `Esc` and a scrim click both route through `onCancel`, including *after* the install has landed — the cancel button is gone by then, those two gestures are not. Both reported `skipped`, so the skipped toast would have been raised over a command that was already on `PATH`. Fixed, with a regression test.

**Re-run after all four:** `npm run verify` green — `cli-demo-guard: 4 claims clean`, `tile-contrast-guard: 2 tile surfaces clean`, `citation-guard: 502 citations clean`, `release-audit: 117 files clean`, 1394 frontend tests, 223 + 21 Rust tests, `test:watcher` 2 passed. `a11y:audit` Part A passes, all five rows.

**Not verified, and worth saying plainly: none of this has been looked at.** The prototype was never opened in a browser during its four review rounds — the Chrome tooling in that session timed out repeatedly — and the app has not been run. Everything above is guards, tests and headless probes. The first person to open the pane should look at the preview block in both appearances, which is the part with no rendered check behind it.
<!-- /longclaw:event -->
