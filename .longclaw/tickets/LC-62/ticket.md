---
format: longclaw.ticket/v1
id: 3061ef92-576f-47b4-bf6e-6ebeedb9ce9d
key: LC-62
title: Implement the LongClaw logo
status: done
priority: none
created_at: 2026-08-05T14:44:43.929Z
updated_at: 2026-08-21T06:47:23.480Z
---

Reopened 2026-08-18: a new mark was selected from the Aug 13 concept round —
the white-on-orange chevron-and-ring owl (`assets/brand/app-icon/`,
#FFFFFF on #B45F06). It replaces variant A "talon" everywhere the app shows
itself: the bundle icon, the in-app chrome, and the canonical docs asset.

## Checklist

- [x] Organize `assets/` — concept marks and lockups under `assets/brand/concepts/`, the selected icon set deduped under `assets/brand/app-icon/` <!-- longclaw:item=ck_3569f955 -->
- [x] Install the Tauri icon set at `apps/desktop/src-tauri/icons/` and point `bundle.icon` at the full set, so macOS picks up `icon.icns` <!-- longclaw:item=ck_98c8e592 -->
- [x] Redraw `OwlMark.tsx` to the chevron-and-ring mark, keeping the `size` prop and `currentColor` contract (side panel 22px, welcome 52px) <!-- longclaw:item=ck_2799d8e2 -->
- [x] Refresh the canonical asset `docs/design/foundations/assets/owl-mark.svg` to the new construction <!-- longclaw:item=ck_ce8cf87b -->

## Activity

<!-- longclaw:event
id: evt_ee5c0d36
kind: create
occurred_at: 2026-08-05T14:44:43.929Z
actor:
  type: human
  id: local
-->
### You created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_5d8d0c06
kind: update
occurred_at: 2026-08-05T15:14:39.753Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: backlog
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_906c5af5
kind: update
occurred_at: 2026-08-11T14:04:01.676Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: backlog
    to: done
-->
### Claude Code updated this ticket

Done — the mark is implemented and on both surfaces it was drawn for.

`src/OwlMark.tsx` is variant A "talon", the Step 1 deliverable at `docs/design/foundations/assets/owl-mark.svg` (`decisions.md` D13). It renders at 22px in the side panel (`App.tsx:1492`) and 52px on welcome (`App.tsx:2322`), which is why it is a component taking a `size` rather than an imported asset — the size is the only thing that varies.

It is single-colour by construction: every path fills with `currentColor`, so the mark takes whatever ink the chrome around it is set in and needs no accent prop. The duotone pupil variant stays reserved for marketing and never appears in app chrome. It carries `role="img"` and an `aria-label` of "LongClaw".

Filed 2026-08-05 as a bare title; closing it as observed rather than as remembered.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_f9505815
kind: update
occurred_at: 2026-08-18T09:23:09.029Z
actor:
  type: human
  id: local
changes:
  - field: status
    from: done
    to: todo
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_3b77c3a7
kind: update
occurred_at: 2026-08-18T09:23:11.202Z
actor:
  type: human
  id: local
changes:
  - field: status
    from: todo
    to: done
-->
### You updated this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_bcebe608
kind: update
occurred_at: 2026-08-18T09:42:10Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: done
    to: in_progress
-->
### Claude Code updated this ticket

Reopened for the selected app icon. The Aug 13 concept round landed in `assets/` and the white-on-orange chevron-and-ring owl was chosen (product-icon variant 4, per the set's README). Added a checklist covering the asset reorganisation, the Tauri/macOS bundle icon, the in-app `OwlMark` redraw, and the canonical docs asset.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_6aec75a4
kind: update
occurred_at: 2026-08-18T09:47:50Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: in_progress
    to: in_review
-->
### Claude Code updated this ticket

All four checklist items are done.

`assets/` is now `assets/brand/concepts/` (7 mark + 4 lockup explorations, dated names) and `assets/brand/app-icon/` (README, the Tauri `icons/` set with `128x128@2x.png` renamed at the source, and `in-app/` PNGs). The loose duplicates — five files and the zip, all byte-identical to the `tauri/` copies — were removed.

The icon set is installed at `apps/desktop/src-tauri/icons/` and `bundle.icon` now lists the standard five (it previously pointed at a nonexistent `icons/icon.png`), so macOS bundles pick up `icon.icns`.

`OwlMark.tsx` and the canonical `owl-mark.svg` are redrawn to the new construction — constant-thickness chevron band with a centre drop point, open ring (midline r=24, stroke 7, gap ±57°), kite beak — verified against the reference PNG by rasterising the draft. The `size` prop, `currentColor`, `role="img"`/`aria-label` contract is unchanged, so both use sites needed no edits. tsc, eslint, prettier, glyph-drift-guard, and all 1021 frontend tests pass.

In review rather than done: the bundle icon hasn't been seen in a real `tauri build` yet — the Dock/Finder icon is the remaining thing to eyeball.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_9d93f680
kind: update
occurred_at: 2026-08-21T06:47:23.480Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: in_review
    to: done
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->
