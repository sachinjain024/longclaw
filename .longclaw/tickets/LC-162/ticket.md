---
format: longclaw.ticket/v1
id: 91522f2c-e79a-42d6-a2c1-b89392330ee2
key: LC-162
title: Command palette — add an Open folder command to the palette root
status: todo
priority: p3
labels:
  - frontend
created_at: 2026-08-06T14:19:35.618Z
updated_at: 2026-08-06T14:19:35.618Z
---

Registering a folder has no keyboard path today. The palette root has `Create ticket`, `Go to project…`, `Search tickets…`, status, priority, theme, view, archive and the disabled `New terminal` row (`CommandPalette.tsx:150-211`) — but nothing that *registers* a folder. `Go to project…` only lists projects already known.

So the only way to add a project is the sidebar `Open folder` button, which means a pointer.

This was the first checklist item of **LC-156**, which was canceled when the founder decision of 2026-08-06 kept the project actions in the sidebar (see LC-73). The other two items died with that premise; this one did not depend on it. The palette is the app's keyboard surface and `components.md:36` is explicit that every pointer action has one.

Small and self-contained: the handler already exists — `chooseProject()` in `App.tsx` — and the palette takes commands as data.

## Checklist

- [ ] Add Open folder to the palette root, running the same chooseProject() the sidebar ghost button calls <!-- longclaw:item=ck_e223ae88 -->
- [ ] Confirm it is reachable with a project open and with none, and that focus returns per keyboard-focus-map.md:147 <!-- longclaw:item=ck_1da92043 -->

## Activity

<!-- longclaw:event
id: evt_e5bcc1d6
kind: create
occurred_at: 2026-08-06T14:19:35.618Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
