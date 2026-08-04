#!/usr/bin/env node
/**
 * The Step 4 startup budgets, measured against the packaged app.
 *
 * The app already carries the probe this needs, and has since Step 4: `run()`
 * stamps `PROCESS_STARTED` before the Tauri builder, the board reports
 * `reportVisibleUi` from inside a `requestAnimationFrame` callback once it has
 * rows, and `report_visible_ui` prints the elapsed time as
 * `LONGCLAW_LOCAL_DIAGNOSTIC startup_to_rendered_ms` (`src-tauri/src/lib.rs`).
 * `LONGCLAW_EXIT_AFTER_FIRST_PROBE` exists so the app quits the moment it has
 * reported. Nothing here is new instrumentation — this only drives it and reads
 * the number, which is the one thing Step 16b never did.
 *
 * It measures the **packaged binary**, not `npm run dev`, because the budget is
 * on the release bundle. `LONGCLAW_DEV_PROJECT` is `#[cfg(debug_assertions)]`
 * and therefore useless here, so a project is put in front of the app the way a
 * user's would be: a registry in the app-data directory. `HOME` is redirected to
 * a throwaway directory for the run, so the measurement can never read, write,
 * or reorder the real registry at
 * `~/Library/Application Support/io.longclaw.desktop`, and the project itself is
 * a copy — `fixtures/representative-project` is asserted to round-trip
 * byte-for-byte and must not be launched against in place.
 *
 * **On cold and warm.** Warm is what repeated launches measure and it is what
 * this reports. A true cold launch needs the page cache dropped — `sudo purge`,
 * or a reboot — which this cannot do unprivileged and cannot detect afterwards.
 * So the first launch is reported separately and, by default, labelled for what
 * it is: the first of this run, not a cold-boot number. Do not file it as one.
 *
 * `--cold` says you have just dropped the cache and that the first sample is
 * therefore a real cold launch. It is an assertion by the operator, not a
 * measurement — the harness has no way to check it, and labels the number as
 * asserted so a reader of the record knows which it is. Only the first sample
 * of such a run is cold; every launch after it has paged the binary back in.
 *
 * Usage, from `apps/desktop` — the repo-root wrapper is
 * `npm --prefix apps/desktop run perf:startup`, and npm swallows arguments
 * passed through it, so a flag given at the root is silently ignored rather
 * than rejected:
 *   npm run perf:startup                  # 5 launches against the small fixture
 *   npm run perf:startup -- --launches=9
 *   npm run perf:startup -- --project=/path/to/a/real/project
 *   sudo purge && npm run perf:startup -- --cold   # the cold budget
 */

import { spawn } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, "..");
const repoRoot = resolve(here, "../../..");

const BINARY = join(
  appRoot,
  "src-tauri/target/release/bundle/macos/LongClaw.app/Contents/MacOS/longclaw-desktop",
);

/** Step 4 budgets (`docs/architecture-spike-report.md` § Performance budgets). */
const COLD_BUDGET_MS = 1_500;
const WARM_BUDGET_MS = 750;

