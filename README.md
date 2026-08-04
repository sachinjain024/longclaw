# LongClaw

LongClaw is a local-first project manager for humans and AI agents. Humans plan and remain accountable for tickets; agents execute work and contribute their context back to the same ticket record stored beside the code.

The product is in v0 local-core development. The production desktop app lives
in `apps/desktop` and targets Tauri v2 on macOS.

## Product principles

- Files on disk are the source of truth.
- The on-disk format is designed for reliable agent reads and writes.
- Humans and agents collaborate on the same tickets, while assignees remain human.
- The desktop experience targets Linear-grade speed and polish.
- Local use requires no account or telemetry.

## Documentation

- [Vision and scope](docs/vision.md)
- [Design brief](docs/design_brief.md)
- [MVP execution plan](docs/mvp_plan_order.md)
- [On-disk file format and data model](docs/file_format.md)
- [Revised v0 backlog](docs/backlog/v0-backlog.md)
- [Acceptance scenarios](docs/acceptance/README.md)
- [Pilot macOS build](docs/acceptance/pilot-build.md)
- [Mid-v0 pilot protocol](docs/pilot/README.md)
- [Pilot response memo](docs/pilot/response-memo.md)
- [v0 release risks](docs/release-risks.md)
- [Example agent context files](examples/agent-context/)
- [Domain language](CONTEXT.md)
- [Contributor setup](CONTRIBUTING.md)

## Development

Prerequisites:

- Node.js 22 or newer.
- Rust with Cargo, Rustfmt, and Clippy.
- macOS for the supported Tauri desktop target.

Install and verify from a clean checkout:

```sh
npm --prefix apps/desktop install
npm run verify
```

Launch the app:

```sh
npm run dev
```

Launch with the development fixture registered:

```sh
npm run dev:fixture
```

Build web assets and the production desktop app:

```sh
npm run build
npm run build:app
```

`npm run verify` rejects token, archived-spike manifest, release-audit,
formatting, lint, type, unit-test, integration-test, Clippy,
watcher-integration, and Vite production-build failures.

Local diagnostics are stdout-only and prefixed with
`LONGCLAW_LOCAL_DIAGNOSTIC`; no telemetry or analytics are sent.

## License

LongClaw source code is licensed under the [Mozilla Public License 2.0](LICENSE).

## v0 ticket layout

Each ticket owns a stable directory containing its canonical Markdown record and attachments:

```text
.longclaw/tickets/LC-42/
├── ticket.md
└── attachments/
```

`ticket.md` stores the ticket's structured metadata, description, checklist, attachment registry, comments, and activity. Text, image, and video attachment files live under the ticket's `attachments/` directory.

See [docs/file_format.md](docs/file_format.md) for the approved contract.
