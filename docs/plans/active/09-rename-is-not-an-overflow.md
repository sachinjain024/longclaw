---
title: "Stop treating a vanished path as a watcher overflow"
product: LongClaw
status: ready
backlog_id: "—"
order: 9
owner_area: Platform
release_blocking: true
depends_on: none
---

# Stop treating a vanished path as a watcher overflow

`collect_event` turns **every** error the watcher reports into
`RebuildReason::Overflow`, including the `NotFound` that a plain directory rename
provokes. The rename tests then see an `indexRebuilt` where they expected the
removal and the arrival, and fail. It took CI red once already.

This is a flaky gate, not a broken build: the run after it was green through
`build:app`. But an intermittently red quality gate is worth roughly nothing,
because the next real failure is indistinguishable from this one.

## Why this exists

Found by [item 00](../completed/00-confirm-ci-on-main.md), which went looking for
the state of CI on `main` and found one failing run among otherwise green ones.

`apps/desktop/src-tauri/src/engine.rs:675-678`:

```rust
let Ok(event) = event else {
    local_diagnostic("watcher overflow or dropped filesystem events; rebuilding index");
    return (false, Some(RebuildReason::Overflow));
};
```

Any `Err` means overflow. That was a fair reading when item 05 wrote it, because
FSEvents mostly errors when it has genuinely dropped history. It is not a fair
reading of the polling adapter.

The tests drive `WatcherAdapter::Polling` with `with_compare_contents(true)`
(`engine.rs:559-573`), which walks the entire ticket tree every 50 ms and reads
each file. A `fs::rename` of a ticket directory lands in the middle of one of
those walks, `walkdir` stats an entry that is no longer there, and notify
8.2.0 turns that into an error event rather than swallowing it
(`notify-8.2.0/src/poll.rs:294-330`). One rebuild later the index is correct — the
product converges — but the event the frontend saw was a full rebuild, not the
pair.

So this is a real defect in the watcher's error handling that currently only
shows up as a test failure. A path that disappeared is not lost history: the
rename that removed it is itself about to arrive as an event. Rebuilding the
whole index for it is both wrong and expensive.

## Evidence

CI run
[30620563822 **attempt 1**](https://github.com/sachinjain024/longclaw/actions/runs/30620563822/attempts/1),
head SHA `35d85df`, conclusion **failure**, step **`Run quality gate`**, exit code 101.

The attempt number matters. That run was retried, and `gh api .../runs/30620563822`
now reports the retry — `success`. Use
`gh api repos/sachinjain024/longclaw/actions/runs/30620563822/attempts/1` to see
the failure, or you will conclude this plan is describing something that never
happened.

```
test renaming_a_ticket_directory_into_another_project_s_key_degrades_and_renaming_back_recovers ... FAILED

thread '...' panicked at tests/watcher_integration.rs:464:22:
unexpected event {"type":"indexRebuilt","data":{"snapshot":{...},"reason":"overflow"}}

test result: FAILED. 17 passed; 1 failed; 1 ignored; 0 measured; 0 filtered out
```

`npm run build:app` never ran in that attempt, because `npm run verify` failed
before it.

Two independent things then showed the tree is fine:

- **The same commit passed on retry.** Attempt 2 of that identical run — same SHA,
  same tree, nothing changed — went green through `Build desktop application`.
- **The next push passed.** [30624782219](https://github.com/sachinjain024/longclaw/actions/runs/30624782219)
  on `b773a7a` was green end to end, and its three commits touch only the frontend
  and docs, so the Rust tree is unchanged from `35d85df`.

One tree, three samples, one of them red. That is a flake, and it is the gate that
is broken rather than the build.

### Reproduction

The failure itself is timing-dependent and did not reproduce on an M-series
machine: the full `watcher_integration` file passed 14/14, including 8 runs under
twelve spinning CPU hogs. The *mechanism* reproduces directly. A throwaway probe —
40 ticket directories, a `PollWatcher` at 50 ms with `compare_contents(true)`, 60
rounds of renaming one directory away and back:

```
PROBE err #13: Error { kind: Io(Custom { kind: NotFound, ...
    /tickets/LC-2: No such file or directory (os error 2) }),
    paths: ["/.../tickets/LC-2"] }
PROBE totals: 349 ok events, 16 error events
```

16 `NotFound` errors in 60 renames, on a fast quiet machine. Every one of those is
an overflow rebuild. CI's `macos-latest` runner is slower and busier, which is why
it loses the race often enough to go red.

Rewrite that probe as `tests/scratch_poll_probe.rs` if you want to watch it happen;
it is not worth keeping in the suite once the fix lands.

## Working rules

- Topic branch off updated `main`. Never commit to `main`; never merge without
  being asked. (`AGENTS.md`)
- `export PATH="$(rustup which cargo | xargs dirname):$PATH"` — `cargo` is not on
  the default non-interactive `PATH` on this machine, only `rustup` is.
- This is not the blocking-workers item. Do not restructure the pool while you are
  in here.

## Do this

Discriminate the error rather than the adapter. In `collect_event`
(`engine.rs:670`), a `notify::ErrorKind::Io` whose `io::ErrorKind` is `NotFound`
should be dropped, not escalated:

- It carries no paths worth folding into the burst — the entry is gone.
- The rename or deletion that removed it produces its own event, which is the one
  that should drive the index.
- Every other error kind keeps today's behaviour and still rebuilds.

Do **not** fix this by making the tests tolerate an `indexRebuilt`. The tests are
asserting the right thing: a rename is two incremental events, not a full rebuild.
Loosening them would hide the same defect on the native adapter, where a
`NotFound` during a scan is equally not a reason to throw the index away.

Three tests go through `next_rename` (`watcher_integration.rs:438`, `:483`,
`:518`) and all three are exposed today. `an_external_deletion_removes_the_row` is
exposed by the same race.

## Done when

- A unit test over `collect_event` proves a `NotFound` IO error yields no rebuild
  reason, and that some other error kind still yields `Overflow`. This is the
  check that actually pins the behaviour; the integration tests are too timing-
  dependent to be the proof.
- `an_overflow_recovery_converges_on_disk_state` still passes — genuine overflow
  recovery must not regress.
- `npm run verify` passes locally.
- CI is green on the merge commit, including `Build desktop application`. Record
  the run id.
- Ten consecutive `cargo test --test watcher_integration` runs on a loaded machine
  are green. That is weak evidence on fast hardware, but a regression here would
  fail it outright.

## Watch out for

- **The bug is in the product, not only the harness.** It is tempting to read
  "polling adapter is test-only" and conclude the fix is test-only. The escalation
  lives in shared code that the native adapter runs too.
- **Do not silence all IO errors.** A `PermissionDenied` or an `Io` error on the
  tickets root is exactly the case overflow recovery exists for.
- **Reproducing takes a slow machine.** Passing locally means very little here.
  Push and read CI, and rerun the job once to see whether it is stable rather than
  merely lucky.
- **`gh` works on this machine.** Item 00 was written believing it did not.
