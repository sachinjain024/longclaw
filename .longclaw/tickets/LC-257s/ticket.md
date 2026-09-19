---
format: longclaw.ticket/v1
id: 566fa940-7de2-453c-8afe-85ec5b5543b8
key: LC-257s
title: Show a GitHub star control, with star count, in the app chrome
status: todo
priority: none
labels:
  - frontend
  - product
  - design
type: feature
created_at: 2026-09-16T07:40:54.137Z
updated_at: 2026-09-19T13:29:01.450Z
---

A persistent star control in the app chrome, showing the repository's live star
count and opening the repository on GitHub when pressed.

## Decided

Two questions were put to the user when this was filed, and both were answered:

- **Placement: the app chrome**, not a settings pane and not a gear-menu row. It
  is always visible, so it is always a call to action.
- **The count is in scope.** A live number, not a bare link.

The second answer is the expensive one and it was made knowingly. What follows
is what it costs, recorded so that whoever picks this up does not re-litigate it.

## The app has no network capability, and three gates say so

This is the whole of the work. LongClaw is offline by construction, and that is
not an emergent property — it is asserted in three places that will each go red:

- `apps/desktop/src-tauri/capabilities/main.json` states the webview "has no
  frontend filesystem, shell, network, or process capability". A fetch from the
  frontend is out; the count has to be reached the same way everything else
  reaches the OS — the webview names an intent, Rust decides the URL.
- `scripts/binary-audit.mjs` **fails the build** when `CFNetwork` or
  `Network.framework` is linked into either shipped binary, and fails again on
  network or telemetry symbols. Linking an HTTP client trips it.
- `npm run audit:network` is the release gate's process-monitor pass, and its
  premise is that a running LongClaw makes no non-IPC connection at all. A
  periodic call to `api.github.com` makes that statement false.

`docs/acceptance/release-candidate.md` carries the same claim to the release
reviewer in two rows ("No non-IPC network connection during launch, project
open, …" and "No analytics, telemetry, updater, crash-reporting, shell, HTTP,
or filesystem plugin is directly configured").

So this ticket is not "add a button". It is a deliberate amendment to the app's
no-network contract, and the amendment has to be written down before the code
is: which host, on whose behalf, how often, what is sent (nothing but the
request), and what the user is told. Do that first.

**This lands much more cheaply if it lands after auto-update.** Auto-update
breaks the same three gates for a reason nobody disputes, and once the app has a
sanctioned, narrow, user-visible network path, a star count is a second caller
on an existing road rather than the thing that builds it.

## The header is guarded as one row

`npm run probe:header` exists because the content header breaking into two rows
is invisible to jsdom — LC-149 was found by a person looking at the app. A new
permanent control makes the header wider at every window width, which is
precisely the input that probe measures.

`a11y:audit`'s A5 row is the other half: a row that will not break is a row that
can push a control off the side of the window. Run both, and quote the runs.

## Offline, failure, and rate limits are the normal case, not the edge

An unauthenticated `api.github.com` caller gets 60 requests per hour per IP, and
a LongClaw user may be on a plane, behind a proxy, or on a corporate network
that blocks it. The control must be legible with no number at all — that is the
state it will be in on first paint, every launch, and forever for some users.
Design the no-count state first and the count as the enhancement.

Cache the last known value in device preferences with its timestamp, check at
most once per launch (and not more than daily), and never block first paint on
it.

## Also

- Opening the URL needs a new Rust command in the shape of `open_ticket_file`:
  the webview names no URL, Rust decides it is this repository.
- The mark is an SVG glyph in the app's own glyph set, under
  `glyph-drift-guard`. Not a raster asset.
- A `<button>` needs an explicit `tabIndex` or `npm run check` fails
  (`scripts/tab-order-guard.mjs`).
- Copy is user-facing and the `aria-label` is copy too. Both belong in the
  prototype's copy deck before they reach `src/`.

## Out of scope

- Signing in to GitHub, or starring from inside the app. The control opens the
  repository; the star is pressed on GitHub.
- Any other GitHub data — issues, releases, contributors.

## Related

- **LC-256a** — auto-update. It amends the same three contracts for a reason
  nobody disputes, and it is urgent. Land this after it and reuse the path.

## Checklist

- [x] Decide and write down the amended network contract (blocked on LC-256a's ADR) <!-- longclaw:item=ck_7ae24e80 -->
- [ ] Rust command to open the repository; the webview names no URL <!-- longclaw:item=ck_27e27fea -->
- [ ] Rust-side star-count fetch, cached in device preferences with its timestamp <!-- longclaw:item=ck_df29f281 -->
- [ ] Design the no-count state first; the count is the enhancement <!-- longclaw:item=ck_48fbeacb -->
- [ ] Star glyph as an SVG in the app's glyph set, under glyph-drift-guard <!-- longclaw:item=ck_ec86bdc3 -->
- [ ] Place it in the app chrome with an explicit tabIndex <!-- longclaw:item=ck_b667f847 -->
- [ ] Copy deck: the label, the count format, and the aria-label <!-- longclaw:item=ck_4788c646 -->
- [ ] Run probe:header at every window width; quote the run <!-- longclaw:item=ck_2fcae634 -->
- [ ] Run a11y:audit, including the A5 row; quote the run <!-- longclaw:item=ck_9890ef90 -->

## Activity

<!-- longclaw:event
id: evt_a488f434
kind: create
occurred_at: 2026-09-16T07:40:54.137Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_0176aa56
kind: update
occurred_at: 2026-09-19T13:29:01.450Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: checklist.ck_7ae24e80.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

The amended contract that blocked the first item is written: [ADR 0014 — one optional check for a newer LongClaw](../../../docs/adr/0014-one-optional-check-for-a-newer-longclaw.md), landed with LC-256a.

What it settles for this ticket:

- **The boundary moved from *no connection* to *no information*.** The promise is no longer that the app never opens a socket; it is that nothing identifying leaves the machine. One identifier-free `GET` for one static manifest is inside the contract. A star *count* is the same shape of request; a star *action* is not, because it needs an account.
- **The road already exists.** D4's host allowlist is the mechanism: `release-audit.mjs` holds a `NETWORK_CAPABLE` map of crate to permitted ancestors, pinned under the one sanctioned root, and the updater's endpoints are checked for host and scheme. A second caller adds hosts to that allowlist rather than inventing a second way out. `api.github.com` is not on it today, so adding it is a deliberate edit with a reviewer, which is the point of the list.
- **Three things ADR 0014 keeps forbidden, which this ticket inherits:** no identifier of any kind in the request, no second request nobody asked for, and the check must be refusable before it is made — the preference is read *before* the request, not after one.
- **The gates already assert it.** `binary-audit.mjs` pins the exact socket symbols and network frameworks each shipped binary may import; `perf/network-audit.mjs` classifies a peer as sanctioned only when it is the app's own process on 443 at a resolved allowlisted address, and its `automatic-off` phase records that a refused check makes no request at all. A star fetch has to be spelled into all three or it fails the release gate — which is the intended cost.

One open decision this ticket still owns, which ADR 0014 does not answer: whether a count that fails to fetch leaves the control with no number or with a stale one. The ADR's own answer for the update check is that a failure claims nothing — worth reading before designing the no-count state (ck_48fbeacb).
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_b2fdf2f1
kind: comment
occurred_at: 2026-09-19T13:29:13.577Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Correction to the line above: ADR 0014 is written and committed on `lc-256a-auto-update-spec`, not yet merged to main. The decision is settled and the file is there to read; the path only resolves once LC-256a lands.
<!-- /longclaw:event -->
