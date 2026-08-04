# Contributing to LongClaw

LongClaw is a local-first desktop application. Local use and development must
not require an account, analytics, telemetry, or a network service.

## Prerequisites

- macOS for the supported desktop target.
- Node.js 22 or newer.
- Rust with Cargo and Clippy.
- Tauri v2 platform prerequisites for macOS.

## Setup

```sh
npm --prefix apps/desktop install
npm run verify
```

## Development

```sh
npm run dev
```

For fixture-backed visual review:

```sh
npm run dev:fixture
```

`dev:fixture` registers `fixtures/representative-project` through the
`LONGCLAW_DEV_PROJECT` environment variable. This is development-only fixture
loading; production behavior is driven by the user-selected project registry
and never depends on bundled mock data.

## Quality gates

Run the full local gate before committing:

```sh
npm run verify
```

The gate covers token generation, archived-spike manifest scope, the release
privacy/filesystem audit, formatting, linting, TypeScript type checking,
frontend unit and component tests, Rust unit/integration tests, watcher
integration coverage, Clippy, and the Vite production build.

Component tests run in jsdom and opt in per file with a
`// @vitest-environment jsdom` docblock, so pure logic tests stay on the fast
node environment. A component test stubs `src/api.ts` rather than reaching for
IPC: it asserts what the surface does with what storage returned, and the real
storage path is covered by the Rust integration suites.

## The file format is tested from fixtures

`fixtures/format-contract/` holds one directory per contract case: the bytes a
human, agent, or editor could put on disk, and the outcome a conforming reader
must produce. Adding a directory adds a test — see that directory's `README.md`,
which also records the reader decisions the corpus fixes.

`fixtures/representative-project/` is the canonical example project. It doubles
as the `dev:fixture` project and is asserted to round-trip byte-for-byte, so keep
it conformant; `LC-98` and `LC-99` are intentionally broken and are expected to
stay that way.

Test suites worth knowing about:

| Command                | Covers                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------- |
| `npm test`             | frontend unit and component tests, Rust unit tests, the fixture corpus, storage and watcher integration |
| `npm run test:watcher` | the production FSEvents watcher end to end (ignored by default)                                         |
| `npm run perf:rust`    | index rebuild, search, read, and write budgets against a 5,000-ticket project                           |
| `npm run perf:board`   | input → paint on a 5,000-ticket board, traced in WebKit (see `apps/desktop/perf/README.md`)             |
| `npm run perf:list`    | the same input → paint trace against the shipped list surface                                           |

`perf:board` needs a WebKit build, once per machine:

```sh
npx playwright@1.62.1 install webkit
```

Neither performance harness is part of `npm run verify`: both take minutes, and
`perf:board` downloads a browser. Run them when you change what the board renders
or what storage does per ticket.

## Diagnostics and privacy

Local diagnostics are written to stdout with a `LONGCLAW_LOCAL_DIAGNOSTIC`
prefix for development and review. They are not transmitted. Do not add
analytics, telemetry, crash upload, or network reporting without an explicit
architecture decision and product approval.
