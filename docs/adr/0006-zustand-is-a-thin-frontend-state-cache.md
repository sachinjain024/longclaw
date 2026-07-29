# Zustand is a thin frontend state cache

**Status:** accepted at the M2 human-review gate on 2026-07-29.

Use one small Zustand store for device-session view state. It stores the active project snapshot, the latest monotonically sequenced Rust event, optimistic write state, and ephemeral search/stream-probe presentation. It does not parse files, allocate ticket identity, resolve conflicts, suppress watcher events, or decide canonical ticket state.

The Rust `ProjectEngine` module remains authoritative while the process runs; project files remain authoritative across processes. Frontend actions call typed command wrappers and then replace or patch the cache from returned DTOs. Events older than the latest applied sequence are discarded. A rebuild snapshot can always replace the entire frontend cache.

## Consequences

- React components consume selectors from a single store and do not call Tauri directly.
- Optimistic state is allowed only when paired with the command result or a typed failure that can mark it unsaved.
- Backend DTOs are deliberately view-oriented and contain no unrestricted absolute ticket path.
- Store persistence is rejected. Project references belong in the Rust registry; canonical data belongs in project files.
- Redux Toolkit was rejected for the v0 surface because its additional action/reducer ceremony adds no needed invariant. React Context was rejected because high-frequency ticket/list updates need selectors and isolated subscriptions. A custom event bus was rejected because it would recreate ordering and subscription behavior without a maintained state module.
