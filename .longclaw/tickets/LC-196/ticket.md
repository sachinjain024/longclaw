---
format: longclaw.ticket/v1
id: ff43ee1f-17f2-40d3-bc11-5dd2b97412c4
key: LC-196
title: Retire the superseded components in the Claude Design system
status: todo
priority: p2
labels:
  - design
created_at: 2026-08-10T07:27:01.524Z
updated_at: 2026-08-10T07:27:01.524Z
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

- [ ] StatusIcon: replace the pie/ring/check/X set with dot + label (D3) <!-- longclaw:item=ck_e5b91e4c -->
- [ ] PriorityIcon: replace High/Medium/Low bars with Urgent/P1-P4/None chips (D4) <!-- longclaw:item=ck_445f835b -->
- [ ] Avatar: drop the assignee-slot rule — there is no assignee in local mode (ADR 0001) <!-- longclaw:item=ck_b56fe648 -->
- [ ] Replace uploads/design-brief-v3.html with the canonical docs/design_brief.md <!-- longclaw:item=ck_f7e04085 -->
- [ ] Re-sync the LC Fable v3 Design System document so its vendored _ds/ snapshot picks all this up <!-- longclaw:item=ck_60efb10b -->

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
