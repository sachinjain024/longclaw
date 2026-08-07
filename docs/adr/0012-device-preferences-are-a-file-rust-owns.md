# Device-local preferences are a file Rust owns, not webview storage

**Status:** accepted on 2026-08-07, superseding one consequence of [ADR 0006](0006-zustand-is-a-thin-frontend-state-cache.md).

Device-local preferences — the appearance override, the last-open project, and each project's view, ordering and filter — are stored in `device-preferences.json` in the application support folder, beside `project-registry.json`, and written through the same atomic seam every other file this app owns is written through. ADR 0006 said "small device-local UI preferences may use webview preference storage". They may not. That sentence is replaced by this one; everything else ADR 0006 decides still holds, including that this is *not* a persisted Zustand cache and that the last-open project id stays an opaque hint revalidated against the Rust registry before anything is opened.

## Why

The clean-machine pass found the preferences did not come back. Set the appearance to Light, quit, relaunch, and the control read `System` again ([LC-150](../../.longclaw/tickets/LC-150/ticket.md)); with two projects registered and the second one open at quit, relaunching selected the first ([LC-151](../../.longclaw/tickets/LC-151/ticket.md)). Both were written to `localStorage` and read back from it at startup, and the code for both was correct — the storage is what did not survive the process on the packaged build.

That is the deciding fact, and it is not one the app can fix from its own side: the store belongs to the webview and what it keeps is the webview's business. `localStorage` is also unavailable in the vitest environment for an unrelated reason ([LC-161](../../.longclaw/tickets/LC-161/ticket.md)), which meant the one place these could have been proved was the one place that could not run them. A file removes both problems at once: it is durable because durability is what a file is, and it is testable because a second `PreferencesStore::load` is a relaunch.

A local-first app that keeps every ticket as a file it can defend already has the mechanism. Preferences were the one thing it kept somewhere it could not.

## What Rust owns, and what it does not

**Rust owns the file.** Where it is, that a write lands or does not (`atomic_write`, so a torn write is not a corrupt preference), and that a document nobody can parse is moved aside rather than read or overwritten — somebody hand-edited it, and it is theirs.

**Rust does not read the document.** It is a JSON object the webview hands over whole and takes back whole. The vocabulary inside it is the frontend's — view modes, ordering, a filter string — and a copy of that vocabulary in the backend would be a second place to change every time a preference is added, in exchange for no invariant Rust could enforce that the frontend cannot.

So validation stays in the frontend, where it already was, and it stays strict for a new reason: the document is a file a human can open and edit, and one written by another build. `devicePreferences.ts` checks every field against the vocabulary this build knows and drops what it does not recognise, rather than putting an unknown ordering into the store.

## Consequences

- **The document is read once, before the first render.** `main.tsx` awaits it. The appearance is stamped on the root and the workspace record is the initial state of a `useState`, so a document that arrives a tick later is a flash of the wrong theme and a frame of the wrong project. Anything else that mounts `App` — `perf/main.tsx`, the suite — does the same, which is what makes a relaunch expressible in a test.
- **Loading never fails.** The registry refuses to start on a registry it cannot parse, because the alternative is a human whose projects have silently vanished. The opposite is true here: the worst an unreadable preferences file can cost is a window that comes up on System appearance, and refusing to launch over that would be a larger fault than the one it reports.
- **Writes leave immediately and coalesce.** No debounce was added at this seam: the last thing a human does before quitting is often the thing they just changed. A change made while a write is in flight sends one more write when it settles. The filter, which changes on every keystroke, is already held for 150ms by `App` before it reaches here.
- **A host with no backend degrades to a session that cannot restore.** A browser tab, a harness that answers no commands: every read answers with the launch defaults and every write is dropped. That is what webview storage did on a host without it, and it is the one behaviour worth keeping from it.
- **What the last build wrote to webview storage is adopted once.** `webviewPreferences.ts` reads the three old keys — including the ordering key from the schema before that — when the file is absent, so somebody upgrading from a build where storage did work does not start over. Nothing writes there any more, and the module can go once no installed build predates this decision.
- Two commands cross IPC, `read_preferences` and `write_preferences`, and they are the only ones in the surface that carry an untyped document. ADR 0007's split still applies: they are commands, not events, because nothing about a preference is a stream.
