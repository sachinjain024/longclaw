# LongClaw Desktop

Production Tauri v2 macOS application for the v0 local core.

## Commands

```sh
npm install
npm run dev
npm run dev:fixture
npm run verify
npm run build:app
```

`dev:fixture` registers `../../fixtures/representative-project` through the
`LONGCLAW_DEV_PROJECT` environment variable. Normal production startup uses the
local project registry and native folder selection only.

## Quality gate

`npm run verify` must pass before a change lands. It is the design-token and
structural guards, the release audit, formatting, lint, types, the frontend and
Rust suites, the Vite production build, and the watcher integration round trip.

The gate is described once, in [CONTRIBUTING](../../CONTRIBUTING.md#quality-gates)
— including which guard rejects what. Enumerating it here as well is how this
paragraph came to name a check that no longer exists.

## Privacy boundary

Local diagnostics print to stdout with the `LONGCLAW_LOCAL_DIAGNOSTIC` prefix.
The app does not transmit analytics, telemetry, crash reports, or project data.

## Registry recovery

LongClaw stores the local project list in the operating system application
support directory as `project-registry.json`. The previous valid registry is
kept next to it as `project-registry.backup.json` before each later save.

If the registry JSON is corrupt, LongClaw fails closed: it does not reset the
file or forget project paths automatically. Quit the app, copy
`project-registry.backup.json` over `project-registry.json`, and restart. If the
backup is also unusable, register the project folders again from the app; project
files in the repositories are not deleted by registry recovery.

## Device preferences

Beside the registry is `device-preferences.json`: the appearance override, the
project that was open, and each project's view, ordering and filter. They belong
to this machine rather than to any project, so they are never written into a
project folder ([ADR 0012](../../docs/adr/0012-device-preferences-are-a-file-rust-owns.md)).

This file fails _open_, which is the opposite of the registry and for the
opposite reason: the worst a lost preference costs is a window that comes up on
System appearance. One that does not parse is renamed to
`device-preferences.invalid.json` and the app starts on its defaults, so a
hand-edit that went wrong is still there to read. Deleting the file is a
supported way to start over.
