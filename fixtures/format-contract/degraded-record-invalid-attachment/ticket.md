---
format: longclaw.ticket/v1
id: 019c8ca0-0000-7000-8000-000000000009
key: LC-14
title: An invalid attachment entry degrades only that attachment
status: todo
priority: none
created_at: 2026-07-29T00:00:00Z
updated_at: 2026-07-29T00:00:00Z
---

Attachment bytes are never deleted because their registry entry is unreadable.

## Attachments

<!-- longclaw:attachment
id: att_0001
name: no-file-key.txt
media_type: text/plain
size: 12
added_at: 2026-07-29T05:00:00Z
added_by:
  type: human
  id: local
-->
[no-file-key.txt](./attachments/att_0001-no-file-key.txt)
<!-- /longclaw:attachment -->

<!-- longclaw:attachment
id: att_0002
file: attachments/att_0002-readable.txt
name: readable.txt
media_type: text/plain
size: 9
added_at: 2026-07-29T05:01:00Z
added_by:
  type: human
  id: local
-->
[readable.txt](./attachments/att_0002-readable.txt)
<!-- /longclaw:attachment -->
