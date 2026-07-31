# The 5,000-ticket surface trace

`npm run perf:board` builds the app's own bundle as a plain web page, serves it,
and drives it in WebKit while measuring input → paint. It exists because the
Step 4 budget for _large-board keyboard/input → paint_ was the one line in the
spike's budget table with no number against it.

`npm run perf:list` is the same run against the issue list (V0-14). The scenarios
are written once and parameterised by selector, so the two numbers are comparable:
nothing but the surface changes between them. The list is the harder case — every
ticket in the project on one axis, rather than spread over six independent column
scrollers — so it is the one to run when the render path changes.

```sh
npx playwright@1.62.1 install webkit   # once per machine
npm run perf:board                     # the shipped board
npm run perf:list                      # the shipped issue list
npm run perf:board -- --nav=Tab        # the pre-roving-focus baseline
npm run perf:board -- --order=manual   # the Manual comparator (ADR 0003)
```

`--order=manual` clicks the real ordering control before measuring. Manual is the
heavier comparator — the fixture writes no ranks, so every comparison falls
through to priority — and it is the one to run after touching the sort. Run these
two from `apps/desktop`: at the repository root, `npm run perf:board -- --x` hands
the flag to npm rather than to the harness.

It prints a `PERF-UI` line next to the Rust harness's `PERF` line, a p50/p95/max
table for the three interactions, and the same numbers as JSON.

The external-write scenario writes to a different ticket per surface, named in
`SURFACES`: it has to land on a row the surface is already drawing, or the number
would describe a write the window was free not to paint. The probe assertion is
what catches getting that wrong — it did, for the list, before the target moved.

It also runs every scenario against a small board first — `--floor=600`, 0 to skip
— and reports that beside the full one, because the budget's p50 line cannot be
read literally. One frame at 60 Hz is 16.7 ms, so no input → paint measurement can
come in under 16 ms however little work the board does. The question that can be
answered is whether 5,000 tickets cost anything a small board does not, so the run
fails when a p95 exceeds 50 ms, or when a median runs more than 4 ms behind the
same interaction on the small board.

## What is real and what is stubbed

Everything above the IPC boundary is the shipping code: `src/main.tsx`'s mount,
the real `App` with its store subscriptions, the real `Board` or `IssueList`
(reached by clicking the real view toggle), the real stylesheet. Only the three
Tauri modules are swapped, in `perf/vite.config.ts`:

| Module                      | Stub              | Serves                               |
| --------------------------- | ----------------- | ------------------------------------ |
| `@tauri-apps/api/core`      | `stubs/core.ts`   | 5,000 rows, and records the probe    |
| `@tauri-apps/api/event`     | `stubs/event.ts`  | one project-event listener           |
| `@tauri-apps/plugin-dialog` | `stubs/dialog.ts` | nothing; the harness picks no folder |

`stubs/core.ts` throws on any command it was not asked for, so a measurement
cannot quietly run through an invented command. The rows come from
`perf/fixture.ts`, which generates the same ticket shape
`src-tauri/tests/performance.rs` writes to disk, so the render numbers and the
storage numbers describe the same 5,000-ticket project.

The build is a production build. A development build double-renders under
`StrictMode` and would measure work the product never does.

## How a sample is timed

Wholly inside the page:

- **starts** at the `timeStamp` WebKit put on the trusted input event — the
  moment the input existed, not the moment the driver got around to it;
- **ends** in a `setTimeout(0)` scheduled from inside a `requestAnimationFrame`
  callback. rAF runs _before_ the paint, so the timer is the first thing that can
  observe the pixels.

That is the animation-frame boundary the app's own `reportVisibleUi` probe
(`lib.rs:213`, `api.ts:153`) reports on, which is why the harness reuses the
probe rather than inventing a second definition of "painted": the external-write
scenario fails unless the probe fires and names the row that was just written.

The keyboard scenario fails unless focus actually moves to a different card, so
a key that has become a no-op reads as a broken run rather than as a fast one.

## The dependency

`playwright-core`, pinned to `1.62.1`, is the only thing this adds.

- **A real engine is not optional.** jsdom neither lays out nor paints, so it
  cannot produce an input → paint number at all. The budget is stated against
  WebKit because the shipped webview is WKWebView.
- **`playwright-core`, not `playwright`.** The `playwright` package downloads
  every browser on install, so `npm ci` in CI would pull about 300 MB it never
  uses. `playwright-core` is 13 MB and downloads nothing; the WebKit build is
  installed on demand by whoever takes a trace, and `perf:board` is not part of
  `npm run verify`.
- **Not `safaridriver`.** It needs a one-time `safaridriver --enable` with admin
  rights and drives a visible Safari window, so it cannot run unattended.
- **Not hand-rolled.** Dispatching trusted input needs a browser automation
  protocol. Speaking WebKit's inspector protocol directly is more code than a
  pinned client and breaks on engine updates without telling you.
