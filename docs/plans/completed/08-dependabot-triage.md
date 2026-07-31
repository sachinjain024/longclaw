---
title: "Triage the dependabot advisories"
product: LongClaw
status: ready
backlog_id: "— (may produce one)"
order: 8
owner_area: Platform
release_blocking: false
depends_on: none
---

# Triage the dependabot advisories

GitHub reports 1 high and 2 moderate vulnerabilities on the default branch. Nobody has
looked at what they are.

## Why this exists

They surfaced in a push output and were noted, not investigated, so they are in neither
[the backlog](../../backlog/v0-backlog.md) nor
[the release risks](../../release-risks.md). An advisory that nobody has read is not a
risk assessment — it is a notification.

The outcome may well be "none of these are reachable from a local-first desktop app
with no network calls". That is a fine answer, but it has to be established rather than
assumed, and written down so the next person does not re-triage from scratch.

This item is independent of everything else and small.

## Working rules

- Mostly read-only. If a fix is warranted, topic branch off updated `main`; never commit
  to `main`, never merge without being asked. (`AGENTS.md`)
- `export PATH="/opt/homebrew/opt/rustup/bin:$PATH"`. `npm --prefix apps/desktop ci` if
  `node_modules` is missing.
- **Lockfiles are committed on purpose.** `apps/desktop/package-lock.json`,
  `apps/desktop/src-tauri/Cargo.lock`, and the root `package-lock.json` are all
  tracked, and the register's mitigation for dependency drift depends on that. A bump is
  a lockfile change plus a passing gate, not a floating range.
- `npm run verify` must pass after any bump — and CI additionally runs
  `npm run build:app`, which is where a native-dependency break would show up.

## Do this

1. **Read them.**
   ```sh
   gh auth login   # if needed; the machine that pushed was unauthenticated
   gh api /repos/sachinjain024/longclaw/dependabot/alerts --paginate \
     --jq '.[] | {severity: .security_advisory.severity, pkg: .dependency.package.name, manifest: .dependency.manifest_path, summary: .security_advisory.summary}'
   ```
   Or the UI: `https://github.com/sachinjain024/longclaw/security/dependabot`.
2. **Establish reachability for each.** The questions that decide severity _for this
   product_:
   - Is it a `dependencies` or a `devDependencies` package? A build-time-only advisory
     does not ship in the binary.
   - Does the vulnerable code path exist in a local-first desktop app? This app makes no
     network calls and requires no account — many web-oriented advisories are simply
     not reachable.
   - Does it affect the Tauri capability surface
     (`src-tauri/capabilities/main.json`) or the filesystem scope? Those are the two
     places a dependency could widen the app's real privileges.
3. **Check whether a bump is available and safe.**
   ```sh
   npm --prefix apps/desktop audit
   npm --prefix apps/desktop outdated
   ```
   For Rust, compare against `Cargo.lock`; the pinned versions the spike compiled with
   are recorded in the register (Tauri 2.11.5, plugin-dialog 2.7.2, notify 8.2.0).
4. **Decide, per advisory, and record it.** Exactly one of:
   - **Fix now** — bump, run the full gate, and confirm CI's `build:app` too.
   - **Backlog it** — add a ranked row to [the backlog](../../backlog/v0-backlog.md)
     with a reason to exist and a must-pass check, like every other row.
   - **Step 16** — it belongs in the release-hardening audit, which already includes
     auditing the binary and runtime for accidental telemetry, unnecessary network
     calls, and overbroad filesystem permissions.
   - **Not applicable** — with the reachability argument written out. This is a real
     answer, but only with the argument attached.

## Done when

- All three advisories have a recorded decision with a reason, in the `## Outcome`
  section of this file.
- Anything that became work exists as a backlog row or a plan, not as a note here.
- Anything dismissed says _why_ it is not reachable, specifically enough that the next
  advisory in the same package can be judged quickly.
- If a bump landed: `npm run verify` passes, the lockfile change is committed with it,
  and CI is green on the result.
- [The release risks](../../release-risks.md) gains a row if any advisory turned out to
  be release-relevant.

## Watch out for

- **Do not bump Tauri or `notify` casually.** The register's mitigation for that risk is
  explicit: review dependency updates, run capability-schema generation in CI, and
  **repeat the macOS acceptance tests on Tauri upgrades**. A Tauri bump means re-running
  [the round-trip scenario](../../acceptance/agent-round-trip.md) by hand, not just the
  suite.
- **`npm audit` overstates severity for a desktop app.** Its model assumes a server or a
  browser page. Judge reachability yourself.
- **Do not introduce a network call while fixing a network-related advisory.** Local use
  requires no account and no network, and that is release-blocking under the plan's
  quality strategy.
- **Node version gap.** CI pins Node 22; this machine runs Node 26. A bump that resolves
  differently across the two is a CI failure waiting to happen — check the lockfile
  diff, not just the local result.

## Outcome

Triaged 2026-07-31 against `main` at `106a46e`, which includes the completed
[watcher recovery](05-watcher-recovery.md) work. Three open alerts, two
distinct advisories. **No bump landed, and none is warranted.** Nothing here is
release-relevant, so [the release risks](../../release-risks.md) gains no row.

