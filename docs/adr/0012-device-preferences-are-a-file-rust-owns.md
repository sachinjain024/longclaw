# Device-local preferences are a file Rust owns, not webview storage

**Status:** accepted on 2026-08-07, superseding one consequence of [ADR 0006](0006-zustand-is-a-thin-frontend-state-cache.md).

Device-local preferences — the appearance override, the last-open project, and each project's view, ordering and filter — are stored in `device-preferences.json` in the application support folder, beside `project-registry.json`, and written through the same atomic seam every other file this app owns is written through. ADR 0006 said "small device-local UI preferences may use webview preference storage". They may not. That sentence is replaced by this one; everything else ADR 0006 decides still holds, including that this is *not* a persisted Zustand cache and that the last-open project id stays an opaque hint revalidated against the Rust registry before anything is opened.

## Why

The clean-machine pass found the preferences did not come back. Set the appearance to Light, quit, relaunch, and the control read `System` again ([LC-150](../../.longclaw/tickets/LC-150/ticket.md)); with two projects registered and the second one open at quit, relaunching selected the first ([LC-151](../../.longclaw/tickets/LC-151/ticket.md)). Both were written to `localStorage` and read back from it at startup.

**Why the value did not come back was never established, and this decision does not claim it was.** D-70 said so itself — *"verify on a packaged build before filing as a bug"* — and that verification was not performed. The record is in tension, which is the honest summary of it:

- `8578f73` (2026-08-05), the clean-machine record, reports that the upgrade row *passed*: "project list, star, theme and appearance all survived installing the candidate over the previous build". Appearance had been in `localStorage` since `57b291e` (2026-07-30). D-70, filed the same day, reports the opposite.
- The same commit diagnoses the open project as never persisted at all — "`activeProjectId` lives only in the in-memory store … it was never built". The persistence D-71 was missing landed a day *later*, with LC-49 (`f2e6549`, 2026-08-06). So D-71's original cause is known and is not a storage failure; whether the code that replaced it works is the part nobody has confirmed.

What is not in tension is the position the preferences were in. Two P-level findings were filed against a store the app cannot defend — what a webview keeps across a process is the webview's business — and neither could be settled except by a person quitting and relaunching a packaged build by hand, because `localStorage` is unavailable in the vitest environment too ([LC-161](../../.longclaw/tickets/LC-161/ticket.md)). A store that cannot answer a question about itself will keep producing findings like these, and each will cost the same manual pass to close.

So the decision is not "the storage was proved broken". It is: **the cheaper thing to change is where the value lives.** A file is durable because durability is what a file is, and testable because a second `PreferencesStore::load` is a relaunch — which makes the claim in both tickets an assertion in the suite rather than a trial somebody has to remember to run. If webview storage was in fact keeping these all along, nothing is lost by the move; if it was not, the bug is gone. The asymmetry is the whole argument.

A local-first app that keeps every ticket as a file it can defend already has the mechanism. Preferences were the one thing it kept somewhere it could not.

## What was checked on the packaged build

Not the old storage — the new file, which is the claim that has to hold from here. Against the `LongClaw.app` bundle, with a throwaway `HOME` holding two registered projects (the `perf:startup` staging, plus a second project):

- **Nothing remembered** → the app opened the first registry entry and wrote `{"activeProjectId": "relaunch-a", …}`. That is the control: the file records which project actually opened.
- **`relaunch-b` remembered** → the app came up on the second project and left the document untouched. Had it fallen back, the same write would have replaced the id with `relaunch-a`.
- **`appearance: "light"` remembered** → left untouched across the relaunch, which it would not have been had the store come up on `system`.

One thing that check turned up, and it is worth writing down because it cuts against D-70's theory rather than for it: the old `localStorage` value **survived** — it was still readable to the bundle after the preferences file was deleted, and across a redirected `HOME`, which means the webview's store is not under `HOME` at all and outlived every throwaway profile in that run. On this machine, in this bundle, webview storage does persist across the process. So the reason the appearance override came back as `System` in the clean-machine pass remains unexplained, and this decision does not rest on explaining it.

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
