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

`npm run release:binary-audit` is deliberately outside that gate: it reads the
compiled binary's symbols and linked libraries, so it needs a bundle that only
`npm run build:app` produces. Run it when you change a dependency or touch the
capability file.

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

| Command                | Covers                                                                                                                                                         |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`             | frontend unit and component tests, Rust unit tests, the fixture corpus, storage and watcher integration                                                        |
| `npm run test:watcher` | the production FSEvents watcher end to end (ignored by default)                                                                                                |
| `npm run perf:rust`    | index rebuild, search, read, and write budgets against a 5,000-ticket project; `LONGCLAW_PERF_TICKETS=<n>` picks another size                                  |
| `npm run perf:board`   | input → paint on a 5,000-ticket board, traced in WebKit (see `apps/desktop/perf/README.md`)                                                                    |
| `npm run perf:list`    | the same input → paint trace against the shipped list surface                                                                                                  |
| `npm run perf:startup` | process start → first painted board, against the packaged app (needs `npm run build:app` first)                                                                |
| `npm run a11y:audit`   | accessibility Part A in WebKit: the ticket lifecycle by keyboard alone, focus order and return, visible focus, reduced motion, and 200% zoom                   |
| `npm run matrix`       | every theme preset × light and dark over nine core states, checking rendered contrast and actor distinction                                                    |
| `npm run probe:header` | the content header's geometry in WebKit while a real write is in flight, at every width the window can be (LC-149)                                             |
| `npm run probe:drag`   | where a dragged ticket actually lands, in WebKit with the write commands served: between columns and between groups, a place inside one in Manual (LC-174), and a checklist row inside the panel's list (LC-185) |

One thing under `perf/` _is_ in `npm run verify`: `perf/preview-server.test.mjs`,
which covers how all six harnesses get their server (LC-157). It spawns short
node processes and binds ephemeral sockets rather than driving a browser, so it
costs about a second and belongs with the unit suite; the harnesses themselves
stay outside the gate.

`perf:board`, `perf:list` and the two probes need a WebKit build, once per machine:

```sh
npx playwright@1.62.1 install webkit
```

None of the four performance harnesses is part of `npm run verify`: each takes
minutes, the two WebKit traces download a browser, and `perf:startup` needs a
release bundle that only `build:app` produces. Run `perf:rust` when you change
what storage does per ticket, `perf:board` or `perf:list` when you change what
that surface renders, and `perf:startup` when you change what happens before the
first board paint.

`a11y:audit`, `matrix`, `probe:header` and `probe:drag` are not in `verify` for
the same reason — all four drive WebKit — but none of them measures time, so all
four hold on a CI runner and `matrix` already runs as one. **Run `a11y:audit` when you touch
focus, a key handler, a modal, or a control's tab position**, and run
`a11y:audit -- --self-test` after adding a probe: it breaks the build on purpose
and fails if any row still passes, which is how two blind probes were caught the
day it was written.

**Run `probe:header` when you touch the content header**, its controls, or the
disk-state indicator. jsdom lays nothing out, so a header that breaks into two
rows is invisible to `npm test`; this drives a real write and measures the boxes.
It has a `--self-test` for the same reason the audit does. It is also the harness
that says when a layout change has made the header wider than the window — run
`a11y:audit` too when it does, because that is A5's question.

**Run `probe:drag` when you touch a drop handler**, `ticketMove.ts`,
`ordering.ts`, `rank.ts` or `checklistOrder.ts`. Every drag test in `npm test` is jsdom, which
dispatches whatever it is told to, so it can say the page accepted a drop and
cannot say the ticket landed where it was let go — the two defects that have hid
behind a green gate here are LC-60's window flag, where the page never saw a
`dragover`, and LC-174's rank allocation, where every event was right and the row
did not move. It carries a `--self-test` like the others.

**A `<button>` or a checkbox needs an explicit `tabIndex` and `npm run check`
enforces it.** WebKit follows the macOS _Keyboard navigation_ setting, off by
default, and with it off Tab skips both — so an unmarked one is invisible to the
keyboard on an ordinary Mac, which is what kept the panel's checklist rows
pointer-only until LC-185. Write `tabIndex={0}`, or `tabIndex={-1}` where a
roving group or an `aria-activedescendant` list owns the stop.

`perf:startup` redirects `HOME` to a throwaway directory and copies the fixture
project, so it never reads or writes the real registry in
`~/Library/Application Support/io.longclaw.desktop`. It reports warm launches by
default. For the cold budget, drop the page cache first and say so — only the
first launch of that run is cold, and the flag is an assertion the harness cannot
check:

```sh
sudo purge && npm run perf:startup -- --cold
```

## Diagnostics and privacy

Local diagnostics are written to stdout with a `LONGCLAW_LOCAL_DIAGNOSTIC`
prefix for development and review. They are not transmitted. Do not add
analytics, telemetry, crash upload, or network reporting without an explicit
architecture decision and product approval.
