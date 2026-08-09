/**
 * The one place a WebKit harness here gets a server (LC-157).
 *
 * Every harness used to spawn its own `vite preview` and then wait on a
 * hardcoded `http://localhost:4173`, which left the readiness probe unable to
 * tell its own server from another checkout's. A `vite preview` left running in
 * a second worktree answered first, and the run drove *that* build: once as a
 * `waitForFunction` timeout that read like a regression in the code under test,
 * and — the dangerous half — silently green whenever the two builds were alike
 * enough for the probes to find their selectors. `matrix` and `a11y:audit` are
 * release gates, so that is a gate that can lie.
 *
 * Three things close it, and the third is the one that makes the other two
 * safe:
 *
 *   - **A port of this run's own.** The kernel hands out one nobody holds, so
 *     nothing else is on it and two worktrees can take traces at once.
 *   - **`--strictPort`.** A port taken between the reservation and the bind
 *     kills the server rather than sliding it to the next number.
 *   - **The server names its own URL before anything is probed.** A port that
 *     answers is not evidence that it is ours; our own child saying which URL
 *     it is serving is. Until it says so, or exits, nothing is measured.
 *
 * So the run can end three ways, and none of them is "green against a build it
 * never loaded": the server answers on the port it was told to take, or it dies
 * and the run fails quoting what it said, or it never speaks and the run fails
 * naming what it waited for.
 */

import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/** The URL vite prints once it is listening, whatever it decorates it with. */
const ANNOUNCED = /(https?:\/\/[^\s/]+:(\d+))/;
/**
 * Vite bolds the port, and it splits the URL in two when it does. Colour is off
 * down a pipe, which is what this is, so it is `FORCE_COLOR` in the environment
 * that would otherwise turn a working run into "never announced a URL".
 */
// eslint-disable-next-line no-control-regex
const DECORATION = /\u001b\[[0-9;]*m/g;

/**
 * A port nothing is listening on, from the kernel rather than from a constant.
 *
 * It is released before it is returned, so this is a claim about the moment it
 * was asked and not a lock — which is why the server is launched with
 * `--strictPort`, and why what it announces is checked against what it was
 * told.
 */
export function reservePort() {
  return new Promise((settle, fail) => {
    const probe = createServer();
    probe.once("error", fail);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => settle(port));
    });
  });
}

/** How the harnesses actually serve `dist-perf`. */
function launchVitePreview({ port }) {
  return spawn(
    "npx",
    [
      "vite",
      "preview",
      "--config",
      resolve(here, "vite.config.ts"),
      "--port",
      String(port),
      "--strictPort",
    ],
    { cwd: resolve(here, ".."), stdio: ["ignore", "pipe", "pipe"] },
  );
}

const sleep = (ms) => new Promise((wake) => setTimeout(wake, ms));

/** Long enough for a dead child's last words to arrive, short enough to wait. */
const FLUSH_MS = 500;

/**
 * Serves the perf build and resolves once this run's own server answers.
 *
 * Returns the `origin` to drive, the `port` behind it, and a `close` that stops
 * the server and resolves when it is gone.
 *
 * `launch` is the seam the suite drives: it is handed `{ port }` and returns a
 * child process that announces its URL on stdout.
 */
export async function startPreview({
  timeoutMs = 30_000,
  launch = launchVitePreview,
} = {}) {
  const port = await reservePort();
  const server = launch({ port });

  let said = "";
  const hear = (chunk) => {
    said += String(chunk).replace(DECORATION, "");
  };
  server.stdout?.on("data", hear);
  server.stderr?.on("data", hear);

  // `exit` says the process is gone; `close` says its pipes are drained. The
  // run needs both — the first to stop waiting, the second so the reason it
  // gives is the server's own words rather than whatever had arrived by then.
  let death = null;
  let over;
  const exited = new Promise((settle) => {
    over = settle;
  });
  const drained = new Promise((settle) => server.once("close", settle));
  server.once("exit", (code, signal) => {
    death ??= signal ? `killed by ${signal}` : `exited with code ${code}`;
    over();
  });
  // A child that cannot be spawned emits `error` and never exits, so without
  // this the run dies on an unhandled event and `close()` waits for ever.
  server.once("error", (problem) => {
    death ??= `could not be started: ${problem.message}`;
    over();
  });

  const stop = () => {
    server.kill();
    return exited;
  };
  const fail = async (why) => {
    // Whatever it said on the way out has usually not been read yet.
    if (death) await Promise.race([drained, sleep(FLUSH_MS)]);
    return new Error(
      `${why}\nThe run measured nothing. What the server said:\n${said.trim() || "(nothing)"}`,
    );
  };

  const deadline = Date.now() + timeoutMs;
  const spent = () => Date.now() > deadline;

  // Nothing is probed until our own server has named the URL it is serving.
  // A stranger on the port cannot answer this question, only ours can — and
  // only whole lines are read, so a URL split across two reads is not mistaken
  // for a server that took the wrong port.
  let announced;
  for (;;) {
    announced = ANNOUNCED.exec(said.slice(0, said.lastIndexOf("\n") + 1));
    if (announced) break;
    if (death)
      throw await fail(`the preview server ${death} before it was serving`);
    if (spent()) {
      await stop();
      throw await fail(
        `the preview server never announced a URL for port ${port}, ` +
          `after ${timeoutMs}ms`,
      );
    }
    await sleep(50);
  }

  const [, origin, bound] = announced;
  if (Number(bound) !== port) {
    await stop();
    throw await fail(
      `the preview server was told to serve port ${port} and took ${bound} ` +
        `instead, so ${origin} is not this run's build`,
    );
  }

  for (;;) {
    if (death) throw await fail(`the preview server for ${origin} ${death}`);
    try {
      if ((await fetch(origin)).ok) break;
    } catch {
      // Listening, not answering yet.
    }
    if (spent()) {
      await stop();
      throw await fail(
        `the preview server did not answer ${origin} in ${timeoutMs}ms`,
      );
    }
    await sleep(50);
  }

  return { origin, port, close: stop };
}
