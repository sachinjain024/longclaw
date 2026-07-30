---
title: "Bug: project creation suggests a key it then refuses"
product: LongClaw
status: open
severity: "Onboarding blocker — fix before Step 9 pilot sessions"
triage: ready-for-agent
reported: 2026-07-30
reported_by: sachin.j@browserstack.com
affects: "main @ 7c1037d; introduced in 57b291e (Step 7)"
---

# Bug: project creation suggests a key it then refuses

Creating a project whose name begins with a digit fails with an error the user
cannot act on, after the folder picker has already been answered, leaving a
partial `.longclaw/` directory in the chosen folder.

This is a prepared ticket body. Per
[the issue-tracker rules](../../agents/issue-tracker.md), an agent must not mint
a ticket key or create `.longclaw/tickets/<KEY>/` directly, and this repository
has no `.longclaw/` store yet. Move this content into a LongClaw ticket with the
`ready-for-agent` label once a creation surface exists, and delete this file.

## Symptom

Reported from a real session on 2026-07-30. In the sidebar create form:

| Field | Value entered |
| --- | --- |
| Name | `30 July 4PM` |
| Key | `3J4` (never typed — the form filled it in) |
| Theme | Slate |

Pressing **Choose folder** and selecting a folder produced a red banner:

```text
Internal   key is the immutable prefix of every ticket key, so it must be
           uppercase letters and digits starting with a letter; found "3J4"
```

The user did not type `3J4`. The Name field generated it.

## Reproduction

1. Launch the app (`npm run dev`, or `npm run dev:fixture` with a project open —
   both create forms are affected).
2. Open the create-project form.
3. Type `30 July 4PM` into **Name**. Observe **Key** auto-fill to `3J4`.
4. Press **Choose folder** and select any empty folder.
5. The banner above appears. No project is created.
6. Inspect the selected folder: it now contains an empty `.longclaw/tickets/`
   and no `longclaw.yaml`.

Any name whose first word starts with a digit reproduces it — a date, a year, an
ordinal. Reported name `3j4` reproduces it too, deriving the key `3`.

## Root cause

Three defects. One root cause, two that turn it into a dead end.

### 1. The derivation can produce an invalid key

`defaultProjectKey` (`apps/desktop/src/App.tsx:38-48`) takes the first character
of each word. That character may be a digit. The backend requires the first
character to be an uppercase **letter** (`is_project_key`,
`apps/desktop/src-tauri/src/core/project.rs:232-238`), so the frontend suggests
keys the backend rejects:

| Name | Derived key | Backend verdict |
| --- | --- | --- |
| `30 July 4PM` | `3J4` | rejected |
| `3j4` | `3` | rejected |
| `2026 roadmap` | `2R` | rejected |
| `3rd party audit` | `3PA` | rejected |
| `My Project` | `MP` | accepted |
| `longclaw` | `L` | accepted |
| `日本語プロジェクト` | `LC` | accepted (all characters stripped, fallback used) |

Both create forms overwrite **Key** with the derivation on every **Name**
keystroke — sidebar form at `apps/desktop/src/App.tsx:399-402`, Welcome form at
`apps/desktop/src/App.tsx:480-483`. A key the user typed by hand is therefore
silently discarded the moment they touch the name again. Clearing the Key field
also falls back to the same derivation at `apps/desktop/src/App.tsx:287`.

### 2. Nothing validates before the folder picker

The Key input only uppercases (`apps/desktop/src/App.tsx:409-411`). There is no
inline error, no statement of the rule, and no disabled submit. The rule is
enforced only in Rust, after
`chooseAndCreateProject` (`apps/desktop/src/api.ts:34-49`) has already opened the
native picker and invoked `create_project`. The user answers a folder dialog
before learning the form was invalid.

### 3. The failure is misclassified and leaves residue on disk

In `initialize_project` (`apps/desktop/src-tauri/src/core/storage.rs:667-698`):

- line 684 — `fs::create_dir_all` creates `.longclaw/tickets/`;
- line 693 — `ProjectDocument::parse` validates the key, i.e. **after** the
  directory exists;
