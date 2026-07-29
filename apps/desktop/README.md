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

`npm run verify` checks formatting, linting, TypeScript types, frontend tests,
Rust tests, Clippy, watcher integration coverage, and the Vite production
build.

## Privacy boundary

Local diagnostics print to stdout with the `LONGCLAW_LOCAL_DIAGNOSTIC` prefix.
The app does not transmit analytics, telemetry, crash reports, or project data.
