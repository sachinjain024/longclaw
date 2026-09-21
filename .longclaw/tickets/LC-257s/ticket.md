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

## Attachments

<!-- longclaw:attachment
id: att_5c1f93ab
file: attachments/att_5c1f93ab-status-bar-star.png
name: status-bar-star.png
media_type: image/png
size: 3724
added_at: 2026-09-21T14:11:36Z
added_by:
  type: agent
  id: claude-code
  name: Claude Code
-->
![The status bar, with the version at one end and the star control at the other](./attachments/att_5c1f93ab-status-bar-star.png)
<!-- /longclaw:attachment -->

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

<!-- longclaw:event
id: evt_afc1f77e
kind: comment
occurred_at: 2026-09-21T14:15:04.108Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

**Settled: variant G — the status bar — in the labelled-ghost shape, with the count drawn.** Reviewed from the prototype, `docs/ux/prototypes/LC-257s-GitHub-Star-Badge.html`, which is deleted once this ticket is reviewed. What it settled is written out below so it does not have to be re-litigated by whoever ships it.

![The status bar, with the version at one end and the star control at the other](./attachments/att_5c1f93ab-status-bar-star.png)

## What ships

A new app-wide bar across the foot of the window. `.app-shell` gains a second grid row; the bar is 26px, `grid-column: 1 / -1`, hairline top border, `--lc-bg`. The version and the update news move **out of** the side-panel footer and stand at its left end. The star control takes the far end on `margin-left: auto`.

The control is a borderless ghost: no fill, no border, GitHub's mark then the count, `--lc-ink-2` resting and `--lc-ink` on hover. Measured in WebKit at the grown count: **48 × 18px**, `background: rgba(0,0,0,0)`, `border-width: 0`, `tabIndex={0}`.

In this bar it is the **compact** form, so it carries no visible words at all — `github.star.label` has no room and is not drawn. That puts the entire meaning of the control into `github.star.aria`, and it is the one thing worth checking hardest when the built version is reviewed.

## Why G, and what it costs

- **It does not touch the content header.** That was C's bill. The same shape in the header measures 147px, 155px with its gap, and the filter field pays it: at a 1180px window the field goes 380 → 342px (the row had 117px of slack); at 980px it goes 297 → 142px and pays the whole 155; at 760px it is already on its 120px floor in both. G adds a row rather than widening one, so `probe:header` measures the same header it measures today.
- **It fixes A rather than living with it.** On the version line, with an update waiting, `LongClaw 0.2.0` is the only flexible thing left in 216px and wraps onto two lines, stranding the count beside nothing that says what it counts. The status bar is the window's full width and nothing there competes for an edge.
- **It is visible where the others are not** — including the welcome screen and a project that will not open, which is exactly where a brand-new reader is standing. The content header is absent on both.
- **The cost is that it is the only variant that changes the shell.** 26px comes off the board, the list, the ticket panel and the settings panel, all of which size themselves against the window today. `screen-specs.md:20-30` describes the shell as a side panel and a main region; a status bar amends that, and those lines are pinned by `citation-guard`, so this is a spec edit as well as a code edit. Price it as a chrome change that a star count rides on, not as a place to put a star count.

## The settled deck

| id | kind | where | text | status |
|---|---|---|---|---|
| `github.star.count` | count | the control, after the mark — only once a count has arrived | `{countShort}` | new |
| `github.star.floor` | rule, not a string | decides whether `github.star.count` is drawn at all | Draw the count at 50 stars and above. Below it, the control is the no-count state. | new, **open** |
| `github.star.aria` | aria-label | the control, no count known | Star LongClaw on GitHub. Opens github.com in your browser. | new |
| `github.star.aria.count` | aria-label | the control, count known | Star LongClaw on GitHub, {count} stars. Opens github.com in your browser. | new |
| `github.star.title` | title | hover | github.com/{repo} | new |
| `github.open.failed` | refusal (toast) | when the browser could not be opened | Couldn't open GitHub. | new |
| `github.settings.note` | note | Settings › Updates, under the automatic-check note | The star count is fetched the same way, at most once a day, and sends nothing about you or your projects. | new |
| `updates.footer.version` | note | **the status bar**, left end — it leaves the side-panel footer | LongClaw {version} | moved |
| `updates.footer.update` | link | beside the version, when an update is waiting | Update | moved |
| `updates.footer.update.aria` | aria-label | the Update link | Update to LongClaw {version} | moved |

