## Agent skills

### Issue tracker

This repository tracks its own work in LongClaw, under `.longclaw/tickets/<KEY>/`.
Every `LC-*` item lives there as a directory, so a ticket named in a prompt is
read straight from disk — `LC-69` is `.longclaw/tickets/LC-69/ticket.md`. Both
backlogs were imported on 2026-08-05 as `LC-1`…`LC-58`; file new work as a ticket
rather than as a Markdown file under `docs/plans/`.

**A key minted from 2026-08-25 carries a trailing letter** — `LC-233` was the
last of the old shape, and the next one looks like `LC-234x`. Keys are allocated from the
directories in one working tree, so two branches off the same `main` both take
max+1 and mint the same key; the letter is drawn at random so they differ anyway
(LC-232, `file_format.md:223`). Both forms are keys and both are taken everywhere
a key is: `LC-69` and `LC-211p` are equally valid arguments to `ticket show`,
`edit` and `--after`. Nothing renumbers `LC-1`…`LC-233` to match. When two
branches collide anyway, `longclaw ticket renumber <KEY> --id <uuid>` re-keys one
side and reports every path that still names the old key — see
`docs/agents/issue-tracker.md`.

File it with the CLI, which is the one surface allowed to allocate a key — never
by writing a ticket directory by hand, and always with `--agent-id`, because an
activity entry without it says a human did the work:

```sh
cargo build --release --manifest-path apps/desktop/src-tauri/Cargo.toml --bin longclaw
apps/desktop/src-tauri/target/release/longclaw ticket create \
  --title "…" --label frontend --agent-id claude-code --agent-name "Claude Code"
```

See `docs/agents/issue-tracker.md` for the rest of the surface and the editing
rules, and [ADR 0011](docs/adr/0011-cli-is-the-creation-surface-agents-use.md)
for why it exists.

### Triage labels

Five canonical triage roles map to LongClaw label slugs. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repository. See `docs/agents/domain.md`.

### The website

`apps/website` is the public site (longclaw.io), a static Astro build deployed
to GitHub Pages. It has **its own `node_modules` and lockfile** — run
`npm --prefix apps/website ci` before touching it, and `npm run site:verify`
before you commit. It is not part of `npm run verify`, which is the app's gate.

Read [`apps/website/README.md`](apps/website/README.md) first. Four rules there
are easy to break by accident:

- **Design tokens are transcribed, not authored.** `src/styles/tokens/` mirrors
  the Claude Design export in `docs/ux/prototypes/website-and-docs/`. Do not
  introduce a raw colour anywhere else.
- **No screenshots and no raster product imagery.** The board, panel, file
  trees, terminal blocks and the owl mark are token-driven HTML, CSS and SVG.
- **The copy may not oversell v0.1.0** — no terminals, sync, teams, accounts,
  Windows, Linux, Intel, custom themes, or hard deletion. See
  `docs/design/website-content-brief.md` §6.
- **`/roadmap` is designed but unpublished.** It is out of both navigations,
  the sitemap and the index. Linking it is a decision, not a fix.

Adding a docs page, a blog post or a release note is one Markdown file plus, for
docs, one line in `DOCS_NAV` (`src/lib/site.ts`).

## Git workflow

Agents must always create a topic branch before making changes.

Before creating the topic branch, agents must:

1. Run `git status --short --branch`.
2. If there are unrelated local changes, preserve them and ask before moving branches if needed.
3. Update local `main` from `origin/main`.
4. Create a new topic branch from the updated `main`.

Agents may commit only on topic branches. Agents must not commit directly to `main`. Agents must not merge into `main` unless the user explicitly asks them to do so.

## Toolchain and the gate

The shims are not all on `PATH`. Export this before any Rust work:

```sh
export PATH="/opt/homebrew/opt/rustup/bin:$PATH"   # rustup is Homebrew's

node -v   # v26.5.0 (Homebrew). An old /usr/local/bin/node v10 is still present.
cargo -V  # 1.97.1; stable is the default toolchain
```

Two traps: Homebrew runs under Rosetta on this Mac, so installs need
`arch -arm64 brew install …`, and `apps/desktop/node_modules` may be missing — run
`npm --prefix apps/desktop ci` first.

