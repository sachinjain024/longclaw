---
format: longclaw.ticket/v1
id: e1710fe1-1f67-4ae4-9109-ef1cce5bae08
key: LC-283u
title: A ticket save on a FAT32 volume reports failure and loses the conflict check
status: todo
priority: p1
labels:
  - persistence
type: bug
created_at: 2026-11-02T12:21:50.148Z
updated_at: 2026-11-02T12:21:50.148Z
---

On a FAT32 volume, every ticket save writes the new bytes, reports a failure, and loses the conflict check. `core::storage::atomic_replace` relies on `renamex_np(RENAME_SWAP)` to leave the displaced file at the temporary path so it can compare its hash against the version the save was built on. macOS's FAT32 driver (FSKit `msdos`) accepts the flag and does a **plain rename**: the call returns 0, `ticket.md` holds the new bytes, and the temporary path is gone. The function then fails to read the temporary file and returns *Saving ticket* as an I/O error for a save that landed. An external edit made inside the validate-to-replace window is overwritten without the conflict ever being raised.

`is_unsupported` cannot catch this, because no error is returned. The designed answer for such a volume already exists: `swap_unsupported_error` refuses the write and tells the person to move the project to APFS or HFS+.

Found by `npm run probe:update` (LC-267r) on 2026-11-02, then confirmed directly on a FAT32 disk image: two files, `rc 0`, `new.tmp: <gone>`, `ticket.md: NEW`. The same call on APFS leaves `new.tmp: OLD`. ExFAT refuses honestly with `ENOTSUP`.

## Fix

LC-267r added `core::storage::volume_declares_swap(path)`, which reads the volume's `VOL_CAP_INT_RENAME_SWAP` bit through `getattrlist`. FAT32 and ExFAT both report it as unsupported, and APFS reports it as supported. `atomic_replace` (both of its `swap_paths` calls) should ask this first and answer `Some(false)` with `swap_unsupported_error` before writing the temporary file.

## Checklist

- [ ] Ask the volume before the swap in atomic_replace; Some(false) is the existing unsupported refusal <!-- longclaw:item=ck_40d9cb33 -->
- [ ] Prove it on a FAT32 disk image, in the shape of probe:update's FAT case: the save is refused and ticket.md is unchanged <!-- longclaw:item=ck_32a707a0 -->

## Activity

<!-- longclaw:event
id: evt_cedad20a
kind: create
occurred_at: 2026-11-02T12:21:50.148Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->
