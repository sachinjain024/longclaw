# Rust owns filesystem authority and project persistence

**Status:** proposed for acceptance at the M2 human-review gate.

The main webview may open a native folder picker, call registered commands, and receive events. It receives no filesystem, shell, process, or network capability. Rust canonicalizes the chosen folder, validates `.longclaw/longclaw.yaml`, and persists a small project-reference registry in the operating system application-support directory using the same sibling-temp-plus-rename discipline as ticket writes.

After registration, frontend calls name a `projectId` and domain identity such as `ticketKey`. Rust resolves the canonical root from its registry, validates the key grammar, canonicalizes the resulting ticket path, rejects symlink escapes, and performs all reads and writes.

## Consequences

- Removing a registry entry must never remove project files.
- A missing folder remains a reachable registry concept with cached name/path and an unavailable state.
- The content security policy permits bundled code and Tauri IPC only. Capabilities target the `main` window explicitly.
- Passing absolute ticket paths through every command was rejected because it spreads scope validation across callers. Granting the frontend a broad filesystem scope was rejected because a webview compromise would gain unnecessary authority. Storing project paths in frontend local storage was rejected because it bypasses Rust validation and cannot represent reachability safely.
- A notarized direct-distribution build can reopen ordinary paths. If a future App Store or sandboxed distribution is required, macOS security-scoped bookmarks become a separate persistence adapter and must be proven before enabling the sandbox.
