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

`npm run verify` checks token generation, archived-spike manifest scope, the
release privacy/filesystem audit, formatting, linting, TypeScript types,
frontend tests, Rust tests, Clippy, watcher integration coverage, and the Vite
production build.

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