Re-checked after that work landed, because it added four crates that *are* compiled on
macOS — `objc2` 0.6.4, `objc2-app-kit` 0.3.2, `objc2-foundation` 0.3.2, `block2` 0.6.2.
None carries an advisory, and the alert set is unchanged.

The headline number is misleading in both directions: the "1 high" is a
devDependency, and the "2 moderate" are two manifests reporting the *same* Rust
advisory, in code that is never compiled for the only platform this app targets.

| Advisory | Package | Manifest | Decision |
|---|---|---|---|
| [GHSA-mh99-v99m-4gvg](https://github.com/advisories/GHSA-mh99-v99m-4gvg) — high | `brace-expansion` 1.1.16 | `apps/desktop/package-lock.json` | **Not applicable**, plus V0-40 for the noise |
| [GHSA-wrw7-89jp-8q8g](https://github.com/advisories/GHSA-wrw7-89jp-8q8g) — moderate | `glib` 0.18.5 | `apps/desktop/src-tauri/Cargo.lock` | **Not applicable** |
| [GHSA-wrw7-89jp-8q8g](https://github.com/advisories/GHSA-wrw7-89jp-8q8g) — moderate | `glib` 0.18.5 | `spikes/tauri-v2-architecture/src-tauri/Cargo.lock` | **Not applicable** |

### `glib` — unsoundness in `VariantStrIter` (both moderates)

**Not reachable: this crate is not compiled on macOS.** `glib` enters only through
Tauri's *Linux* backend — the GTK stack. The reverse-dependency tree is
`glib ← atk/cairo-rs/gdk ← gtk/webkit2gtk/gdkx11 ← tao/wry/muda ← tauri 2.11.5`.
On macOS, Tauri renders through WKWebView via Cocoa and none of it is built:

```sh
cargo tree -i glib --target aarch64-apple-darwin   # "nothing to print."
```

The same holds for every crate in that stack — `gtk`, `webkit2gtk`, `gdk`, `atk`,
`cairo-rs` are all absent from the macOS graph. LongClaw ships macOS only:
`tauri.conf.json` bundles `["app", "dmg"]` and CI runs `macos-latest` alone. The
vulnerable code is not in the binary because it is not in the build.

Two independent reasons make it moot even if that changed. The advisory is an
unsoundness in `Iterator`/`DoubleEndedIterator` for `VariantStrIter` — reaching it
means iterating GVariant string arrays, which this app never does; it has no GVariant
surface at all. And its CVSS is 0.0: it is a correctness-of-`unsafe` finding, not a
remotely triggerable one.

**Judging the next `glib` advisory quickly:** the target-gating argument above is the
durable one and it holds for *any* advisory in the GTK stack, regardless of severity.
Re-check it only if `tauri.conf.json` gains a Linux bundle target or CI gains a Linux
runner. Until then, a GTK-stack advisory is not applicable by construction.

**Why not just bump.** The patched `glib` is 0.20.0; `tauri 2.11.5` pins the 0.18
line transitively, so clearing it means moving Tauri. The register's mitigation makes
a Tauri bump expensive — it requires re-running
[the round-trip scenario](../../acceptance/agent-round-trip.md) by hand. Paying that
for code that does not compile is a bad trade.

### `brace-expansion` — DoS via unbounded expansion (the high)

**Not reachable: `devDependencies` only, so it does not ship in the binary.** The
alert's own `scope` field says `development`. One vulnerable path exists:

```
eslint@9.39.5 → minimatch@3.1.5 → brace-expansion@1.1.16   ← vulnerable
typescript-eslint@8.65.0 → … → minimatch@10.2.6 → brace-expansion@5.0.8   ← already patched
```

Triggering it means feeding a maliciously crafted brace pattern to ESLint's glob
matcher — that is, attacking your own lint config on your own machine. There is no
path from a LongClaw *user* to this code: it runs at lint time, never at runtime, and
never leaves the repo. Note the 7.5 CVSS assumes a service parsing untrusted patterns;
this is the overstatement the plan's "watch out" warns about.

**No cheap fix exists.** The advisory range is `<= 5.0.7` across *all* majors, and the
only patched release is 5.0.8. There is no patched 1.x — verified empirically, since
1.1.17 and 1.1.18 exist and might have looked like backports:

```sh
npm i brace-expansion@1.1.18 && npm audit   # still flagged: brace-expansion <=5.0.7
```

So the only route is `brace-expansion@5` → `minimatch@10` → **`eslint@10.8.0`**, a
breaking major, which is what `npm audit fix --force` proposes. Taking a breaking
toolchain major to close an unreachable devDependency DoS is not justified on security
grounds. It should happen when ESLint 10 is adopted deliberately.

### What became work

Nothing here threatens the release, but the *standing* alert list does have a real
cost: three alerts that will never clear on their own train everyone to ignore the
list, so a genuinely reachable advisory arrives somewhere nobody looks. That is
[V0-40](../../backlog/v0-backlog.md#wave-3--recovery-then-theme-completeness).

The archived spike is the clearest instance — `spikes/tauri-v2-architecture/` is
marked "ARCHIVED PROTOTYPE … must not become the production app", is absent from CI,
and ships nothing, yet its lockfile generates alerts indistinguishable from the real
app's. There is no `.github/dependabot.yml`, so this is default scanning over
everything in the tree.
