---
title: "v0 release risks"
product: LongClaw
status: active
milestone: "M4 — Pilot direction accepted (Step 10)"
sources:
  - architecture-spike-risk-register.md
  - backlog/v0-backlog.md
---

# v0 release risks

The risks that could stop the MVP shipping, or make shipping it a mistake. Each
one names the area accountable for it, the backlog item that retires it, and the
check that has to pass before release.

[The spike risk register](architecture-spike-risk-register.md) is the technical
input to this document and stays as the record of what the Step 4 spike proved.
This file is the release view: it carries those risks forward with an owner and a
verification, and adds the risks that are not about code.

Owners name a work area, following the register's convention. They are not
assignees — ADR 0001 removes assignment from local projects, and this repository
has no team mode.

## Release-blocking

A release candidate with any of these open is not a release candidate. The plan's
own rule: any test that reveals file-integrity failure, silent overwrite, watcher
loop, incorrect actor attribution, or an account/network dependency for local use
is release-blocking.

| Risk | Owner | Retired by | Must pass before release |
|---|---|---|---|
| FSEvents drops history over sleep, wake, overflow, or a removed root, and macOS gives no `Resumed` callback while the window stays focused | Platform | V0-04 | A real sleep/wake soak with the window focused, plus an overflow injection, both reconciling to disk state; an unavailable watcher says so |
| Local use acquires an account, network, or telemetry dependency | Release | Step 16 audit | A binary and runtime audit finds no telemetry, no unnecessary network call, and no overbroad filesystem permission; the app works offline with no account |

## High

Not release-blocking on their own, but each one either degrades the product at
realistic sizes or removes a promise the product makes.

| Risk | Owner | Retired by | Must pass before release |
|---|---|---|---|
| A large board becomes slow enough to feel broken; the spike proved data flow, not 5,000 rendered cards | Frontend | V0-06 | A 5,000-ticket browser trace inside the Step 4 interaction budget |
| A large synchronous rebuild blocks a command, focus recovery, or the future wake callback | Platform | V0-05 | A rebuild on a large project keeps commands responsive and never mutates webview state off the main thread |
| Losing or corrupting the index costs project data, contradicting "the index is disposable" | Index | V0-30 | Deleting or corrupting the index and reopening produces the same visible state; rebuild is idempotent |
| Registry corruption strands every known project path | Persistence | V0-31 | A corrupt registry never auto-resets, and a documented recovery restores known projects without editing app internals |
| A partially written or truncated file reads as corruption and trains users to distrust the app | Storage | V0-27 | Truncated-write fixtures resolve to final content without a permanent degraded row and without rewriting the file |
| A failed project creation leaves residue in the user's own repository | Storage | V0-32 | A creation that fails after the directory exists leaves the folder as it was, or names exactly what it left |
| macOS sandboxed distribution cannot persist folder access by path alone | Release | Step 16 | The distribution channel is decided; if sandboxing is required, security-scoped bookmark create/resolve/stale-refresh is proven as a dedicated adapter |
| An unsigned build's Gatekeeper prompt reads as "this app is unsafe" to a user deciding whether to trust it with their repository | Release | Step 16 | Signing and notarization complete, or the prompt is documented in the release notes with an explicit rationale |

## Process and evidence risks

These are the risks that are not in the code. They are recorded here because they
are the ones most likely to be waved through.

