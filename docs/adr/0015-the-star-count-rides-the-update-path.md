# The star count is a second caller on the update path's road, not a second road

**Status:** accepted on 2026-09-21, amending the allowlist in
[the release audit](../../apps/desktop/scripts/release-audit.mjs) and the host
list in [the runtime network audit](../../apps/desktop/perf/network-audit.mjs),
and adding one host to the two rows of
[the release-candidate checklist](../acceptance/release-candidate.md) that
certify them. Extends [ADR 0014](0014-one-optional-check-for-a-newer-longclaw.md).
Written for [LC-257s](../../.longclaw/tickets/LC-257s/ticket.md).

LongClaw may make one further kind of network request: a `GET` for the public
star count of its own repository, from one named host, carrying nothing that
describes the person, the machine or their projects, at most once a day, which
nothing in the app waits on and whose failure is invisible.

## Why this is an extension rather than a new decision

ADR 0014 moved the boundary from *no connection* to *no information*. That is
the whole of the argument, and it was made for a request that had to happen —
an installed copy that cannot learn a newer one exists is a permanent v0.1.0.
This request does not have to happen. It decorates a button.

So the question this ADR answers is not "may the app open a socket" — 0014
answered that — but **whether a second caller on the same road is a change of
shape or a change of degree**. It is a change of degree, and the test is
mechanical rather than rhetorical: after this decision the shipped binary links
the same frameworks, imports the same socket calls, and compiles the same set of
network-capable crates as before. Nothing new can reach the network. One more
thing calls what already could.

The gates say so rather than this paragraph saying so. See *What pays for it*.

## What the request is, exactly

- **One `GET`**, to `https://api.github.com/repos/sachinjain024/longclaw`, held
  as a constant in `github.rs`. The webview names no URL and has no way to.
- **Two headers.** `Accept: application/vnd.github+json`, and a `User-Agent` of
  `LongClaw/<version>` because GitHub refuses an unauthenticated request without
  one. No identifier, no locale, no machine or install id, no counter. The
  version is already in the update check's own agent string, so this adds
  nothing that was not already leaving.
- **No redirects.** The client is built with `Policy::none()`. A redirect would
  mean the repository moved, and following one silently is how a request ends up
  at a host no allowlist ever saw. (LC-204 makes this concrete: a transfer
  leaves every `github.com/sachinjain024/…` path depending on a redirect GitHub
  owns, and `api.github.com/repos/…` answers a moved repository with a 301.)
- **One field read** out of the answer — `stargazers_count` — and the rest of
  the document discarded. The response is some forty keys about a repository,
  none of which this app has any business holding.
- **At most one request per 24-hour slot**, counted in Rust rather than promised
  by the caller, so two schedulers, a reload and a re-render cost one request
  between them. The slot is consumed *before* the request, so a failure costs a
  slot too — one that left the slot open would let a machine behind a blocking
  proxy be retried by every re-render for as long as the window is up. Be exact
  about what that bounds: the slot is per-process, and the frontend's timestamp
  is written only on success, so a machine that can never reach the host asks
  once per launch, the same as the update check — and, with automatic checks
  off, asks nothing at all.
- **Five-second budget**, shorter than the update check's ten, because nothing
  is waiting on this one.
- **Off the main thread**, so no frame, no keystroke and no ticket write is ever
  behind it.

## What a failure is

Nothing. There is one answer for offline, rate limited, refused by a proxy, a
body that would not parse, a budget that ran out, and a second ask inside the
slot: no number. The control keeps whatever was cached, or draws no number at
all, and raises nothing.

This follows 0014's rule that a failure claims nothing, and it is cheaper here
than it was there: the update pane has to explain itself because a person went
looking for it, and this control was never asked a question.

## The count is not the control

**The bare mark is the control and the number is the enhancement.** That
ordering is the design, not a fallback: the no-count state is what a first paint
looks like, what every offline launch looks like, what a rate-limited hour looks
like, and — because of the floor below — what a young repository looks like. It
had to be designed first and it is what most readers will see.

