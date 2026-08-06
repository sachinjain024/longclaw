---
format: longclaw.ticket/v1
id: 73af3da8-a28e-4510-a3a1-623ae5297e5d
key: LC-163
title: "Theme matrix is broken: two selectors went stale when the header lost its text buttons"
status: done
priority: p2
labels:
  - frontend
created_at: 2026-08-06T14:57:54.576Z
updated_at: 2026-08-06T15:11:58.351Z
---

npm run matrix fails on main and has been failing silently. It is not in the `check` gate, so nothing caught it.

## Two failures, one root cause

Both were collateral from **LC-70**, `7692e8d feat: replace header settings text with gear` (2026-08-06), which turned the header's `Star` / `Settings` text buttons into a single ghost gear icon button.

**1. `theme-matrix.mjs:662` — hard failure, aborts the whole run.**

```
await page.click('button:has-text("Settings")')
→ Timeout 30000ms exceeded
```

The control is now `<button class="ghost small settings-button" aria-label="Project settings">` with an inline SVG and **no text content**, so `:has-text()` cannot match it. The run dies here, which is why the second failure was invisible.

**2. `theme-matrix.mjs:102` — the `.content-header .secondary` interaction probe matches nothing, in all 8 axes.**

```
interaction: .content-header .secondary background-color on hover — probe matched nothing at rest
```

`Star` and `Settings` were that header's secondary buttons. The only `.secondary` left in it is the **Rebuild index** button (`App.tsx:1212-1214`), which is gated behind `DEV_CHROME = import.meta.env.DEV` (`devChrome.ts:8`). The perf harness builds production on purpose (`perf/vite.config.ts` — "Production React, because a development build double-renders under StrictMode"), so that button never renders there and the probe can never match.

## Verified

Patching only the `:662` selector to `.settings-button` locally gets the full run through — 8 axes x 9 states — and surfaces failure 2 as the only thing left:

- `theme matrix: 8 failure(s)` — all of them the `.content-header .secondary` probe.
- `theme matrix: 8 probe(s) exempt from the AA gate` — the pre-existing disabled-primary contrast exemptions, unrelated.

So the fix is small, and after it the matrix is genuinely green apart from the one dead probe. The local patch was reverted; nothing is committed.

## Why P2

The theme matrix is the only thing that checks all four presets x both appearances for contrast and state colour. It has been dark since 2026-08-06, and it is the surface that caught the button-wrapping defect recorded on LC-73 — a class of bug no unit test sees.

Found while verifying LC-73; unrelated to that change, and confirmed against clean `main` before it merged.

## Checklist

- [x] Point the settings click at .settings-button rather than button:has-text(Settings) — theme-matrix.mjs:662 <!-- longclaw:item=ck_71172daf -->
- [x] Repoint or drop the .content-header .secondary interaction probe (theme-matrix.mjs:102); the only secondary left in that header is DEV_CHROME-gated and never renders in the perf build <!-- longclaw:item=ck_d871e859 -->
- [x] Consider putting matrix in the check gate, or a smaller smoke run of it, so the next stale selector is caught by CI rather than by hand <!-- longclaw:item=ck_ae28ddab -->

## Activity

<!-- longclaw:event
id: evt_cecc363b
kind: create
occurred_at: 2026-08-06T14:57:54.576Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_62d936a5
kind: update
occurred_at: 2026-08-06T15:11:58.351Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: done
  - field: checklist.ck_71172daf.checked
    from: "false"
    to: "true"
  - field: checklist.ck_d871e859.checked
    from: "false"
    to: "true"
  - field: checklist.ck_ae28ddab.checked
    from: "false"
    to: "true"
-->
### Claude Code updated this ticket

Fixed. `npm run matrix` reports **8 axes x 9 states clean** and exits 0.

Both selectors were repointed rather than dropped, because the probes name design-system *variants* and the variants still exist — they had only moved:

- `theme-matrix.mjs:673` clicks `.settings-button` instead of `button:has-text("Settings")`. The control is a gear icon button whose label is an `aria-label`, so `:has-text()` can never see it.
- The interaction probe now hovers `.project-actions .secondary` — the sidebar `Create project` — instead of `.content-header .secondary`. It passes the visible-feedback delta, so it is measuring a real hover again rather than sitting green on an empty match.

The 8 remaining `exempt from the AA gate` lines are the pre-existing disabled-primary contrast exemptions and are unrelated.

## Correcting this ticket on one point

I filed this saying the matrix "is not in the `check` gate, so nothing caught it", and asked in the third checklist item whether it should be added. That was wrong, and the third item is resolved as **no — do not add it**.

The matrix already runs in CI as its own `theme-matrix` job (`.github/workflows/ci.yml:38-73`), and its absence from `verify` is a deliberate, documented decision: `CONTRIBUTING.md:99-101` says `a11y:audit` and `matrix` are both kept out for the same reason — they drive WebKit — but that neither measures time, "so both hold on a CI runner and `matrix` already runs as one". Adding it to the gate would contradict a decision that is already correct.

## The real reason nothing caught it

**GitHub Actions has not executed since 2026-08-05.** Every run since then failed in 3-6 seconds with:

> The job was not started because recent account payments have failed or your spending limit needs to be increased.

The last CI run that actually executed is `30979817492`, head `a0f24a0`, 2026-08-05T05:59Z. **LC-70 landed 2026-08-06 13:00** — so the `theme-matrix` job never once ran against the commit that broke it. It would have caught this on the merge that introduced it.

That is 23 consecutive pushes to `main` with no gate behind them, including every LC-73 merge. It needs a billing fix on the account, which is not something this ticket can close — flagged to the founder rather than filed, since no code change resolves it.
<!-- /longclaw:event -->
