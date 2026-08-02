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
| Local use acquires an account, network, or telemetry dependency | Release | Step 16 audit | A binary and runtime audit finds no telemetry, no unnecessary network call, and no overbroad filesystem permission; the app works offline with no account |

## High

Not release-blocking on their own, but each one either degrades the product at
realistic sizes or removes a promise the product makes.

| Risk | Owner | Retired by | Must pass before release |
|---|---|---|---|
| ~~A large board becomes slow enough to feel broken; the spike proved data flow, not 5,000 rendered cards~~ **Retired 2026-07-31 (V0-06)** | Frontend | V0-06, [plan 07](plans/completed/07-board-virtualization.md) | Met. `npm run perf:board` traces a 5,000-ticket board in WebKit: 18 ms p95 keyboard navigation, 22 ms p95 scroll, 20 ms p95 external write → paint, against the ≤ 50 ms p95 budget, and indistinguishable from a 600-ticket board. The list surface (V0-14) inherits the same column geometry and is re-traced when it lands |
| ~~A large synchronous rebuild blocks a command, focus recovery, or the future wake callback~~ **Retired 2026-07-31 (V0-05)** | Platform | V0-05, [plan 06](plans/completed/06-blocking-workers.md) | Met. `npm --prefix apps/desktop run perf:rust` keeps a 5,000-ticket rebuild request prompt at `82.72 ms`, with one coalesced completion event and no worker-side webview access; the targeted native watcher round trip passed with `external_visibility_pipeline_ms=184.37` |
| ~~Losing or corrupting the index costs project data, contradicting "the index is disposable"~~ **Retired 2026-08-02 (V0-30)** | Index | V0-30, [plan 38](plans/completed/38-complete-step-14-recovery.md) | Met. The production index is in-memory and disposable; rebuild derives visible state from files and is covered by storage and watcher recovery tests |
| ~~Registry corruption strands every known project path~~ **Retired 2026-08-02 (V0-31)** | Persistence | V0-31, [plan 38](plans/completed/38-complete-step-14-recovery.md) | Met. `RegistryStore` maintains `project-registry.backup.json`, fails closed on invalid registry JSON, and has a restore-from-backup regression test |
| ~~A partially written or truncated file reads as corruption and trains users to distrust the app~~ **Retired 2026-08-02 (V0-27)** | Storage | V0-27, [plan 38](plans/completed/38-complete-step-14-recovery.md) | Met. Watcher integration covers partial writes settling to final content, burst coalescing, and later unreadable-file recovery without rewriting the file |
| ~~A failed project creation leaves residue in the user's own repository~~ **Retired 2026-08-02 (V0-32)** | Storage | V0-32, [plan 38](plans/completed/38-complete-step-14-recovery.md) | Met. Project initialization removes only the `.longclaw` files/directories it claimed when a late initialization write fails, with a unit test injecting that failure |
| macOS sandboxed distribution cannot persist folder access by path alone | Release | Step 16 | The distribution channel is decided; if sandboxing is required, security-scoped bookmark create/resolve/stale-refresh is proven as a dedicated adapter |
| An unsigned build's Gatekeeper prompt reads as "this app is unsafe" to a user deciding whether to trust it with their repository | Release | Step 16 | Signing and notarization complete, or the prompt is documented in the release notes with an explicit rationale |

## Process and evidence risks

These are the risks that are not in the code. They are recorded here because they
are the ones most likely to be waved through.

| Risk | Owner | Mitigation | Gate |
|---|---|---|---|
| **The mid-v0 pilot never runs, and the MVP ships on internal preference.** Step 9 requires at least five completed real-repository sessions; none ran. The plan makes this a gate precisely because the alternative is guessing | Product | **ACCEPTED, not mitigated.** On 2026-07-31 the founder decided to proceed without the pilot sessions ([decision](pilot/response-memo.md#direction-decision-2026-07-31-superseded-the-same-day)). This is the one risk on this page that is being taken rather than managed: the MVP now ships on internal preference by choice. It is not retired, and it stays here through release so that nobody has to rediscover it | ~~M4~~ — closed by decision with half its gate unmet. No later gate catches this; M6 acceptance tests what the team specified, which is the thing in question |
| Pilot evidence arrives after breadth is already built, so it can only be absorbed as rework | Product | ~~Wave 0 proceeds now; Waves 1–3 wait for evidence~~ — **moot as of 2026-07-31.** No evidence is expected, so there is no late finding to absorb and no rework to sequence. The waves survive as a dependency order only. If sessions ever do happen, [the memo](pilot/response-memo.md) keeps the door open and this risk becomes live again, at full cost, because breadth will be built by then | ~~M4~~ — no gate |
| An external editor or agent uses a write pattern outside the test matrix | Storage | Maintain editor-pattern acceptance fixtures; debounce then stability-check; never rewrite a parse failure; retry on later events | V0-27, V0-33 |
| The deferred register leaks into the MVP one reasonable-sounding request at a time | Product | The scope gate: promotion requires an evidence row, a founder decision, a must-pass verification, and a named acceptance change | Every re-plan |
| LongClaw's own defects are tracked in Markdown files because the repository has no ticket-creation surface, so a finding can be lost in a directory nobody reads | Product | [`docs/plans/`](plans/) is the interim store, with resolved reports kept rather than deleted. The CLI caveat in the backlog records the underlying gap | Post-MVP decision |
| Accessibility and reduced-motion work is postponed to Step 16 and then compressed | Design | Audit keyboard access, focus order, labels, screen-reader semantics, contrast, reduced motion, and zoom in Step 16 against the criteria fixed in Step 1 | M6 |

## Retired

Closed by shipped work, with the test that keeps them closed. They stay listed so
a later change that removes the test is visibly removing a release gate.

| Risk | Owner | Retired by | Test that holds it |
|---|---|---|---|
| FSEvents drops history over sleep, wake, overflow, or a removed root, and macOS gives no `Resumed` callback while the window stays focused | Platform | V0-04, [plan 05](plans/completed/05-watcher-recovery.md) | `an_overflow_recovery_converges_on_disk_state`, `a_removed_root_can_be_restored_and_reconciled`, `recovery_triggers_close_together_emit_one_rebuild`, and `coalescing_does_not_mask_a_root_that_vanished` in `tests/watcher_integration.rs`; `npm run test:watcher`; and a 2026-07-31 focused-window sleep/wake soak on macOS 26.5.2 |
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
