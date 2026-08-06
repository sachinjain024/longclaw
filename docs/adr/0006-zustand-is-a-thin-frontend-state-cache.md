# Zustand is a thin frontend state cache

**Status:** accepted at the M2 human-review gate on 2026-07-29.

Use one small Zustand store for device-session view state. It stores the active project snapshot, the latest monotonically sequenced Rust event, optimistic write state, and ephemeral search/stream-probe presentation. It does not parse files, allocate ticket identity, resolve conflicts, suppress watcher events, or decide canonical ticket state.

The Rust `ProjectEngine` module remains authoritative while the process runs; project files remain authoritative across processes. Frontend actions call typed command wrappers and then replace or patch the cache from returned DTOs. Events older than the latest applied sequence are discarded. A rebuild snapshot can always replace the entire frontend cache.

## Consequences

- React components consume selectors from a single store and do not call Tauri directly.
- Optimistic state is allowed only when paired with the command result or a typed failure that can mark it unsaved.
- Backend DTOs are deliberately view-oriented and contain no unrestricted absolute ticket path.
- Persisting the Zustand cache is rejected. Project references — including paths, cached metadata, and reachability — belong in the Rust registry; canonical data belongs in project files. Small device-local UI preferences may use webview preference storage. An opaque last-selected project id is such a preference only when startup revalidates it against the Rust registry before opening anything; it is not a second project reference.
- Redux Toolkit was rejected for the v0 surface because its additional action/reducer ceremony adds no needed invariant. React Context was rejected because high-frequency ticket/list updates need selectors and isolated subscriptions. A custom event bus was rejected because it would recreate ordering and subscription behavior without a maintained state module.
