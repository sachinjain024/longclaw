---
format: longclaw.ticket/v1
id: a4daabec-bcc5-4963-8fe5-188e8ccc9504
key: LC-277x
title: "Attachments: in-app browser for HTML, PDF and Markdown files"
status: todo
priority: none
labels:
  - frontend
  - design
created_at: 2026-10-16T06:49:12.619Z
updated_at: 2026-10-22T08:40:36.709Z
---

Follow-up to LC-206. Blocked by LC-280x for PDFs. Attachments render in place only for images and videos. Every other file is a chip that hands off to the default macOS app:

- **PDF.** Can't be attached at all yet: the format carries only images, text and video. LC-280x makes PDFs attachable and opens them in Preview, and this ticket adds viewing them in the app.
- **Markdown** (`.md`, `.markdown`). On the allow-list, so Open hands it to another app. Nothing shows it inside LongClaw.
- **HTML** (prototypes). Kept off the allow-list on purpose, because Safari runs their scripts.
- **Text** (`.txt`, `.log`, `.csv`, `.json`, …). Opens in another app, with nothing in LongClaw.

**Direction:** HTML, PDF and Markdown files open in an **in-app browser** that opens to the right of the ticket panel. This is deferred: the pane's design comes first, and this ticket is not ready to build yet.

## Decisions

- **A link, not inline.** In a description or comment, a PDF, Markdown, HTML or text attachment renders as a link (its chip), never embedded inline the way an image or video is.
- **HTML, PDF and Markdown open in the in-app browser.** It is a pane to the right of the ticket panel, not the modal attachment viewer.
- **HTML stays off the "open in default app" allow-list.** It is reachable only through the in-app browser, never handed to Safari.

## To settle before building

- The browser pane: its width and resizing, how it sits next to the ticket panel at the 760px minimum window, how it closes, and what happens when the selected ticket changes.
- Sandboxing: no network and no script for HTML prototypes, or scripts in a sandbox with no network. Either way it must pass `audit:network` and stay inside ADR 0009 (the webview gets bytes or tokens from Rust, never a path).
- Whether the pane also opens doc references (specs, prototypes) and not only attachments.
- Plain text: the same browser pane or the existing viewer, with a size cap for large logs.

## Acceptance criteria (draft)

- [ ] Activating a PDF, Markdown or HTML attachment link opens it in the in-app browser to the right of the ticket panel.
- [ ] Markdown is shown rendered by the app's own renderer. Links and remote images inside it are not followed or loaded.
- [ ] Nothing shown in the browser can reach the network, which `audit:network` confirms.
- [ ] Keyboard: the pane can be reached and closed from the keyboard, and focus returns to the link it was opened from. Add `a11y:audit` rows.
- [ ] Every new string (pane title, loading, too large, could not read, close) is in the ticket's copy deck.

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

<!-- longclaw:event
id: evt_a37c00b6
kind: update
occurred_at: 2026-10-16T07:11:07.018Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: description
-->
### Claude Code updated this ticket

Settled both open questions. PDF, Markdown and text show as a link that opens the in-app viewer, never inline. HTML prototypes are out, even sandboxed.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_c49c7806
kind: update
occurred_at: 2026-10-16T22:20:25.891Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: title
    from: "Attachments: view PDF, Markdown and text files in the app"
    to: "Attachments: in-app browser for HTML, PDF and Markdown files"
  - field: labels
    from: frontend, ready-for-agent
    to: frontend, design
  - field: description
-->
### Claude Code updated this ticket

Direction changed: HTML, PDF and Markdown will open in an in-app browser to the right of the ticket panel, to be handled later. HTML is now in scope, through the browser only. Relabelled from ready-for-agent to design, because the pane's design isn't settled.
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_9ada7fdc
kind: update
occurred_at: 2026-10-22T08:40:36.709Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: description
-->
### Claude Code updated this ticket

Corrected: a PDF can't be attached at all today, it isn't attached-but-unopenable. Attaching PDFs is now LC-280x, which this ticket's PDF viewing waits on.
<!-- /longclaw:event -->
