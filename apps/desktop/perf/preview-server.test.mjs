/**
 * LC-157: the harnesses all waited on one hardcoded port, and the readiness
 * probe could not tell their own server from another worktree's on it.
 *
 * These drive `startPreview` with the launch injected, because what is under
 * test is the plumbing around the server — which port it takes, and what it
 * does when the thing answering is not the server it started — and spending a
 * real `vite preview` per case would put a build in the unit suite.
 */

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { afterEach, expect, test } from "vitest";

import { reservePort, startPreview } from "./preview-server.mjs";

/** Everything a case opened, torn down whether or not it got that far. */
const opened = [];

afterEach(async () => {
  await Promise.all(opened.splice(0).map((close) => close()));
});

/** Stands in for `vite preview`: announces a URL, then answers on it. */
function serving(port, announce = port) {
  return spawn(
    process.execPath,
    [
      "-e",
      `require("node:http")
         .createServer((_, response) => response.end("ok"))
         .listen(Number(process.env.PORT), "127.0.0.1", () => {
           console.log("  ➜  Local:   http://localhost:" + process.env.ANNOUNCE + "/");
         })`,
    ],
    {
      env: { ...process.env, PORT: String(port), ANNOUNCE: String(announce) },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
}

/** The same, announcing the way vite does with colour forced on: port bolded. */
function servingInColour(port) {
  return spawn(
    process.execPath,
    [
      "-e",
      `require("node:http")
         .createServer((_, response) => response.end("ok"))
         .listen(Number(process.env.PORT), "127.0.0.1", () => {
           console.log(
             "  \\u001b[32m➜\\u001b[39m  \\u001b[1mLocal\\u001b[22m:   " +
               "\\u001b[36mhttp://localhost:\\u001b[1m" + process.env.PORT +
               "\\u001b[22m/\\u001b[39m",
           );
         })`,
    ],
    {
      env: { ...process.env, PORT: String(port) },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
}

/** A server that dies on startup, the way `--strictPort` makes vite die. */
function dying(complaint) {
  return spawn(
    process.execPath,
    ["-e", `console.error(${JSON.stringify(complaint)}); process.exit(1)`],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
}

/** A server that comes up and never says so. */
function mute() {
  return spawn(process.execPath, ["-e", "setTimeout(() => {}, 60_000)"], {
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/** A decoy holding the port, standing in for the other worktree's preview. */
async function squatOn(port) {
  const decoy = createServer((_, response) => response.end("other worktree"));
  await new Promise((listening) => decoy.listen(port, "127.0.0.1", listening));
  opened.push(() => new Promise((closed) => decoy.close(closed)));
}

test("reserves a port nothing is listening on, and a fresh one each time", async () => {
  const first = await reservePort();
  const second = await reservePort();

  expect(first).not.toBe(second);
  for (const port of [first, second]) {
    await expect(fetch(`http://127.0.0.1:${port}`)).rejects.toThrow();
  }
});

test("serves on a port of its own, so two runs never share one", async () => {
  const runs = await Promise.all([
    startPreview({ launch: ({ port }) => serving(port) }),
    startPreview({ launch: ({ port }) => serving(port) }),
  ]);
  runs.forEach((run) => opened.push(run.close));

  expect(runs[0].origin).not.toBe(runs[1].origin);
  for (const run of runs) {
    expect((await fetch(run.origin)).ok).toBe(true);
  }
});

test("reads the URL through vite's colouring, which splits it in two", async () => {
  const run = await startPreview({
    launch: ({ port }) => servingInColour(port),
    timeoutMs: 5_000,
  });
  opened.push(run.close);

  expect(run.origin).toBe(`http://localhost:${run.port}`);
});

test("fails the run when its own server dies, however the port answers", async () => {
  await expect(
    startPreview({
      launch: ({ port }) => {
        // The shape of the bug: ours is gone, and the port answers anyway.
        void squatOn(port);
        return dying("Port is already in use");
      },
      timeoutMs: 5_000,
    }),
  ).rejects.toThrow(/Port is already in use/);
});

test("refuses a server that took a port other than the one it was given", async () => {
  const elsewhere = await reservePort();

  await expect(
    startPreview({
      launch: () => {
        const stray = serving(elsewhere);
        opened.push(() => void stray.kill());
        return stray;
      },
      timeoutMs: 5_000,
    }),
  ).rejects.toThrow(/not this run's build/);
});

test("names what it waited for when the server never speaks", async () => {
  const idle = mute();
  opened.push(() => void idle.kill());

  await expect(
    startPreview({ launch: () => idle, timeoutMs: 500 }),
  ).rejects.toThrow(/never announced a URL for port \d+/);
});

test("stops the server it started", async () => {
  const run = await startPreview({ launch: ({ port }) => serving(port) });
  expect((await fetch(run.origin)).ok).toBe(true);

  await run.close();

  await expect(fetch(run.origin)).rejects.toThrow();
});