```sh
npm run verify                        # the whole gate: tokens, structural guards,
                                      # release audit, format, lint, typecheck,
                                      # tests, vite build, native watcher
npm run dev                           # launch the app

npm run test:rust                     # cargo test alone
npm run test:frontend                 # vitest alone
npm run test:watcher                  # the native watcher round trip alone
npm run citations:check               # the design docs' line citations
npm run citations:update              # re-pin them after editing a doc

npm run perf:rust                     # performance budgets, ignored by default
npm run perf:startup                  # startup budgets, needs a built app
npm run perf:board                    # board interaction budgets in WebKit
npm run perf:list                     # the same, for the list surface
npm run probe:header                  # the content header's geometry, mid-write
npm run probe:drag                    # where a dragged ticket actually lands
npm run probe:checklist               # whether the add-row is still on screen
npm run matrix                        # theme × appearance visual regression
npm run a11y:audit                    # accessibility Part A, keyboard-only, in WebKit
npm run a11y:audit -- --self-test     # the same, expecting every row to go red
npm run audit:network                 # runtime network audit, needs a built app
npm run audit:network -- --self-test  # the same, expecting an injected peer to be caught
```

`audit:network` is the release gate's process-monitor pass. It needs a person to
drive the app — it samples, it does not click — and it needs a **quiet machine**,
because it attributes WebKit helpers by launch window and anything else that
starts a webview during the run lands in its record. Run it on a bundle, offline
and then online, with `--phase` naming which.

**Do not point `lsof` at the app's PID and conclude anything.** On macOS the
webview's traffic belongs to WebKit XPC services that are reparented to launchd,
so the app's own process shows no connections whether or not one was made. That
is the trap the harness exists to avoid, and its controls fail the run rather
than report a silence it cannot back up.

`a11y:audit` is the keyboard contract as a run rather than a memory: it drives the
real `App` over the perf stubs with **no pointer input anywhere in it**, checking
each step against the line of
[`keyboard-focus-map.md`](docs/design/prototype/keyboard-focus-map.md) it
implements. Run it when you touch focus, a key handler, a modal, or a control's
tab position. The `--self-test` inversion breaks the build on purpose and fails if
a row still passes — run that after adding a probe, because two of the first ones
were blind.

`probe:header` is the same idea for a thing no test in `verify` can see: whether
the content header is still **one row** while a write is in flight. jsdom does not
lay out, so a control row that breaks in half and strands a control is green in
`npm test` — LC-149 was found by a person looking at the app. It drives a real
write in WebKit and measures the boxes at every width the window can be, and it
carries the same `--self-test` inversion. Run it when you touch the header, its
controls, or the disk-state indicator; run `a11y:audit` alongside it when a
layout change makes the header wider, because a row that will not break is a row
that can push a control off the side of the window (its A5 row).

`probe:drag` is the same idea for drag-and-drop, and it asks the question the
jsdom drag tests cannot: not whether the page _accepted_ a drop but whether the
ticket **landed where it was let go**. It drives real mouse input in WebKit with
the write commands served and reads the order back, one run per row of LC-174's
checklist, plus the two Priority controls that must be refused. Two defects have
now hidden behind a green `verify` here — LC-60's window flag, where the page
never saw a `dragover` at all, and LC-174's rank allocation, where every event
was correct and the row still did not move. A fifth case asks the same of the
panel's checklist (LC-185), whose order is the order of the lines in the file.
A sixth scrolls the board sideways and drops into the **far-right column**,
which is off the side of a 1440px window at six columns and so is reachable no
other way: aiming at it unscrolled put the mouse-up past the edge of the window,
and LC-190 spent that refusal on the app before finding it was the probe's own
reach. What a probe cannot reach it must not report on — its `visible` now means
inside the scroller _and_ inside the pane that scrolls the group sideways.
A seventh pair drops **with a filter on** and then clears it (LC-187): the
surfaces are handed the rows that matched, so a drop decided over those alone
ranked them above every hidden row that had none, and nothing on screen said so
until the query came off. These two are the only cases here whose answer is not
visible when the gesture ends, which is why they read the column back whole —
and they refuse to report on a column the query did not leave with a hidden row
above the gap, or on one the surface is drawing only a window of.
Run it when you touch a drop handler, `ticketMove.ts`, `ordering.ts`, `rank.ts`
or `checklistOrder.ts`, and quote the run.