**There is a floor.** The count is drawn at 50 stars and above and not below
(`STAR_FLOOR`, `github.ts`). The case for paying an amended network contract is
that the number is social proof; under a floor it is the opposite, and a control
that talks a reader out of the thing it asks for is worse than the bare link
this feature rejected. The floor costs nothing, because the no-count state is
required anyway.

This is the one number in the decision that is a judgement rather than a
measurement, and it is the one most worth arguing with.

## What pays for it

Widening a rule is only safe if something narrows beside it. Three controls were
added with this decision, and each is inverted by `--self-test`:

1. **The client's features are frozen.** `reqwest` is now a direct dependency,
   declared `default-features = false` with only what `tauri-plugin-updater`
   already asked for. This is not tidiness. reqwest's defaults are `default-tls`,
   `charset`, `http2` and `system-proxy`; the updater turns none of them on, so
   an ordinary `reqwest = "0.13"` would pull `h2` and `encoding_rs` into a binary
   that has never had them — and `h2` is on the audit's own list of crates that
   must not arrive. `release-audit.mjs` reads the declaration and fails on
   defaults or on a feature beyond the frozen pair.

2. **The set of network-capable crates is frozen.** The old rule asked "did this
   arrive somewhere sanctioned". That question has now been widened by one crate
   at one place, so a second question stands beside it: "is this here at all".
   The graph must hold exactly the network-capable crates it held before — a new
   arrival is a finding even when its ancestry passes, and a *departure* is a
   finding too, because a frozen set that has quietly shrunk is a control
   asserting more than the build contains.

3. **The app root admits a direct dependency only.** `longclaw-desktop` is the
   root of every ancestry, so permitting it the way `tauri-plugin-updater` is
   permitted would have allowed the client at any depth under the app — which is
   no rule at all. Permitted *there* means declared there: depth one, nothing
   deeper. The stack under the client is permitted under the client, so `rustls`
   loose under the app is still a finding.

And two that already existed now cover one more thing:

- **`release-audit.mjs` reads `github.rs`'s constants** the way it reads the
  updater's configured endpoints — both must be `https`, and `API_HOST` must be
  a sanctioned host and must be the host `API_URL` actually names. A constant
  quietly repointed is what this catches. It also reads `github.ts`'s
  `GITHUB_REPO`, the second spelling of the repository, and fails when it is not
  the path both Rust URLs name: the tooltip is the one place the address is
  shown to a person, and a rename is exactly when nobody thinks to grep the
  frontend.
- **The "no Rust HTTP client" source rule became narrower, not wider.** It used
  to say *no file*; it now names the one file that may, and everything that is a
  *decision* about the request lives in a different file that may not.

## What stays forbidden

Everything 0014 forbids, unchanged: no identifier of any kind, no second request
nobody asked for, no request before the preference that governs it is read. And
two more that belong to this feature:

- **No account, and no starring from inside the app.** The control opens the
  repository; the star is pressed on GitHub. Starring needs an authenticated
  user, which is a different shape of request and a different promise.
- **No other GitHub data.** Not issues, not releases, not contributors. One
  field of one document.

## What was considered and rejected

- **A bare link, no count.** Cheapest and it was the ticket's own starting
  position. Rejected because the count is the whole reason the control is worth
  chrome; and the floor means the app ships the bare link *anyway* until the
  repository clears 50, so nothing is lost by building the enhancement now.
- **Baking the count into the update manifest.** It would have added no caller
  and no host. Rejected because the manifest is written at release time, so the
  number would be as old as the release — a count that is wrong by months is
  worse than no count.
- **A second HTTP client, or `tauri-plugin-http`.** Rejected: it would have made
  this a second road, which is the thing the allowlist exists to prevent, and
  every control above would have had to be weakened rather than added to.

## Consequences

- The status bar is a new region of the shell, and the version and update news
  moved into it out of the side panel's footer (LC-257s). `screen-specs.md` and
  `keyboard-focus-map.md` were amended with it.
- `api.github.com` joins the runtime audit's host list. A release run online must
  now expect it, and `audit:network`'s `automatic-off` phase still expects
  silence: the preference is read before the request here too.
- The frozen crate set has to be re-measured, deliberately, whenever the updater
  plugin changes its own dependencies. A red run there is a decision to make,
  never a list to paste into.