const argument = (name, fallback) => {
  const hit = process.argv.find((value) => value.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const LAUNCHES = Number(argument("launches", "5"));
/** The operator asserting they dropped the page cache immediately before this run. */
const COLD = process.argv.includes("--cold");
const PROJECT = resolve(
  argument("project", join(repoRoot, "fixtures/representative-project")),
);

/** The identity the registry row has to agree with, from the project's own file. */
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
 * A throwaway `HOME` holding one registered project, so the app opens straight
 * onto a board and the probe has rows to report.
 */
function stage() {
  const home = mkdtempSync(join(tmpdir(), "longclaw-startup-"));
  const project = join(home, "project");
  cpSync(PROJECT, project, { recursive: true });

  const appData = join(home, "Library/Application Support/io.longclaw.desktop");
  mkdirSync(appData, { recursive: true });
  const identity = projectIdentity(project);
  writeFileSync(
    join(appData, "project-registry.json"),
    `${JSON.stringify([{ ...identity, rootPath: project, starred: false, reachable: true, labels: {} }])}\n`,
  );
  return home;
}

/**
 * One launch, resolved at the first frame that actually had rows on it.
 *
 * **Why this does not use `LONGCLAW_EXIT_AFTER_FIRST_PROBE`, which exists for
 * exactly this job.** `loadProject` sets the active project id before it awaits
 * `openProject` (`src/App.tsx:353`), so React can paint once with a project
 * selected and no tickets yet. The probe fires on that frame, reports
 * `rowCount: 0`, and the exit-after-first-probe affordance takes the app down
 * on it — yielding a startup number for an empty board. It is a race, so it
 * does not happen every launch, which is the worst way for it to behave: a run
 * of five can look clean and one number in it be for a board that had nothing
 * on it.
 *
 * So the app is left running and its stdout read until a probe reports rows,
 * and the `startup_to_rendered_ms` that follows *that* probe is the sample.
 * First interactive paint means paint with the project on it.
 */
function launch(home) {
  return new Promise((done, fail) => {
    const child = spawn(BINARY, {
      env: { ...process.env, HOME: home },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let pending = null;
    let rest = "";
    let settled = false;

    const finish = (outcome, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill("SIGTERM");
      outcome(value);
    };
    const timer = setTimeout(
      () =>
        finish(
          fail,
          new Error("no probe reporting rows within 60s of launching the app"),
        ),
      60_000,
    );

    const read = (chunk) => {
      const lines = (rest + chunk).split("\n");
      rest = lines.pop() ?? "";
      for (const line of lines) {
        const probe = line.match(/visible_ui_probe=(\{.*\})/);
        if (probe) {
          const rows = JSON.parse(probe[1]).rowCount ?? 0;
          if (rows > 0 && pending === null) pending = rows;
          continue;
        }
        const elapsed = line.match(/startup_to_rendered_ms=([\d.]+)/);
        if (elapsed && pending !== null) {
          finish(done, { ms: Number(elapsed[1]), rows: pending });
          return;
        }
      }
    };

    child.stdout.on("data", read);
    child.stderr.on("data", read);
    child.on("error", (error) => finish(fail, error));
    child.on("close", () =>
      finish(
        fail,
        new Error("the app exited before reporting a frame with rows on it"),
      ),
    );
  });
}

const percentile = (sorted, fraction) =>
  sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];

async function main() {
  if (!existsSync(BINARY)) {
    console.error(
      `startup-trace: no packaged app at\n  ${BINARY}\nRun npm run build:app first — this budget is on the release bundle.`,
    );
    process.exit(1);
  }

  const home = stage();
  const runs = [];
  try {
    for (let index = 0; index < LAUNCHES; index += 1) {
      runs.push(await launch(home));
    }
  } finally {
    rmSync(home, { recursive: true, force: true });
  }

  const samples = runs.map((run) => run.ms);
  const [first, ...warm] = samples;
  const sorted = [...warm].sort((left, right) => left - right);
  const round = (value) => Math.round(value * 100) / 100;

  const build = statSync(BINARY).mtime.toISOString();
  console.log(
    `\nPERF-STARTUP project=${PROJECT} rows_rendered=${runs[0].rows} launches=${samples.length} bundle_built=${build}`,
  );
  console.log(`samples ms: ${samples.map(round).join(", ")}`);
  console.log(
    COLD
      ? `cold: ${round(first)} ms  (first launch, page cache asserted dropped via --cold; budget ≤ ${COLD_BUDGET_MS}ms)`
      : `first launch of this run: ${round(first)} ms  (NOT a cold-boot number — see the docblock)`,
  );
  if (warm.length > 0) {
    console.log(
      `warm: p50 ${round(percentile(sorted, 0.5))} ms, p95 ${round(percentile(sorted, 0.95))} ms, min ${round(sorted[0])} ms, max ${round(sorted[sorted.length - 1])} ms`,
    );
  }

  const warmWorst = sorted[sorted.length - 1] ?? first;
  const over = [];
  if (warmWorst > WARM_BUDGET_MS)
    over.push(`warm ${round(warmWorst)}ms > ${WARM_BUDGET_MS}ms`);
  if (first > COLD_BUDGET_MS)
    over.push(`first launch ${round(first)}ms > ${COLD_BUDGET_MS}ms`);

  if (over.length > 0) {
    console.log(`\nOVER BUDGET: ${over.join("; ")}`);
    process.exitCode = 1;
  } else {
    console.log(
      COLD
        ? `\nwithin budget: cold ≤ ${COLD_BUDGET_MS}ms, warm ≤ ${WARM_BUDGET_MS}ms`
        : `\nwithin budget: warm ≤ ${WARM_BUDGET_MS}ms, first launch ≤ ${COLD_BUDGET_MS}ms (cold budget, measured warm — an upper bound only)`,
    );
  }
}

await main();