| Risk | Owner | Mitigation | Gate |
|---|---|---|---|
| **The mid-v0 pilot never runs, and the MVP ships on internal preference.** Step 9 requires at least five completed real-repository sessions; none have run. The plan makes this a gate precisely because the alternative is guessing | Product | Run the pilot, or record an explicit founder decision to proceed without it and accept that Waves 1–3 are ordered on dependency rather than observed value | M4. [The backlog](backlog/v0-backlog.md) states which of its claims this weakens, and [the memo](pilot/response-memo.md) states what closing M4 requires |
| Pilot evidence arrives after breadth is already built, so it can only be absorbed as rework | Product | Wave 0 proceeds now; Waves 1–3 wait for evidence or an explicit decision. The waves exist so that a late finding re-ranks rather than rewrites | M4 |
| An external editor or agent uses a write pattern outside the test matrix | Storage | Maintain editor-pattern acceptance fixtures; debounce then stability-check; never rewrite a parse failure; retry on later events | V0-27, V0-33 |
| The deferred register leaks into the MVP one reasonable-sounding request at a time | Product | The scope gate: promotion requires an evidence row, a founder decision, a must-pass verification, and a named acceptance change | Every re-plan |
| LongClaw's own defects are tracked in Markdown files because the repository has no ticket-creation surface, so a finding can be lost in a directory nobody reads | Product | [`docs/plans/`](plans/) is the interim store, with resolved reports kept rather than deleted. The CLI caveat in the backlog records the underlying gap | Post-MVP decision |
| Accessibility and reduced-motion work is postponed to Step 16 and then compressed | Design | Audit keyboard access, focus order, labels, screen-reader semantics, contrast, reduced motion, and zoom in Step 16 against the criteria fixed in Step 1 | M6 |

## Retired

Closed by shipped work, with the test that keeps them closed. They stay listed so
a later change that removes the test is visibly removing a release gate.

| Risk | Owner | Retired by | Test that holds it |
|---|---|---|---|
| A ticket directory carries a prefix that is not this project's key and is indexed as if it were | Format | V0-03, [plan 04](plans/completed/04-project-prefix-validation.md) | `a_ticket_directory_from_another_project_is_shown_and_never_claimed` in `tests/storage_integration.rs`, `renaming_a_ticket_directory_into_another_project_s_key_degrades_and_renaming_back_recovers` in `tests/watcher_integration.rs`, the `invalid-key-foreign-project-prefix` fixture, and four unit tests in `core/storage.rs`. Confirmed to fail with the ownership rule removed |
| A change is attributed to the wrong actor, or an agent is presented as a human | Domain | V0-07, [plan 03](plans/completed/03-attribution-from-new-records.md) | `an_external_write_that_appended_no_record_is_actor_unknown`, `rewritten_history_is_actor_unknown_rather_than_a_guess`, and `a_newly_appended_record_is_credited_to_the_actor_who_wrote_it` in `tests/watcher_integration.rs`, over six unit tests in `core/attribution.rs`. Confirmed to fail against the newest-record rule. The round-trip scenario's § 4 hand walkthrough is still outstanding |
| A dropped project event leaves the UI silently stale while still looking live | Frontend | V0-02, [plan 02](plans/completed/02-event-sequence-gap.md) | `stops applying events when one goes missing, and asks for a snapshot once`, `converges on the state it would have had if nothing was lost`, and four more in `apps/desktop/src/state.test.ts` and `App.test.tsx`. Confirmed to fail against the previous `applyEvent` |
| An external write between expected-hash validation and atomic replacement is silently overwritten, and its watcher notification is consumed by the self-write receipt | Storage | V0-01, [plan 01](plans/completed/01-atomic-replace-race.md) | `an_external_write_inside_the_save_window_is_a_conflict_and_survives_it` and `a_volume_without_an_atomic_swap_refuses_the_write_rather_than_risking_it`, in `apps/desktop/src-tauri/tests/storage_integration.rs`. The interleaving is driven through the `ReplaceSeams::before_swap` seam, so the test cannot pass by scheduling accident; it was confirmed to fail against the previous `fs::rename` path |

## Accepted

Recorded, understood, and deliberately not being fixed for the MVP.

| Risk | Why it is accepted |
|---|---|
| The comprehensive canonical conformance-fixture corpus is deferred to post-MVP product v1 | Focused real-file compatibility tests cover the v0 contract, and parsing stays replaceable behind `ProjectEngine`. Recorded at M1. |
| Exact-hash self-write suppression could expire before a delayed event | The receipt matches path and hash, not time alone. An expired receipt can cause a redundant refresh but cannot hide external data. |
| No attachment UI, no user-defined statuses, no assignees | ADRs 0005, 0002, and 0001. Each ships the on-disk format now so the UI is not a migration later. |
| Native dependency or Tauri capability defaults change under us | Lockfiles are committed, capability-schema generation runs in CI, and macOS acceptance tests are repeated on Tauri upgrades. |
