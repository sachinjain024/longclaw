---
format: longclaw.ticket/v1
id: a4daabec-bcc5-4963-8fe5-188e8ccc9504
key: LC-277x
title: "Attachments: view PDF, Markdown and text files in the app"
status: todo
priority: none
labels:
  - frontend
  - ready-for-agent
created_at: 2026-10-16T06:49:12.619Z
updated_at: 2026-10-16T06:49:12.619Z
---

Follow-up to LC-206. Attachments render in place only for images and videos. Every other file is a chip that hands off to the default macOS app, and PDFs can't do even that:

- **PDF.** Not one of the format's media-type families (`media_type` returns `None` for `%PDF-`), and not on the open allow-list. A PDF attachment is a chip with no type, and **Open** refuses it.
- **Markdown** (`.md`, `.markdown`) and **text** (`.txt`, `.log`, `.csv`, `.json`, …). These are on the allow-list, so Open hands them to another app. Nothing shows them inside LongClaw.

Support these three kinds in attachments: they should be read inside the app, the way an image or a video already can be.

## Acceptance criteria

- [ ] A PDF attachment is recognised as one: its media type is recorded and shown on the chip and in References.
- [ ] A PDF can be viewed inside the app (a viewer like the image viewer, with paging and scroll), and opened in Preview from its ⋮ menu.
- [ ] A Markdown attachment can be viewed rendered, using the app's own Markdown renderer. Links and images inside it are not followed or loaded.
- [ ] A text attachment can be viewed as plain monospaced text. A size cap keeps a huge log from freezing the panel, and the viewer says when the text is cut short.
- [ ] Rendering stays inside ADR 0009 and the network audit. The webview gets bytes or tokens from Rust, never a path, and nothing in a viewed file can reach the network or run script.
- [ ] Keyboard and focus follow the existing viewer: Esc closes it and focus returns to the chip. Add `a11y:audit` rows.
- [ ] Copy for every new viewer state (loading, too large, could not read) is in the ticket's copy deck.

## Open questions

- Inline in the description (like images), or only in the viewer?
- Should `.html` prototypes join this, sandboxed, or stay out (see LC-206's open allow-list question)?

## Activity

<!-- longclaw:event
id: evt_8e209ee4
kind: create
occurred_at: 2026-10-16T06:49:12.619Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
