#!/usr/bin/env node
/**
 * The runtime network audit — the release blocker `binary-audit.mjs` names and
 * cannot itself answer.
 *
 * `release-audit.mjs` reads what the build is declared to contain.
 * `binary-audit.mjs` reads what the shipped binary links. Both end at the same
 * wall, and both say so: WebKit is network-capable by construction, no symbol
 * table describes what a webview does, and only a process monitor can tell you
 * whether the running app opened a connection.
 * `docs/acceptance/release-candidate.md` § Security, privacy, and filesystem
 * has asked for that pass since Step 16b and it has never been run.
 *
 * **The fact that makes a naive version of this worthless.** On macOS a
 * WKWebView's network traffic does not belong to the app's process. WebKit runs
 * its GPU, WebContent and Networking roles as XPC services, and every one of
 * them is reparented to launchd — `PPID 1`, not the app. So
 * `lsof -i -p <app-pid>` reports nothing, exits 1, and a script that treated
 * that as "no connections" would pass every time while watching the one process
 * that was never going to make the call. That is the failure the Step 16a matrix
 * had and the shape `binary-audit.mjs` was written against.
 *
 * So attribution here is by **lifecycle, proven at both ends**: the helper set
 * is the WebKit processes that did not exist before the app launched, and the
 * run is only certified if that same set dies with the app. Measured on the
 * build machine, one launch produces exactly three — GPU, Networking,
 * WebContent — and all three exit on SIGTERM.
 *
 * **Two probes, because each one's blind spot is the other's evidence.**
 *
 * - `lsof -i -n -P` names peers but samples on an interval, so a connection that
 *   opens and closes between two samples is invisible to it.
 * - `nettop` byte counters are cumulative and therefore cannot miss traffic, but
 *   they never name a peer.
 *
 * Neither alone supports an absence claim. Together they do, and they disagree
 * in a way that is readable: counters that moved while no peer was ever sampled
 * means the interval missed something, and this **fails** rather than reporting
 * a clean run.
 *
 * **Controls first, for the same reason `binary-audit.mjs` has them.** Every
 * result here is an absence claim, and an absence claim is worth exactly what
 * the reading is worth. Five things must be true before a clean run means
 * anything; if any of them is false the run is not certified, whatever the
 * findings say:
 *
 *   C1  the monitored set contains a WebKit Networking helper — otherwise the
 *       probe cannot see the webview at all
 *   C2  a deliberate control connection is observed — otherwise the sampler is
 *       blind and would report silence against anything
 *   C3  the byte-counter probe reads real traffic — otherwise the second probe
 *       contributed nothing
 *   C4  the helper set died with the app — otherwise those PIDs were never
 *       demonstrably the app's, and neither is their silence
 *   C5  the app painted a board — otherwise it exercised nothing, and an app
 *       that did nothing is silent for reasons that have no bearing on release
 *
 * **What this cannot prove.** It watches sockets and byte counters, not
 * payloads: it says a connection was or was not made, never what crossed one. A
 * clean run on this machine is not a clean run on the reviewer's — the
 * clean-machine row of the gate is a separate pass and stays manual. And it
 * observes only what the operator exercised, which is why the step list is
 * recorded next to the result rather than assumed, and why an unattended
 * `--duration` run says in as many words that it is not the release pass.
 *
 * One attribution gap worth naming, because the launch-window rule cannot see
 * it: macOS may hand an app a **prewarmed** WebKit process that already existed,
 * and such a helper is not in the launch-window diff. Every observed launch on
 * the build machine spawned three fresh helpers instead, and C1 fails the run if
 * no Networking helper is attributed at all — but on a machine where prewarming
 * does occur, `--attach` is the conservative mode: it monitors every helper
 * present, which can raise another app's connection but cannot miss LongClaw's.
 *
 * The same rule cuts the other way, so **run this on a quiet machine**: any
 * WebKit process that starts during the window is attributed to the app, so a
 * browser launched, or `npm run matrix` or `a11y:audit` started alongside it,
 * lands another process's connections in this record as findings.
 *
 * Usage, from `apps/desktop` — the repo-root wrapper is
 * `npm --prefix apps/desktop run audit:network`, and npm eats one `--`, so a
 * flag given at the root is silently dropped rather than rejected. Pass them
 * twice there, as `startup-trace.mjs` documents for the same reason:
 *   npm run audit:network                      # launch the bundle, guided steps
 *   npm run audit:network -- --phase=offline   # label the run; do this one first
 *   npm run audit:network -- --attach          # audit an app the operator launched
 *   npm run audit:network -- --duration=180    # unattended, sample for N seconds
 *   npm run audit:network -- --self-test       # inject a peer, expect the run to go red
 */

