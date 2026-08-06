---
format: longclaw.ticket/v1
id: 73af3da8-a28e-4510-a3a1-623ae5297e5d
key: LC-163
title: "Theme matrix is broken: two selectors went stale when the header lost its text buttons"
status: todo
priority: p2
labels:
  - frontend
created_at: 2026-08-06T14:57:54.576Z
updated_at: 2026-08-06T14:57:54.576Z
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

- [ ] Point the settings click at .settings-button rather than button:has-text(Settings) — theme-matrix.mjs:662 <!-- longclaw:item=ck_71172daf -->
- [ ] Repoint or drop the .content-header .secondary interaction probe (theme-matrix.mjs:102); the only secondary left in that header is DEV_CHROME-gated and never renders in the perf build <!-- longclaw:item=ck_d871e859 -->
- [ ] Consider putting matrix in the check gate, or a smaller smoke run of it, so the next stale selector is caught by CI rather than by hand <!-- longclaw:item=ck_ae28ddab -->

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
