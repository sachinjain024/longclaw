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
