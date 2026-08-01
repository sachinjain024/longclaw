---
title: "System-matched appearance with an explicit override, persisted"
product: LongClaw
status: active
backlog_id: V0-35
order: 31
owner_area: Frontend
release_blocking: false
written: 2026-08-01
applies_to: "step-13-themes-appearance @ 92be09f"
depends_on: "nothing — the appearance preference and control already exist"
---

# System-matched appearance with an explicit override, persisted

> "The app already has an appearance control; matching the system is the default
> a macOS user expects, and the preference has to survive a restart." —
> `docs/backlog/v0-backlog.md:161`

## Must-pass

> Appearance follows the system until overridden, persists across restart, and
> never changes layout.

## What exists today

- `state.ts:17` — `appearance: "light" | "dark" | "system"`, default `system`.
- `App.tsx:411-420` — hydration from `localStorage` under
  `longclaw.appearance`; an unreadable store falls back to `system`.
- `App.tsx:446-457` — the write-back effect: persists the preference, resolves
  `system` through one `window.matchMedia("(prefers-color-scheme: dark)")`
  *read*, and stamps `document.documentElement.dataset.appearance`.
- `App.tsx:941-953` — the sidebar Appearance select (System / Light / Dark).
- The palette's `toggle appearance` command cycles system → light → dark →
  system (`App.tsx:1264-1272`).
- Tokens: `[data-appearance="light|dark"]` blocks in
  `src/tokens/design-tokens.css`; `color-scheme` rides along, so form controls
  and scrollbars follow.

## The gap

The `matchMedia` result is read once per effect run and never listened to. With
the preference on `system`, flipping macOS appearance while the app is running
changes nothing until some unrelated state change re-runs the effect. That fails
the first clause of the must-pass: the app *stops* following the system the
moment it has finished launching.

## What to change

1. In the `App.tsx` appearance effect, hold the `MediaQueryList` and subscribe:
   a `change` listener re-stamps `data-appearance` — but only while the
   preference is `system`. Clean the listener up on re-run/unmount. Overrides
   (`light`/`dark`) keep ignoring the system.
2. Fix the `App.test.tsx` `matchMedia` mock to carry
   `addEventListener`/`removeEventListener` so the real code path is testable.

## Must-pass checks to add (`App.test.tsx`)

- With no stored preference, `data-appearance` resolves from the system
  (`matches: true` → `dark`).
- An explicit `light` override wins over a dark system and persists to
  `localStorage`; a remount rehydrates it.
- While on `system`, a `change` event on the media query re-stamps
  `data-appearance` live; while overridden, the same event changes nothing.
- Appearance changes touch `documentElement.dataset` and CSS only — the effect
  writes no project data and calls no IPC (no `updateProjectTheme`,
  `editTicket`, or `openProject`).

## Outcome

_To be written on completion._
