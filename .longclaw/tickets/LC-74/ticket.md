---
format: longclaw.ticket/v1
id: 84d867a3-2142-43da-80e5-0334d9dafde6
key: LC-74
title: "App shell — terminal region reserved: 24px handle, mono terminal · reserved · phase 2 — Absent (nothing in styles.css or App.tsx)"
status: done
priority: p3
labels:
  - frontend
  - prototype-diff
created_at: 2026-08-05T15:16:00.717Z
updated_at: 2026-08-06T13:08:29.941Z
---

**Prototype.** Terminal region reserved: 24px handle, mono `terminal · reserved · phase 2`

**App.** Absent (nothing in `styles.css` or `App.tsx`)

## Source

`docs/cc_screens_diff.md` — **D-0C**, § App shell, severity P3.

## Checklist

- [x] Phase-2 geometry reservation. Low value for v0 — file, don't fix, unless the release wants the promise visible. The palette's disabled New terminal · PHASE 2 row already ships (CommandPalette.tsx:207). <!-- longclaw:item=ck_048571be -->

## Activity

<!-- longclaw:event
id: evt_ae1dd55c
kind: create
occurred_at: 2026-08-05T15:16:00.717Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_28eb691d
kind: update
occurred_at: 2026-08-06T13:08:29.941Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: done
  - field: checklist.ck_048571be.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Closed as not-in-v0 rather than built. Founder decision 2026-08-06: the terminal region is not shown at all in v0 — no handle, no reserved height, no label. A strip advertising a Phase 2 feature is a promise the release does not want to make, and reserving geometry buys the shell nothing while the interior does not exist.

Recorded instead of built:

- `screen-specs.md` gains a `## Designed, but not in v0` table. The App shell diagram drops the terminal rows out of the v0 box, and § Terminal region is headed `NOT IN V0` with the design held below it for Phase 2.
- `cc_screens_diff.md` D-0C is struck as not-a-diff, and the open `Product decisions, not bugs` question is answered in place so the next screen-by-screen pass does not re-file it.
- `post-mvp-backlog.md` P8 loses its `the Phase 2 terminal region is unreserved` clause. An unreserved shell is now the spec, not a deferred discrepancy.

No app code changed — there was nothing to remove. The palette's disabled `New terminal · PHASE 2` row (`CommandPalette.tsx`) stays, and is the only Phase 2 signal v0 makes.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_5e567afc
kind: comment
occurred_at: 2026-08-06T13:20:21.687Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

Correction to the previous entry, appended rather than edited because activity is append-only.

That entry described a first pass that was reworked after review. It said `screen-specs.md` gained a `## Designed, but not in v0` table and that the App shell diagram dropped the terminal rows out of the v0 box. Neither is what shipped, and the reason matters: inserting that table near the top of `screen-specs.md` shifted every heading below line 15, and the document is cited by line number from roughly 220 places across the repo — including the app's own source comments and the section anchors inside `cc_screens_diff.md`, the very document meant to guide the next comparison. One of the citations it broke was the `screen-specs.md:34` reference in the `styles.css` comment this same change was editing.

What shipped instead is line-neutral. The `NOT IN V0` markers occupy exactly the lines they replaced (diagram rows 25-26, the side-panel bullet at 35-36, the § Terminal region heading at 55, the § Waitlist heading at 260), and the rationale is a new `## Cut from v0` section appended at the end of the file. Verified mechanically: only those six lines differ, and nothing above line 294 moved.

Review also found the decision was recorded in only one of three comparison documents. `docs/cc_ui_diffs.md` still carried finding D1 and a live `Step 4 — Reserve the terminal region`, and `docs/cd_ui_diffs.md` carried § 1's geometry claim, `Step 4: Add The Terminal Reservation`, and a build-sequence entry. All are now marked superseded, with `--lc-size-board-stack` retuning preserved as independent work. `components.md` was asserting that "only the geometry ships in v0" — an active false claim about v0 rather than preserved Phase 2 design — and is corrected line-neutrally.

`LC-52` carried the same "the Phase 2 terminal region is unreserved" clause as `post-mvp-backlog.md` P8; both are struck.
<!-- /longclaw:event -->