- line 694 — the diagnostic is mapped to `ErrorCode::Internal` with
  `recoverable: false`;
- line 695 — `atomic_write` of `longclaw.yaml` never runs.

Verified with a temporary probe test against `initialize_project` (written, run,
and reverted — see [Evidence](#evidence)):

```text
code=Internal  recoverable=false
tickets_dir_exists=true  project_file_exists=false
left_on_disk=<root>/.longclaw
left_on_disk=<root>/.longclaw/tickets
```

Retrying works, because the already-a-project guard at
`apps/desktop/src-tauri/src/core/storage.rs:675` tests for `longclaw.yaml`, which
was never written. But the stray `.longclaw/tickets/` stays in the user's
repository, and nothing tells them it is there.

The classification contradicts
[ADR 0010](../../adr/0010-errors-cross-ipc-as-a-closed-tagged-shape.md): invalid
project metadata is a project-level failure, `invalid_project` exists for it, and
`internal` is for programmer faults. The banner renders the code verbatim
(`apps/desktop/src/App.tsx:467-473`), so the user is told the app broke
internally when they hit a validation rule. `recoverable: false` also suppresses
the "Files were not rewritten." reassurance at `apps/desktop/src/App.tsx:471`,
which in this case would have been true and useful.

The message itself is written for the file-format audience — "key is the
immutable prefix of every ticket key" — not for someone standing in a create
form.

## The rule is undocumented and internally inconsistent

`docs/file_format.md` never states a character rule for the project key. It shows
`key: LC` (line 208), calls the key the human-facing identifier (line 127), and
fixes its immutability after the first ticket (line 223). Nothing says a letter
must come first.

Meanwhile the two validators disagree:

| Validator | Rule | `3J4` |
| --- | --- | --- |
| `is_project_key` (`core/project.rs:232-238`) | first char uppercase letter, rest uppercase or digit | rejected |
| `valid_ticket_key` (`core/storage.rs:68-80`) | prefix chars all uppercase or digit, no letter-first requirement | `3J4-1` accepted |

So the path-safety validator would happily accept tickets under a digit-leading
key that project creation refuses. Fixing this bug therefore starts with a
decision, not a patch: **is a digit-leading project key legal?** Whichever way it
goes, the rule belongs in `docs/file_format.md` and both validators must agree.

## Impact

- Any user naming a project after a date or year hits a dead end on their first
  action. This is the fastest possible onboarding failure.
- It is exactly the failure class the Step 9 pilot exists to surface
  (onboarding blocker; see the mid-v0 pilot protocol). A participant naming a
  project `30 July 4PM` is a plausible path, and a session spent on it is a
  session lost. Fix before builds go out.
- The residual `.longclaw/tickets/` in a real repository works directly against
  the trust the pilot is measuring.

## Why it was not caught

- No test exercises project creation from the UI. No frontend test references
  `createProject`; the create form is untested in
  `apps/desktop/src/*.test.tsx`.
- `is_project_key` has no direct unit test.
- No test asserts the derivation agrees with the backend grammar. The two rules
  live in different languages with no shared fixture, so they were free to drift.
- The Step 8 commit "Test the slice's surfaces, not just its pipeline"
  (`41d981d`) covered the board and panel surfaces; the create-project surface
  was the gap it left.

## Proposal

Decide the rule first, then fix in four parts.

**0. Settle the grammar.** Recommended: keep the letter-first requirement — a
key is a filesystem prefix and a human identifier, and letter-first keeps ticket
keys unambiguous — then document it in `docs/file_format.md` beside the
immutability note, and make `valid_ticket_key` enforce the same prefix grammar so
the two cannot drift. If instead digit-leading keys become legal, relax
`is_project_key` and this bug's derivation half disappears; the UI and error-path
halves still stand.

**1. Make the derivation produce only valid keys.** Take initials as today, drop
leading characters that are not letters, fall back to `LC` when nothing is left:

| Name | Today | Proposed |
| --- | --- | --- |
| `30 July 4PM` | `3J4` | `J4` |
| `2026 roadmap` | `2R` | `R` |
| `3rd party audit` | `3PA` | `PA` |
| `3j4` | `3` | `LC` |
| `My Project` | `MP` | `MP` |

**2. Stop clobbering an edited key, and validate in the form.** Auto-derive only
while the user has not edited the Key field; once edited, leave it alone. Show
the rule as help text, validate on change, and block **Choose folder** while the
key is invalid so the native picker never opens on an invalid form. Both create
forms need this — consider extracting the shared create-form logic rather than
fixing it twice.

**3. Validate before touching the filesystem, and classify honestly.** In
`initialize_project`, validate the key (and theme) before `create_dir_all`, and
return `ErrorCode::InvalidProject` with `recoverable: true` and a message written
for the form — for example: `Project key must start with a letter and use only
uppercase letters and digits, such as LC.` Nothing should be created in the
user's folder when creation fails.

**4. Cover it with tests.**

- A unit test pinning `defaultProjectKey` output against the key grammar for a
  table of names including digit-leading ones. Ideally the grammar lives in one
  shared fixture both languages read, so the JS and Rust rules cannot drift
  again.
- A component test for the create form: invalid key blocks submit, the picker is
  not opened, an edited key survives a later name edit.
- An integration test asserting a rejected key writes **nothing** — no
  `.longclaw/`, no `tickets/` — and returns `invalid_project`.

## Open questions

1. Digit-leading keys: legal or not? (Blocks everything else — see Proposal 0.)
2. Should the Key field stay visible in the create form at all, or move behind an
   "advanced" disclosure with the derived value shown read-only? The form
   currently asks every new user to understand a filesystem-prefix rule during
   onboarding.
3. Should a failed creation clean up directories it created before failing, or is
   validate-first enough? Validate-first is enough for this bug, but an I/O
   failure between `create_dir_all` and `atomic_write` leaves the same residue.
4. Is `4` characters still the right key length cap
   (`apps/desktop/src/App.tsx:46`)?

## Evidence

Derivation table reproduced with the shipped function against the backend rule:

```sh
node -e '
function defaultProjectKey(name){const l=name.toUpperCase().replace(/[^A-Z0-9 ]/g,"").split(/\s+/).filter(Boolean).map(p=>p[0]).join("").slice(0,4);return l||"LC";}
const valid=k=>/^[A-Z][A-Z0-9]*$/.test(k);
for (const n of ["30 July 4PM","3j4","2026 roadmap","3rd party audit","My Project","longclaw","4"])
  console.log(n, "->", defaultProjectKey(n), valid(defaultProjectKey(n))?"accepted":"REJECTED");
'
```

Residue and error code proven with this probe, appended to
`apps/desktop/src-tauri/tests/storage_integration.rs`, run with
`cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test storage_integration tmp_probe -- --nocapture`,
then reverted. It is recorded here so the next session can re-run it rather than
re-derive it:

```rust
#[test]
fn tmp_probe_invalid_key_leaves_residue() {
    let temp = tempfile::tempdir().expect("temporary folder");
    let root = temp.path().join("repo");
    fs::create_dir_all(&root).expect("create the folder");

    let error =
        storage::initialize_project(&root, "30 July 4PM", "3J4", None, "2026-07-29T00:00:00Z")
            .expect_err("an invalid key must be refused");
    println!("PROBE code={:?} recoverable={}", error.code, error.recoverable);
    println!(
        "PROBE tickets_dir_exists={} project_file_exists={}",
        storage::tickets_root(&root).exists(),
        storage::project_file_path(&root).exists()
    );
    for entry in walkdir::WalkDir::new(&root).into_iter().flatten() {
        println!("PROBE left_on_disk={}", entry.path().display());
    }
}
```

## Out of scope

- Renaming an existing project's key. The format fixes the key as immutable after
  the first ticket (`docs/file_format.md:223`); this bug is only about creation.
- The Step 9 pilot documentation. Unrelated to this code path.
