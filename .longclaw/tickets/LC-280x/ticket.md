---
format: longclaw.ticket/v1
id: 442dbf85-4ebe-43c3-a049-bb9d56dd5082
key: LC-280x
title: Attach PDF files
status: todo
priority: none
labels:
  - frontend
  - format
  - ready-for-agent
created_at: 2026-10-22T08:40:12.574Z
updated_at: 2026-10-22T12:44:20.385Z
---

Follow-up to LC-206. Attaching a PDF (paste, drop, the paperclip button or `longclaw ticket attach`) is refused with *"x.pdf can't be attached. Only images, text files and videos are supported."* The format only allows `image/*`, `text/*` and `video/*` (`docs/file_format.md`, *Attachments*), and the content check returns no media type for `%PDF-` on purpose. The LC-206 spec lists other media types as out of scope.

Let a PDF be attached like any other file: copied into the ticket, registered, linked, listed in References, and opened in Preview.

## Acceptance criteria

- [ ] A file whose content starts with `%PDF-` is accepted by every attach path (paste, drop, toolbar, References → *Attach a file…*, create's held files, and the CLI) and registered as `application/pdf`. The 10 MB limit (`docs/file_format.md`, ADR 0016) and the content-first check still apply. A file named `.pdf` that isn't one is still refused.
- [ ] `docs/file_format.md` adds `application/pdf` to the supported attachment media types, with the citation lock re-pointed. Older apps that don't know it keep preserving it as an opaque attachment (the existing rule).
- [ ] The inserted link is an ordinary link, not an image link, and renders as a file chip showing name, type ("PDF") and size. References lists it the same way.
- [ ] `pdf` joins the open-in-default-app allow-list, so **Open** on the chip and in the row's ⋮ menu hands it to Preview. **Show in Finder** works.
- [ ] Nothing renders a PDF inside the app yet. Viewing it in the app is LC-277x's in-app browser.
- [ ] The refusal copy is updated to name PDFs ("Only images, PDFs, text files and videos …") in Rust, the deck and the CLI help.
- [ ] Tests: an attachments core test for a PDF registering as `application/pdf`, a mislabelled `.pdf` being refused, the allow-list opening `pdf`, and a frontend test that a PDF link renders as a chip.

## Notes

- Opening a PDF in Preview never runs the PDF's JavaScript and never touches the network, so it is safe for the allow-list. (Acrobat would run it, but Preview is the macOS default.)
- `audit:network` isn't needed: nothing new loads in the webview.

## Activity

<!-- longclaw:event
id: evt_59cb9fbb
kind: create
occurred_at: 2026-10-22T08:40:12.574Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_b815e502
kind: update
occurred_at: 2026-10-22T12:44:20.385Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: description
-->
### Claude Code updated this ticket

Corrected the limit to 10 MB, as the format and ADR 0016 set it. The ticket said 25 MB; caught by Grok's review on PR #76.
<!-- /longclaw:event -->