import { execFileSync, spawn } from "node:child_process";
import { createServer } from "node:net";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, "..");
const repoRoot = resolve(here, "../../..");

const BINARY = join(
  appRoot,
  "src-tauri/target/release/bundle/macos/LongClaw.app/Contents/MacOS/longclaw-desktop",
);
const OUT = join(appRoot, "dist-network-audit");

const argument = (name, fallback) => {
  const hit = process.argv.find((value) => value.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const PHASE = argument("phase", "unlabelled");
const INTERVAL_MS = Number(argument("interval", "500"));
const DURATION_S = Number(argument("duration", "0"));
const ATTACH = process.argv.includes("--attach");
const SELF_TEST = process.argv.includes("--self-test");
const PROJECT = resolve(
  argument("project", join(repoRoot, "fixtures/representative-project")),
);

/**
 * The gate's own list, in its order
 * (`docs/acceptance/release-candidate.md` § Security, privacy, and filesystem).
 * The operator drives these; the harness only records which one was live when a
 * connection appeared, because "at launch" and "during search" are different
 * findings.
 */
const STEPS = [
  "launch and reach project selection",
  "open a project",
  "create a ticket",
  "edit a ticket, and let an external write land",
  "archive a ticket",
  "search and filter",
  "restart the app",
];

/* ---------- process-set resolution ---------- */

/** `[{ pid, ppid, comm }]` for every process this user can see. */
function processTable() {
  const out = execFileSync("ps", ["-ax", "-o", "pid=,ppid=,comm="], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  const rows = [];
  for (const line of out.split("\n")) {
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+(.*)$/);
    if (match) {
      rows.push({
        pid: Number(match[1]),
        ppid: Number(match[2]),
        comm: match[3].trim(),
      });
    }
  }
  return rows;
}

const isWebKitHelper = (comm) => comm.includes("com.apple.WebKit");
const helperRole = (comm) => comm.split("/").pop() ?? comm;

/** Every WebKit helper PID alive right now, mapped to its role. */
function webkitHelpers(table = processTable()) {
  return new Map(
    table
      .filter((row) => isWebKitHelper(row.comm))
      .map((row) => [row.pid, helperRole(row.comm)]),
  );
}

/** `root` and every process descended from it. */
function descendants(root, table = processTable()) {
  const children = new Map();
  for (const row of table) {
    if (!children.has(row.ppid)) children.set(row.ppid, []);
    children.get(row.ppid).push(row.pid);
  }
  const found = new Set([root]);
  const queue = [root];
  while (queue.length > 0) {
    for (const child of children.get(queue.pop()) ?? []) {
      if (!found.has(child)) {
        found.add(child);
        queue.push(child);
      }
    }
  }
  return found;
}

/* ---------- probe 1: lsof, which names peers ---------- */

const LOOPBACK = /^(127\.\d+\.\d+\.\d+|\[?::1\]?|localhost)$/i;

/**
 * The peer half of an lsof name, or null when the socket has no peer — a
 * listener, or an unbound UDP socket.
 */
function peerOf(name) {
  const arrow = name.indexOf("->");
  if (arrow === -1) return null;
  return name.slice(arrow + 2).trim();
}

const hostOf = (endpoint) => {
  if (!endpoint) return null;
  const bracketed = endpoint.match(/^\[(.+)\]:(\d+|\*)$/);
  if (bracketed) return bracketed[1];
  const colon = endpoint.lastIndexOf(":");
  return colon === -1 ? endpoint : endpoint.slice(0, colon);
};

/**
 * One `lsof` sample over `pids`, parsed from field output rather than columns —
 * the human-readable NAME column contains spaces and states, and splitting it
 * is how a parser starts silently dropping rows.
 *
 * lsof exits 1 when nothing matches, which is the expected result here and not
 * an error.
 */
function lsofSample(pids) {
  if (pids.size === 0) return [];
  let out = "";
  try {
    out = execFileSync(
      "lsof",
      ["-i", "-n", "-P", "-a", "-p", [...pids].join(","), "-F", "pcnT"],
      { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
    );
  } catch (error) {
    // Exit 1 with no output is "no open connections". Anything else is a
    // probe failure and must not read as silence.
    if (error.status === 1 && !error.stdout) return [];
    if (error.stdout) out = error.stdout;
    else throw error;
  }

  const rows = [];
  let pid = null;
  let command = null;
  let name = null;
  for (const line of out.split("\n")) {
    const tag = line[0];
    const value = line.slice(1);
    if (tag === "p") {
      pid = Number(value);
      name = null;
    } else if (tag === "c") {
      command = value;
    } else if (tag === "n") {
      name = value;
    } else if (tag === "T" && value.startsWith("ST=") && name !== null) {
      rows.push({ pid, command, name, state: value.slice(3) });
      name = null;
    }
  }
  return rows;
}

/**
 * `loopback` is allowed and still recorded: Tauri's IPC is a custom scheme
 * handled inside the webview and should not produce a socket at all, so a
 * loopback row is worth a reader's eye even though it is not egress.
 * `external` is the finding — link-local and LAN peers included, because the
 * claim under audit is "works locally without a network connection", not
 * "made no connection to the internet".
 */
function classify(row) {
  const peer = peerOf(row.name);
  if (peer === null) {
    if (row.state === "LISTEN") {
      const host = hostOf(row.name);
      return LOOPBACK.test(host ?? "") || host === "*"
        ? { kind: "listen", peer: null }
        : { kind: "external", peer: row.name };
    }
    return { kind: "idle", peer: null };
  }
  const host = hostOf(peer);
  if (host && LOOPBACK.test(host)) return { kind: "loopback", peer };
  return { kind: "external", peer };
}

/* ---------- probe 2: nettop, which cannot miss traffic ---------- */

/**
 * Cumulative bytes per monitored PID. A connection that opened and closed
 * between two `lsof` samples still moved these, which is the only reason the
 * interval above is allowed to be as coarse as it is.
 */
function byteCounters(pids) {
  if (pids.size === 0) return new Map();
  const args = ["-P", "-L", "1", "-x", "-J", "bytes_in,bytes_out"];
  for (const pid of pids) args.push("-p", String(pid));
  let out = "";
  try {
    out = execFileSync("nettop", args, {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch (error) {
    if (error.stdout) out = error.stdout;
    else return new Map();
  }

  const counters = new Map();
  for (const line of out.split("\n")) {
    const fields = line.split(",");
    if (fields.length < 3) continue;
    const label = fields[0];
    const dot = label.lastIndexOf(".");
    if (dot === -1) continue;
    const pid = Number(label.slice(dot + 1));
    if (!Number.isInteger(pid)) continue;
    const bytesIn = Number(fields[1]);
    const bytesOut = Number(fields[2]);
    if (!Number.isFinite(bytesIn) || !Number.isFinite(bytesOut)) continue;
    counters.set(pid, {
      process: label.slice(0, dot),
      bytesIn,
      bytesOut,
    });
  }
  return counters;
}

/* ---------- the control connection (C2) ---------- */

/**
 * A real socket carrying real bytes, made on purpose, by a process the probes
 * have been told to watch. If it does not come back, they are blind, and every
 * silence they reported is silence about nothing.
 *
 * It has to move data, not merely connect: `nettop` lists a process only once it
 * has network state, so a connection with no traffic on it cannot tell the
 * difference between a working counter and a broken one. This one exchanges a
 * few KB a second, which makes C3 an assertion about a number rather than about
 * a row existing.
 *
 * Loopback on a port the harness owns, so it works with the machine offline —
 * which is the half of the audit that matters most.
 */
async function stageControl() {
  const server = createServer((socket) => {
    socket.on("data", () => socket.write("x".repeat(4_096)));
    socket.on("error", () => {});
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  const port = server.address().port;

  const child = spawn(
    process.execPath,
    [
      "-e",
      `const net=require("node:net");const s=net.connect(${port},"127.0.0.1");` +
        `s.on("connect",()=>setInterval(()=>s.write("y".repeat(4096)),200));` +
        `s.on("data",()=>{});s.on("error",()=>{});` +
        `setTimeout(()=>{s.destroy();process.exit(0)},600000);`,
    ],
    { stdio: "ignore" },
  );

  // Give the connection time to exist before anything asks about it.
  await new Promise((done) => setTimeout(done, 400));
  return {
    pid: child.pid,
    port,
    stop: () => {
      child.kill("SIGKILL");
      server.close();
    },
  };
}

/* ---------- staging a project, as `startup-trace.mjs` does ---------- */

function projectIdentity(root) {
  const text = readFileSync(join(root, ".longclaw/longclaw.yaml"), "utf8");
  const field = (name) =>
    text.match(new RegExp(`^${name}:\\s*(.+)$`, "m"))?.[1]?.trim();
  return {
    id: field("id"),
    name: field("name"),
    key: field("key"),
    theme: field("theme") ?? "indigo",
  };
}

/**
 * A throwaway `HOME`, for the same reason the startup harness uses one: an
 * audit must not read, write, or reorder the real registry at
 * `~/Library/Application Support/io.longclaw.desktop`.
 */
function stage() {
  const home = mkdtempSync(join(tmpdir(), "longclaw-network-"));
  const project = join(home, "project");
  cpSync(PROJECT, project, { recursive: true });
  const appData = join(home, "Library/Application Support/io.longclaw.desktop");
  mkdirSync(appData, { recursive: true });
  writeFileSync(
    join(appData, "project-registry.json"),
    `${JSON.stringify([
      {
        ...projectIdentity(project),
        rootPath: project,
        starred: false,
        reachable: true,
        labels: {},
      },
    ])}\n`,
  );
  return home;
}

/* ---------- the session ---------- */

async function main() {
  if (!ATTACH && !existsSync(BINARY)) {
    console.error(
      `network-audit: no packaged app at\n  ${BINARY}\n` +
        `Run npm run build:app first, or pass --attach to audit an app you launched yourself.`,
    );
    process.exit(1);
  }
  mkdirSync(OUT, { recursive: true });

  const baselineTable = processTable();
  const baselineHelpers = webkitHelpers(baselineTable);

  let child = null;
  let appPid = null;
  let home = null;
  /** Set by the app's own probe once a board has painted with rows on it. */
  let rendered = false;

  if (ATTACH) {
    const running = baselineTable.filter((row) =>
      row.comm.endsWith("longclaw-desktop"),
    );
    if (running.length === 0) {
      console.error(
        "network-audit: --attach found no running longclaw-desktop process. Launch the app first.",
      );
      process.exit(1);
    }
    appPid = running[0].pid;
    console.log(
      `network-audit: attached to longclaw-desktop pid=${appPid}\n` +
        `  Attach mode cannot use the launch window to attribute WebKit helpers, so it\n` +
        `  monitors every helper on the machine. That is over-inclusive on purpose — it\n` +
        `  can raise another app's connection as a finding, but it cannot miss LongClaw's.\n` +
        `  Quit other browsers and Electron apps before trusting a finding here.`,
    );
  } else {
    home = stage();
    child = spawn(BINARY, {
      env: { ...process.env, HOME: home },
      stdio: ["ignore", "pipe", "pipe"],
    });
    appPid = child.pid;
    // The app's own startup probe, read for one bit: did a board ever paint?
    // An audit of an app that never rendered has exercised almost nothing, and
    // C5 below refuses to certify such a run rather than reporting its silence.
    //
    // Buffered and split by line, for the reason `startup-trace.mjs` documents:
    // `loadProject` sets the active project before it awaits `openProject`, so
    // the app paints once with no tickets and reports `rowCount: 0` before the
    // probe that matters. Both lines can arrive in one chunk, and a plain
    // `chunk.match()` returns only the first — which is the empty one. Reading
    // one match per chunk made this control fail on an app that had rendered.
    let rest = "";
    const watch = (chunk) => {
      const lines = (rest + chunk).split("\n");
      rest = lines.pop() ?? "";
      for (const line of lines) {
        const probe = line.match(/visible_ui_probe=(\{.*\})/);
        if (!probe) continue;
        try {
          if ((JSON.parse(probe[1]).rowCount ?? 0) > 0) rendered = true;
        } catch {
          /* not a probe line after all; the next one may be */
        }
      }
    };
    child.stdout.on("data", watch);
    child.stderr.on("data", watch);
    console.log(
      `network-audit: launched ${BINARY}\n  pid=${appPid}  HOME=${home}`,
    );
    // The helpers are spawned when the webview is created, not at exec.
    await new Promise((done) => setTimeout(done, 4_000));
  }

  const control = await stageControl();

  /** Everything the probes are pointed at, re-resolved as helpers come and go. */
  const attributed = new Map();
  const resolveSet = () => {
    const table = processTable();
    const own = descendants(appPid, table);
    const helpers = webkitHelpers(table);
    for (const [pid, role] of helpers) {
      if (ATTACH || !baselineHelpers.has(pid)) attributed.set(pid, role);
    }
    const monitored = new Set([...own]);
    for (const pid of attributed.keys())
      if (helpers.has(pid)) monitored.add(pid);
    return monitored;
  };

  const observed = new Map();
  const counters = new Map();
  const samples = { lsof: 0, nettop: 0 };
  let controlSeen = false;
  let controlBytes = 0;
  let step = 0;
  /** Only the steps the operator marked done — never assumed, never inferred. */
  const confirmed = [];

  const sample = () => {
    const monitored = resolveSet();
    const withControl = new Set([...monitored, control.pid]);

    for (const row of lsofSample(withControl)) {
      if (row.pid === control.pid) {
        if (String(row.name).includes(String(control.port))) controlSeen = true;
        continue; // the control is evidence about the probe, not about the app
      }
      const { kind, peer } = classify(row);
      const key = `${row.pid}|${row.name}|${row.state}`;
      if (!observed.has(key)) {
        observed.set(key, {
          pid: row.pid,
          process: row.command,
          name: row.name,
          state: row.state,
          kind,
          peer,
          step:
            DURATION_S > 0
              ? "unattended run; no step was being driven"
              : (STEPS[step] ?? "after the listed steps"),
        });
      }
    }
    samples.lsof += 1;

    for (const [pid, reading] of byteCounters(withControl)) {
      if (pid === control.pid) {
        // The control's own traffic proves the counter reads; it is never the
        // app's, so it is held apart from the findings the same way its socket
        // is held apart above.
        controlBytes = Math.max(
          controlBytes,
          reading.bytesIn + reading.bytesOut,
        );
        continue;
      }
      const previous = counters.get(pid);
      if (
        !previous ||
        reading.bytesIn + reading.bytesOut >
          previous.bytesIn + previous.bytesOut
      ) {
        counters.set(pid, reading);
      }
    }
    samples.nettop += 1;
  };

  // Interactive mode needs a terminal to mark steps from. Without one it would
  // block on a stdin that never arrives, holding the app open and looking like
  // a hang — which is exactly what running it through the repo-root wrapper
  // does, because npm eats a single `--` and `--duration` never reaches here.
  if (DURATION_S === 0 && !process.stdin.isTTY) {
    control.stop();
    if (child) child.kill("SIGTERM");
    console.error(
      `\nnetwork-audit: no terminal on stdin, so there is no way to mark the steps.\n` +
        `  Run it from a terminal, or give it --duration=<seconds> for an unattended run.\n` +
        `  Through the repo-root wrapper, npm eats the first --, so pass them twice:\n` +
        `    npm run audit:network -- -- --phase=offline\n` +
        `  or run it directly:\n` +
        `    npm --prefix apps/desktop run audit:network -- --phase=offline`,
    );
    process.exit(1);
  }

  sample();
  const ticker = setInterval(sample, INTERVAL_MS);

  if (DURATION_S > 0) {
    console.log(
      `\nSampling for ${DURATION_S}s, unattended. No step of the gate's list will be` +
        ` recorded as driven — for the release pass, run without --duration.\n`,
    );
    await new Promise((done) => setTimeout(done, DURATION_S * 1_000));
  } else {
    console.log(
      `\nDrive the app through the gate's steps. Press Enter to mark each one done,` +
        ` or type q then Enter to stop early.\n`,
    );
    const reader = createInterface({ input: process.stdin });
    for (const [index, name] of STEPS.entries()) {
      step = index;
      process.stdout.write(`  ${index + 1}/${STEPS.length}  ${name} … `);
      const line = await new Promise((done) => reader.once("line", done));
      if (String(line).trim().toLowerCase() === "q") {
        process.stdout.write("stopped\n");
        break;
      }
      process.stdout.write("recorded\n");
      confirmed.push(name);
    }
    step = STEPS.length;
    reader.close();
  }

  clearInterval(ticker);
  sample();

  /* ---------- self-test: inject a peer the run must catch ---------- */

  let selfTestRow = null;
  if (SELF_TEST) {
    // TEST-NET-3 (RFC 5737): routable-looking, never routed. Offline the
    // connect fails immediately and no socket lingers, so the row is staged
    // through the classifier instead and the report says which happened.
    const probe = classify({
      name: "192.168.1.10:52344->203.0.113.7:443",
      state: "SYN_SENT",
    });
    selfTestRow = { classified: probe.kind, peer: probe.peer };
    if (probe.kind === "external") {
      observed.set("self-test", {
        pid: appPid,
        process: "self-test",
        name: "192.168.1.10:52344->203.0.113.7:443",
        state: "SYN_SENT",
        kind: "external",
        peer: probe.peer,
        step: "injected by --self-test",
      });
    }
  }

  /* ---------- teardown, which is where C4 is decided ---------- */

  control.stop();
  const helperPids = [...attributed.keys()];
  let survivors = [];
  if (child) {
    child.kill("SIGTERM");
    await new Promise((done) => setTimeout(done, 3_000));
    const alive = webkitHelpers();
    survivors = helperPids.filter((pid) => alive.has(pid));
  }

  /* ---------- controls ---------- */

  const networkingHelper = [...attributed.values()].some((role) =>
    role.includes("Networking"),
  );
  const controls = [
    {
      id: "C1",
      name: "a WebKit Networking helper was attributed to the app",
      ok: networkingHelper,
      detail: helperPids.length
        ? `${helperPids.length} helper(s): ${[...attributed.values()].join(", ")}`
        : "no WebKit helper was attributed — the probe cannot see the webview",
    },
    {
      id: "C2",
      name: "the control connection was observed by the lsof probe",
      ok: controlSeen,
      detail: controlSeen
        ? `loopback control on port ${control.port} sampled`
        : "the sampler did not see a connection it was told to watch",
    },
    {
      id: "C3",
      name: "the byte-counter probe read real traffic",
      ok: controlBytes > 0,
      detail:
        controlBytes > 0
          ? `nettop counted ${controlBytes} control bytes, so a silent app is a reading rather than an empty probe`
          : "nettop reported nothing even for the control, which was moving KB a second — the counter probe is not working",
    },
    {
      id: "C4",
      name: "the attributed helpers died with the app",
      ok: ATTACH ? true : helperPids.length > 0 && survivors.length === 0,
      detail: ATTACH
        ? "not applicable in --attach mode; helpers were not attributed by launch window"
        : `${survivors.length} of ${helperPids.length} survived`,
    },
    {
      // The counterpart of the startup harness's refusal to certify a throttled
      // run. An agent shell has no foreground GUI session, so the window never
      // becomes visible and the app sits in WebKit's ~30s fallback having done
      // nothing — a run that would report perfect silence about an app that
      // never opened a project. That is not evidence, and it does not pass here.
      id: "C5",
      name: "the app painted a board during the run",
      ok: ATTACH ? true : rendered,
      detail: ATTACH
        ? "not applicable in --attach mode; the operator is driving a visible window"
        : rendered
          ? "the app's own visible-ui probe reported rows"
          : "no rendered board was reported — the app exercised nothing, so its silence is not evidence. Run this from a terminal with a foreground GUI session",
    },
  ];

  /* ---------- findings ---------- */

  const rows = [...observed.values()];
  const external = rows.filter((row) => row.kind === "external");
  const loopback = rows.filter((row) => row.kind === "loopback");
  const listening = rows.filter((row) => row.kind === "listen");

  const moved = [...counters.entries()]
    .filter(([, reading]) => reading.bytesIn + reading.bytesOut > 0)
    .map(([pid, reading]) => ({ pid, ...reading }));

  // The two probes disagreeing is itself the finding: counters moved while no
  // peer was ever sampled means the interval missed a connection, and a run
  // that reported "clean" off the back of that would be reporting its own
  // blind spot as evidence.
  const disagreement =
    moved.length > 0 && external.length === 0 && loopback.length === 0;

  const failedControls = controls.filter((entry) => !entry.ok);

  /* ---------- report ---------- */

  const record = {
    phase: PHASE,
    mode: ATTACH ? "attach" : "launched",
    binary: ATTACH ? null : BINARY,
    intervalMs: INTERVAL_MS,
    samples,
    rendered,
    stepsConfirmed: confirmed,
    stepsNotConfirmed: STEPS.filter((name) => !confirmed.includes(name)),
    helpers: Object.fromEntries(attributed),
    controls,
    connections: rows,
    counters: moved,
    controlBytes,
    selfTest: selfTestRow,
  };
  const file = join(OUT, `network-audit-${PHASE}.json`);
  writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);

  console.log(`\nRUNTIME-NETWORK-AUDIT phase=${PHASE} mode=${record.mode}`);
  console.log(
    `samples: ${samples.lsof} lsof, ${samples.nettop} nettop, every ${INTERVAL_MS}ms`,
  );
  console.log(
    `monitored: app pid ${appPid} plus ${helperPids.length} WebKit helper(s) — ${
      [...attributed.values()].join(", ") || "none"
    }\n`,
  );

  for (const entry of controls) {
    console.log(`${entry.id}  ${entry.ok ? "ok  " : "FAIL"}  ${entry.name}`);
    console.log(`          ${entry.detail}`);
  }

  console.log(
    `\nconnections: ${external.length} external, ${loopback.length} loopback, ${listening.length} listening`,
  );
  for (const row of [...external, ...loopback, ...listening]) {
    console.log(
      `  ${row.kind.padEnd(8)} ${row.process}.${row.pid}  ${row.name} (${row.state})`,
    );
    console.log(`           during: ${row.step}`);
  }
  if (moved.length === 0) {
    console.log(`byte counters: zero on every monitored process`);
  } else {
    for (const row of moved) {
      console.log(
        `  bytes    ${row.process}.${row.pid}  in=${row.bytesIn} out=${row.bytesOut}`,
      );
    }
  }

  console.log(`\nrecord: ${file}`);

  const findings = [];
  if (failedControls.length > 0) {
    findings.push(
      `${failedControls.length} control(s) failed: ${failedControls
        .map((entry) => entry.id)
        .join(", ")} — no absence claim in this run is trustworthy`,
    );
  }
  for (const row of external) {
    findings.push(`external connection: ${row.name} during ${row.step}`);
  }
  if (disagreement) {
    findings.push(
      `byte counters moved while no peer was ever sampled — the ${INTERVAL_MS}ms interval missed a connection; re-run with a smaller --interval`,
    );
  }

  if (SELF_TEST) {
    // Inverted, as `a11y:audit --self-test` is: a self-test run that comes back
    // clean means the probes are not looking at anything.
    if (findings.length === 0) {
      console.log(
        `\nSELF-TEST FAILED: an injected external peer produced no finding — the audit is blind`,
      );
      process.exitCode = 1;
    } else {
      console.log(
        `\nself-test: the injected peer was classified ${selfTestRow?.classified} and reported`,
      );
    }
    return;
  }

  if (findings.length > 0) {
    console.log(
      `\nRUNTIME NETWORK AUDIT FAILED (${findings.length}):\n  ${findings.join("\n  ")}`,
    );
    process.exitCode = 1;
  } else {
    // Named rather than described, and named from what the operator actually
    // confirmed — a run that swept seven steps it was never driven through is
    // the overstatement this whole file exists to avoid.
    console.log(
      confirmed.length > 0
        ? `\nNo non-IPC network connection observed. Controls C1-C5 passed, so the silence is` +
            ` evidence rather than an unread probe.\nDriven through: ${confirmed.join("; ")}.` +
            (confirmed.length < STEPS.length
              ? `\nNOT driven, and therefore not covered: ${STEPS.filter((name) => !confirmed.includes(name)).join("; ")}.`
              : "")
        : `\nNo non-IPC network connection observed, but no step of the gate's list was confirmed driven.` +
            ` This covers launch and idle only, and is not the release pass.`,
    );
  }
}

await main();
