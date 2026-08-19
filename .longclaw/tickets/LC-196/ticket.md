---
format: longclaw.ticket/v1
id: ff43ee1f-17f2-40d3-bc11-5dd2b97412c4
key: LC-196
title: Retire the superseded components in the Claude Design system
status: done
priority: p2
labels:
  - design
created_at: 2026-08-10T07:27:01.524Z
updated_at: 2026-08-19T05:08:12.000Z
---

Three founder decisions overruled the design system after it was authored, and
the design system was never told. Its kit still *renders* the retired designs,
so anyone prototyping there builds on a product that no longer exists.

- **D3** retired the pie/ring/check/X status glyphs for a colour dot + text
  label, one geometry for all.
- **D4** retired the High/Medium/Low bar glyphs for Urgent · P1 · P2 · P3 · P4 ·
  None, the middle four as bordered mono chips.
- **ADR 0001** removed the assignee concept entirely in local mode.

LC-192 marked all three `[superseded]` in the design system's `readme.md` so
nobody rebuilds from them by accident, but the components themselves are
untouched — `StatusIcon` still draws six pies, `PriorityIcon` still draws bars.

This is Claude Design work, not repo work. The project is **LongClaw DS v3 —
system** (`d34ededb-196a-431f-b064-1ab2ef09bfe1`), which is a design-system
project and fully writable.

Two related pieces of staleness in the *document* project **LC Fable v3 Design
System** (`809bce20-a672-4824-a618-dd6c07d85f62`): it uploads
`design-brief-v3.html`, the superseded v0.5 draft, rather than the canonical
`docs/design_brief.md`; and its `_ds/` folder is a **vendored snapshot** of the
design system, not a live binding — proven by experiment in LC-192 — so it will
not show any of this until it is re-synced by hand in the Claude Design UI.

## Checklist

- [x] StatusIcon: replace the pie/ring/check/X set with dot + label (D3) <!-- longclaw:item=ck_e5b91e4c -->
- [x] PriorityIcon: replace High/Medium/Low bars with Urgent/P1-P4/None chips (D4) <!-- longclaw:item=ck_445f835b -->
- [x] Avatar: drop the assignee-slot rule — there is no assignee in local mode (ADR 0001) <!-- longclaw:item=ck_b56fe648 -->
- [x] Replace uploads/design-brief-v3.html with the canonical docs/design_brief.md <!-- longclaw:item=ck_f7e04085 -->
- [x] Re-sync the LC Fable v3 Design System document so its vendored _ds/ snapshot picks all this up <!-- longclaw:item=ck_60efb10b -->

## Activity

<!-- longclaw:event
id: evt_3dc16dd6
kind: create
occurred_at: 2026-08-10T07:27:01.524Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_962398a2
kind: comment
occurred_at: 2026-08-19T05:08:12.000Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code commented

All three retirements landed in *LongClaw DS v3 — system*, and `_ds_bundle.js` was rebuilt — the LC-223 push had updated `BoardCard.jsx`'s source but not the bundle, so rendered designs still drew the old always-green meter; the rebuild fixes that too. `StatusIcon` now draws D3's dot + label geometry (ring todo, dashed backlog, filled dot otherwise). `PriorityIcon` draws D4's Urgent · P1–P4 · None — bordered mono chips, None's dash in the same frame (LC-85) — reading the newly emitted `--priority-chip-text/-border`; the deprecated `--priority`/`--priority-off` aliases left with the bars. The assignee slot is gone from `BoardCard`, `Avatar`'s contract/docs, and the ui_kit (ADR 0001). `readme.md`'s [superseded] section is replaced by the retirement record. Verified by headless WebKit render of all four affected cards in both themes, zero bundle errors. Document project *LC Fable v3 Design System*: `uploads/design-brief-v3.html` replaced by the canonical `docs/design_brief.md`, and the vendored `_ds/` snapshot refreshed — bundle, readme, styles and all five token files (`themes.css` had been missing from it entirely). The snapshot's `_ds_manifest.json` is app-generated and was left as-is; the card set is unchanged.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_cdf68c9b
kind: update
occurred_at: 2026-08-19T05:08:12.000Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: done
-->
### Claude Code updated this ticket
<!-- /longclaw:event -->