Four notes the table cannot carry:

- **`github.star.count` is abbreviated, `github.star.aria.count` is not.** Under 1,000 the number is written out (847); at and above it, one decimal and a k (1.3k). The aria-label speaks the full grouped number — `1,284 stars` — because `1.3k` is a thing to read at a glance, not a thing to hear. Nothing announces a count that arrives after first paint: it is not news, and a live region for it would interrupt a reader mid-sentence to say a number went up.
- **`github.star.aria`'s second sentence is doing real work here.** In this placement the visible control is a mark and a number and nothing else, so the aria-label is the only thing that says what the control is *for* — and the only warning that a press leaves the app. A local-first app opening a browser is a surprise worth naming.
- **`github.star.title` and LC-204.** Transferring the repository leaves every `github.com/sachinjain024/…` path depending on a redirect GitHub owns (`apps/website/src/lib/site.ts:27`). A browser follows that; a Rust HTTP client follows it only if it is told to, and `api.github.com/repos/…` answers a moved repository with a 301. Whoever builds the fetch owns that decision.
- **`github.settings.note` sits under `updates.pane.automaticNote` deliberately.** ADR 0014 moved the promise from *no connection* to *no information*; the price of a second caller on that road is that it is stated in the same place as the first. Two sentences about one mechanism, not two mechanisms.

**Rows that do not ship with this choice:** `github.star.label` ("Star on GitHub" — no room in the compact form), `github.star.pill.nocount` ("Star" — the pill shape lost), `github.welcome.label` (the welcome placement was not chosen).

**Not decided here:** `github.palette.label` — "Open LongClaw on GitHub" — the keyboard twin. It costs one palette row and is worth shipping alongside. "Open", not "Star", because the palette already carries `project.menu.star` and the two would sort together under the same three keystrokes.

## Still open: the floor

`github.star.floor` is the one decision on the page that is a judgement rather than a measurement, and this placement sharpens it. The repository's live count today is **1** — the prototype fetches it — and at that number the badge is an argument *against* the control it decorates.

The floor costs nothing to build, because the no-count state is required anyway: offline, a rate limit, and first paint all produce it. What it costs is a promise — until the floor is cleared, the expensive half of this ticket buys nothing a static link would not.

**What the no-count state looks like in this placement, measured:** a **17px** GitHub mark with empty text content. No word beside it, because the compact form has no label and the pill's `github.star.pill.nocount` fallback went with the pill. That is a weaker control than either of the shapes that lost, and it is the shape this control will wear until the repository clears 50. Worth settling the floor with that picture in front of you.

One grammar note that rides on the same decision: `github.star.aria.count` says `{count} stars`. At or above 50 the plural is always right. Remove the floor and that string needs a singular form.

## What this changes in the checklist

- **`ck_b667f847`** (place it in the app chrome) now means building a new shell row, not adding a control to an existing one. It is the larger half of the remaining work.
- **The version and Update move.** `UPDATE_COPY.footer` (`apps/desktop/src/updates.ts:40-44`) keeps its strings unchanged but changes address, and `.side-panel-footer` gets its row back. That is a change to what LC-256a shipped three days ago.
- **`ck_9890ef90`** (a11y:audit) gains a prerequisite: the bar is a new focus stop at the end of the shell, so `keyboard-focus-map.md` needs a line for it before the audit can check it against anything.
- **`ck_2fcae634`** (probe:header at every width) is still worth running, but G is the variant least likely to move it. Record that expectation before running it, so that a red run means something.
- **`ck_ec86bdc3`** is GitHub's mark, not a star glyph. `.star-mark` already draws ★ at 11px `ink-2` on starred project rows in the same window, which is why this control leads with the GitHub mark instead of a second star.

The prototype now opens on this design — scene G, labelled shape — and the live fetch decides whether a number appears, which is the behaviour worth watching.
<!-- /longclaw:event -->