`probe:checklist` asks the same of the checklist's add-row: not whether the field
**has** focus after Enter — a jsdom test has asserted that since LC-106 and it
passes — but whether the human can still **see** it. The add-row is the list's
next row, so an appended item lands where the field was standing and the field
moves a row down a pane that does not follow it; from a panel scrolled so the
field is the last thing in it, one Enter puts it under the edge, and LC-193 was
filed as "the next input row isn't focussed". Only the frame after Enter is
wrong — WebKit follows the caret on the next keystroke — which is why it reads as
anything but scrolling. It drives both add-rows, the panel's and create's, at
four window heights, and it **skips a height it cannot drive into that position
rather than passing on it**; a run that skipped every height fails. Run it when
you touch either add-row, `addRow.ts`, or the panel's scroll container, and quote
the run.

**The design docs are cited by line number, and `citation-guard` holds those
lines still.** `screen-specs.md` closes by asking that edits occupy exactly the
lines they replace, because ~400 source comments name lines in it and its three
companions; changes ignored that and shifted everything below them, and 160
citations were pointing at the wrong prose before anyone noticed — a stale line
number reads exactly like a fresh one. The guard pins every cited line of all
six line-cited documents — `screen-specs.md`, `keyboard-focus-map.md`,
`components.md`, `states.md`, `file_format.md` and `data-requirements.md` — to
its text in `scripts/citation-lock.json` and fails when that text moves, naming
the line it moved to, so re-pointing is mechanical. **If you edit one of these,
prefer replacing prose in place over inserting it**; when you do change the
wording, re-point whatever cited it and then `citations:update`. Do not run
`--update` to clear a red run — it records drift as the new truth. Its
`--self-test` shifts each pinned document by a line and fails if the guard stays
green. A seventh document is audited first and pinned second: the lock freezes
whatever it is handed, so pinning an unaudited one holds its mistakes still and
calls them clean.

**A `<button>` or a checkbox needs an explicit `tabIndex`, and `npm run check`
enforces it.** WebKit follows the macOS _Keyboard navigation_ setting, which is
off by default, and with it off Tab skips both entirely — which is why plan 07
gave the board roving focus, why the ticket panel's controls were pointer-only
until Step 17, and why its checklist rows still were until LC-185. Write
`tabIndex={0}`, or `tabIndex={-1}` where a roving group owns the stop;
`scripts/tab-order-guard.mjs` fails on an absent one.

`npm run verify` must pass before you commit. CI additionally runs
`npm run build:app` (the full macOS bundle), which the local gate skips.

The interaction budgets are **enforced locally and nowhere else.** They are not in
`verify` — each trace is minutes of WebKit over 5,000 tickets, the wrong price for
a pre-commit gate — and a CI job that ran them was removed on 2026-08-01, the first
time it ever ran on a runner: a shared macOS runner is roughly 6x slower than a
developer Mac and misses the ≤50ms p95 budget even at the harness's 600-ticket
floor size. Raising the number to fit the runner would have been greening the gate.
So **run `perf:board` and `perf:list` yourself when you touch a lane, a row, a
comparator, or a selector**, and quote the numbers — nothing else will catch it.
V0-42 is the open item for a gate that works on a runner.

**If `verify` goes red on the native watcher, suspect the environment before the
code.** An npm-launched `test:watcher` once timed out while the identical direct
Cargo command passed, and it closed as _not reproducing_ without a fix or an
explanation — read
[plan 10's outcome](docs/plans/completed/10-npm-native-watcher-timeout.md) before
touching the watcher, since two obvious workarounds are already recorded as
failures. The rule that must survive: `test:watcher` stays on the native adapter.
Greening the gate with the polling adapter would leave the production watcher
uncovered.

## Token discipline

- Prefer `rg` and targeted file ranges over broad file dumps.
- Do not inspect generated, cache, build, or dependency directories unless explicitly needed.
- Avoid sub-agents unless the user requests parallel review or the task truly benefits from it.
- Keep command output capped and summarize large results.
- For reviews, inspect the diff first before reading surrounding files.
