---
format: longclaw.ticket/v1
id: 15a70f21-4e8c-47ba-812f-1f0ca147df2c
key: LC-155
title: "npm run dev fails: cargo run cannot choose between the app and CLI binaries"
status: done
priority: none
labels:
  - platform
created_at: 2026-08-06T05:00:58.832Z
updated_at: 2026-08-06T05:01:12.796Z
---

`tauri dev` runs a bare `cargo run`, and `apps/desktop/src-tauri` has carried two `[[bin]]` targets since the `longclaw` CLI landed in a926b27. Cargo refuses to pick, so the documented `npm run dev` dies at the DevCommand step:

```
error: `cargo run` could not determine which binary to run. Use the `--bin` option
to specify a binary, or the `default-run` manifest key.
available binaries: longclaw, longclaw-desktop
```

Fixed in 2607748 by adding `default-run = "longclaw-desktop"` to the manifest. The CLI is still reached by name (`--bin longclaw`), which is how `AGENTS.md` already invokes it.

Found while verifying LC-67 in the running app.

## Activity

<!-- longclaw:event
id: evt_73633daa
kind: create
occurred_at: 2026-08-06T05:00:58.832Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
-->
### Claude Code created this ticket
<!-- /longclaw:event -->

<!-- longclaw:event
id: evt_f62931ce
kind: update
occurred_at: 2026-08-06T05:01:12.796Z
actor:
  type: agent
  id: claude-code
  name: Claude Code
changes:
  - field: status
    from: todo
    to: done
-->
### Claude Code updated this ticket

Fixed in 2607748. Verified end to end: `cargo run` resolves, the app compiles and the window renders (startup_to_rendered_ms=1866, 1180x748).

Two adjacent traps found while verifying, neither of them this bug:
- `vite.config.ts` sets `strictPort: true` on 1420 and `tauri.conf.json` hardcodes `devUrl` to match, so two checkouts cannot both run dev. The second one needs `npx tauri dev --config '{"build":{"devUrl":"http://localhost:1421","beforeDevCommand":"npm run dev:web -- --port 1421"}}'`.
- `tauri dev` must be run with the cwd inside `apps/desktop`. From the repository root the CLI finds the archived spike's `spikes/tauri-v2-architecture/src-tauri/tauri.conf.json` first and dies watching a `Cargo.toml` that is deliberately `.archived`.
<!-- /longclaw:event -->
