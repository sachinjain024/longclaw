#!/usr/bin/env node
/**
 * The 5,000-ticket WebKit trace the risk register asks for by name.
 *
 * Measures input → paint for the three interactions plan 07 lists — keyboard
 * navigation down the surface, scrolling it, and one external write landing while
 * it is open — and reports p50 and p95 for each, because a single median is not
 * evidence for a p95 budget.
 *
 * It drives both surfaces. The board is six independent column scrollers; the
 * issue list (V0-14) is one scroller of sticky groups, and it is the surface that
 * puts every ticket in the project on one axis, so it is the one the budget is
 * hardest on. `--surface` picks; everything else about the run is identical, which
 * is the point — the two numbers are comparable because nothing but the surface
 * changed.
 *
 * The clock is entirely inside the page. Each sample starts at the `timeStamp`
 * the browser stamped on the trusted input event and ends in a timer scheduled
 * from inside a `requestAnimationFrame` callback: rAF still runs *before* the
 * paint, so the timer is the first thing that can observe the pixels. This is the
 * same animation-frame boundary the app's own `reportVisibleUi` probe reports on,
 * and the harness checks the probe agrees about what was painted.
 *
 * Usage:
 *   npm run perf:board                 # ArrowDown, the board's own navigation
 *   npm run perf:list                  # the same three, on the issue list
 *   npm run perf:board -- --nav=Tab    # the pre-roving-focus baseline
 */

import { webkit } from "playwright-core";

import { startPreview } from "./preview-server.mjs";

/** This run's own server, up before anything is driven (`preview-server.mjs`). */
let preview;
/** Matches `TICKETS` in `perf/fixture.ts` and `src-tauri/tests/performance.rs`. */
const TICKETS = 5_000;
const NAV_SAMPLES = 150;
/** The first presses pay for lazily compiled code the product pays once. */
const WARM_UP = 5;
const SCROLL_STEP_PX = 400;
const MAX_SCROLL_STEPS = 200;
const WRITE_SAMPLES = 40;

const argument = (name, fallback) => {
  const hit = process.argv.find((value) => value.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const NAV_KEY = argument("nav", "ArrowDown");
/** `--only=scroll,write` narrows a run while an interaction is being built. */
const ONLY = argument("only", "keyboard,scroll,filter,write").split(",");
/**
 * The query the filter trace types (V0-15). The default is the worst shape there
 * is against `perf/fixture.ts`: every ticket is titled `Searchable storage ticket
 * N`, so the first characters match all 5,000 rows — a full pass over the project
 * that removes nothing — and only the last few narrow it to one.
 */
const FILTER_QUERY = argument("filter", "ticket 4999");
/** How many times the query is typed in and deleted again. */
const FILTER_CYCLES = 3;
/** `--tickets=200` shows whether a number scales with the board or not. */
const BOARD_SIZE = Number(argument("tickets", String(TICKETS)));
/** The small-board control every full-board number is judged against; 0 skips it. */
const FLOOR_SIZE = Number(argument("floor", "600"));
/** Which surface to drive: `board` or `list`. */
const SURFACE = argument("surface", "board");
/**
 * Which order the surface is in (ADR 0003). Manual is the heavier comparator —
 * it falls through to priority for every card with no rank, and the fixture has
 * no ranks — so `--order=manual` is the one to run after touching the sort.
 */
const ORDER = argument("order", "priority");

/**
 * What each surface calls its parts. Only the selectors differ — the scenarios
 * below are written once and run against whichever surface is up, so a number
 * from one is comparable with a number from the other.
 */
const SURFACES = {
  board: {
    label: "board",
    row: ".ticket-row",
    scroller: ".board-stack",
    /** The heading whose count says how far navigation can travel. */
    count: ".board-column h3 span",
    lane: ".board-column",
    /**
     * The row an external write lands on. It has to be one the surface is
     * already drawing, or the measurement would be of a write the surface is
     * free to leave unrendered. Each column scrolls on its own, so the first
     * card of the In Review column is always inside the window.
     */
    write: { key: "PF-3", id: "perf-3", status: "in_review" },
    open: async () => {},
  },
  list: {
    label: "list",
    row: ".list-row",
    scroller: ".issue-list",
    count: ".list-group-count",
    lane: ".issue-list",
    /**
     * One scroller, so "already drawn" means the very top of it: the first row
     * of the first group. Backlog leads the status order and `PF-6` is its
     * lowest key — the fixture spreads statuses round-robin from `PF-1`.
     */
    write: { key: "PF-6", id: "perf-6", status: "backlog" },
    open: async (page) => {
      await page.click('button[aria-pressed="false"]:has-text("List")');
      await page.waitForSelector(".list-row", { timeout: 30_000 });
    },
  },
};

const UI = SURFACES[SURFACE];
if (!UI) throw new Error(`--surface must be board or list, not ${SURFACE}`);

function percentile(samples, fraction) {
  const sorted = [...samples].sort((a, b) => a - b);
  const rank = Math.ceil(fraction * sorted.length) - 1;
  return sorted[Math.min(Math.max(rank, 0), sorted.length - 1)];
}

const round = (value) => Math.round(value * 100) / 100;

function summarise(name, samples) {
  return {
    name,
    samples: samples.length,
    p50: round(percentile(samples, 0.5)),
    p95: round(percentile(samples, 0.95)),
    max: round(Math.max(...samples)),
  };
}

/**
 * Installs a one-shot listener that times this input through to the first frame
 * painted after it. Must be armed before the input is dispatched.
 */
async function arm(page, eventName) {
  await page.evaluate((name) => {
    window.__measure = new Promise((settle) => {
      window.addEventListener(
        name,
        (event) => {
          const observed = performance.now();
          let started = event.timeStamp;
          // Some engines stamp epoch milliseconds rather than page time.
          if (started > 1e12) started -= performance.timeOrigin;
          if (!(started >= 0) || started > observed + 1) started = observed;
          requestAnimationFrame(() => {
            setTimeout(() => settle(performance.now() - started), 0);
          });
        },
        { once: true, capture: true },
      );
    });
  }, eventName);
}

const collect = (page) => page.evaluate(() => window.__measure);

/** Every scenario starts at the top, whatever the one before it left behind. */
async function rewind(page) {
  await page.evaluate((selector) => {
    for (const stack of document.querySelectorAll(selector)) {
      stack.scrollTop = 0;
    }
    window.scrollTo(0, 0);
  }, UI.scroller);
  await page.waitForTimeout(100);
}

async function focusedKey(page) {
  return page.evaluate(
    () => document.activeElement?.getAttribute("data-ticket-key") ?? null,
  );
}

/** Keyboard navigation down the surface, one sample per press. */
async function traceKeyboard(page) {
  await rewind(page);
  const started = await page.evaluate((selector) => {
    const first = document.querySelector(selector);
    if (!(first instanceof HTMLElement)) return null;
    first.focus();
    return first.getAttribute("data-ticket-key");
  }, UI.row);
  if (!started) throw new Error(`the ${UI.label} rendered no rows to navigate`);

  // Never more presses than the first group holds; running off the end would read
  // as a broken run rather than as the end of the group.
  const lane = await page.evaluate(
    (selector) => Number(document.querySelector(selector)?.textContent ?? 0),
    UI.count,
  );
  const presses = Math.min(NAV_SAMPLES, lane - 1);

  const samples = [];
  let previous = started;
  for (let index = 0; index < presses; index += 1) {
    await arm(page, "keydown");
    await page.keyboard.press(NAV_KEY);
    const elapsed = await collect(page);
    const landed = await focusedKey(page);
    if (landed === null || landed === previous) {
      throw new Error(
        `${NAV_KEY} did not move focus off ${previous} — nothing was measured`,
      );
    }
    previous = landed;
    if (index >= WARM_UP) samples.push(elapsed);
  }
  return samples;
}

/** Scrolling the surface, one sample per wheel notch. */
async function traceScroll(page) {
  await rewind(page);
  const box = await page.evaluate((selector) => {
    const lane = document.querySelector(selector);
    if (!lane) return null;
    const rect = lane.getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  }, UI.lane);
  if (!box) throw new Error(`the ${UI.label} rendered nothing to scroll`);
  await page.mouse.move(
    Math.min(box.x, 1_200),
    Math.min(Math.max(box.y, 40), 700),
  );

  const offset = () =>
    page.evaluate((selector) => {
      const stack = document.querySelector(selector);
      return stack ? stack.scrollTop : window.scrollY;
    }, UI.scroller);

  const samples = [];
  let last = await offset();
  for (let step = 0; step < MAX_SCROLL_STEPS; step += 1) {
    await arm(page, "wheel");
    await page.mouse.wheel(0, SCROLL_STEP_PX);
    samples.push(await collect(page));
    const now = await offset();
    if (now === last && step > 2) break;
    last = now;
  }
  if (samples.length < 10) {
    throw new Error(
      `the ${UI.label} only produced ${samples.length} scroll frames`,
    );
  }
  return samples;
}

/**
 * Typing in the header filter, one sample per keystroke (V0-15).
 *
 * This is the interaction the filter puts at risk: every keystroke re-tests
 * every ticket in the project and re-lays out the surface underneath. The query
 * is typed in and deleted again, so the run covers both the narrowing frames and
 * the widening ones — restoring 5,000 rows is the heavier half.
 */
async function traceFilter(page) {
  await rewind(page);
  const field = await page.$(".filter-field");
  if (!field) throw new Error("the content header rendered no filter field");
  await field.click();

  const samples = [];
  for (let cycle = 0; cycle < FILTER_CYCLES; cycle += 1) {
    for (const character of FILTER_QUERY) {
      await arm(page, "keydown");
      await page.keyboard.type(character);
      samples.push(await collect(page));
    }
    for (let index = 0; index < FILTER_QUERY.length; index += 1) {
      await arm(page, "keydown");
      await page.keyboard.press("Backspace");
      samples.push(await collect(page));
    }
  }
  if ((await page.inputValue(".filter-field")) !== "") {
    throw new Error("the filter field did not come back empty");
  }
  await page.waitForSelector(UI.row, { timeout: 30_000 });
  return samples.slice(WARM_UP);
}

/** One external write landing while the surface is open, repeated. */
async function traceExternalWrite(page) {
  await rewind(page);
  const samples = [];
  for (let index = 0; index < WRITE_SAMPLES; index += 1) {
    const result = await page.evaluate(
      async ({ revision, target }) => {
        const bridge = window.__longclawPerf;
        const before = bridge.probes.length;
        const title = `External write ${revision}`;
        const envelope = {
          contractVersion: 1,
          sequence: revision,
          projectId: "019c8ca0-0000-7000-8000-0000000000ff",
          emittedAt: "2026-07-31T00:00:00Z",
          event: {
            type: "ticketChanged",
            data: {
              source: "external",
              coalescedEvents: 1,
              detectedInMs: 1,
              attribution: {
                id: `evt_${revision}`,
                kind: "update",
                occurredAt: "2026-07-31T00:00:00Z",
                actor: { type: "agent", name: "Claude Code" },
              },
              ticket: {
                state: "indexed",
                key: target.key,
                id: target.id,
                title,
                // Unchanged, so the write repaints a row rather than moving it to
                // another column or group.
                status: target.status,
                priority: "none",
                labels: ["storage"],
                createdAt: "2026-07-29T00:00:00Z",
                updatedAt: "2026-07-31T00:00:00Z",
                checkedCount: 1,
                checklistCount: 1,
                commentCount: 0,
                attachmentCount: 0,
                contentHash: `hash-${target.key}-${revision}`,
                relativePath: `.longclaw/tickets/${target.key}/ticket.md`,
              },
            },
          },
        };

        const startedAt = performance.now();
        bridge.emit(envelope);
        const paintedAt = await bridge.afterPaint();
        const probe = bridge.probes[bridge.probes.length - 1];
        return {
          elapsed: paintedAt - startedAt,
          // The app's own probe has to agree that the new title is on screen.
          probed: bridge.probes.length > before,
          sawTitle: probe?.probe.rowTitles.includes(title) ?? false,
          rowCount: probe?.probe.rowCount ?? 0,
        };
      },
      { revision: index + 1, target: UI.write },
    );

    if (!result.probed || !result.sawTitle) {
      throw new Error(
        `the visible-UI probe did not report the written row (probe fired: ${result.probed})`,
      );
    }
    samples.push(result.elapsed);
  }
  return samples;
}

const SCENARIOS = [
  ["keyboard", (key) => `keyboard ${key} down the ${UI.label}`, traceKeyboard],
  ["scroll", () => `scroll the ${UI.label}`, traceScroll],
  ["filter", () => `filter the ${UI.label}`, traceFilter],
  ["write", () => "external write → paint", traceExternalWrite],
];

/**
 * The page's actual animation-frame interval, as a median over 30 frames.
 *
 * Every sample this harness reports ends in a timer scheduled from inside a
 * `requestAnimationFrame` callback, so the frame interval is the floor of the
 * measurement — and the Step 4 budgets were set against 16.7 ms at 60 Hz
 * (`docs/architecture-spike-report.md` § Performance budgets, which says so:
 * "16.7 ms at 60 Hz is the least an input → paint measurement can report").
 *
 * A machine that throttles rAF halves that cadence and doubles every number
 * below without a line of product code changing. macOS Low Power Mode does
 * exactly this, and it is why the Step 16b candidate recorded interaction p95s
 * at roughly twice Step 16a's three days earlier, on an untouched board. So the
 * cadence is measured and reported: these numbers must never be read without it.
 */
async function frameIntervalMs(page) {
  return page.evaluate(async () => {
    const stamps = [];
    await new Promise((done) => {
      const tick = (at) => {
        stamps.push(at);
        if (stamps.length <= 30) requestAnimationFrame(tick);
        else done();
      };
      requestAnimationFrame(tick);
    });
    const deltas = [];
    for (let index = 1; index < stamps.length; index += 1) {
      deltas.push(stamps[index] - stamps[index - 1]);
    }
    deltas.sort((left, right) => left - right);
    return Math.round(deltas[Math.floor(deltas.length / 2)] * 10) / 10;
  });
}

async function measure(browser, size) {
  const page = await browser.newPage({
    viewport: { width: 1_440, height: 900 },
  });
  const openedAt = Date.now();
  await page.goto(`${preview.origin}/?tickets=${size}`, { waitUntil: "load" });
  await page.waitForFunction(
    () => document.querySelectorAll("[data-ticket-key]").length > 0,
    undefined,
    { timeout: 60_000 },
  );
  await UI.open(page);
  if (ORDER === "manual") {
    await page.click('button[aria-label^="Order:"]');
    await page.click('[role="menuitemradio"]:has-text("Manual")');
    await page.waitForSelector(UI.row, { timeout: 30_000 });
  }
  const firstPaintMs = Date.now() - openedAt;
  const renderedRows = await page.evaluate(
    (selector) => document.querySelectorAll(selector).length,
    UI.row,
  );

  const frameMs = await frameIntervalMs(page);

  const rows = [];
  for (const [id, name, trace] of SCENARIOS) {
    if (ONLY.includes(id))
      rows.push(summarise(name(NAV_KEY), await trace(page)));
  }
  const engine = await page.evaluate(() => navigator.userAgent);
  await page.close();
  return { size, firstPaintMs, renderedRows, frameMs, rows, engine };
}

function table(rows, floor) {
  const header = ["interaction", "n", "p50 ms", "p95 ms", "max ms"];
  if (floor) header.push("floor p50", "floor p95");
  return [
    header.join("\t"),
    ...rows.map((row, index) => {
      const cells = [row.name, row.samples, row.p50, row.p95, row.max];
      if (floor) cells.push(floor[index]?.p50 ?? "-", floor[index]?.p95 ?? "-");
      return cells.join("\t");
    }),
  ].join("\n");
}

async function main() {
  preview = await startPreview();
  const browser = await webkit.launch();
  try {
    // A board small enough to have no work to do, measured through the same code
    // on the same machine. It is the floor the full board is judged against: one
    // frame is 16.7 ms at 60 Hz, so no input → paint measurement can come in
    // under the 16 ms p50 line, and the question worth asking is whether 5,000
    // tickets cost anything the small board does not.
    //
    // Note what this floor cannot tell you on its own. When the full board and
    // the floor agree exactly, the frame is the measurement and the board costs
    // nothing — which reads as a pass, and is one. But if the frame itself has
    // changed, both numbers move together and still agree, so the comparison
    // stays green while every number in it has shifted. That is what
    // `frameIntervalMs` is for, and why the check below is on the cadence rather
    // than on the gap between these two runs.
    const floor = FLOOR_SIZE > 0 ? await measure(browser, FLOOR_SIZE) : null;
    const full = await measure(browser, BOARD_SIZE);

    console.log(
      `\nPERF-UI surface=${UI.label} order=${ORDER} tickets=${full.size} rendered_rows=${full.renderedRows} first_paint_ms=${full.firstPaintMs} frame_ms=${full.frameMs} nav_key=${NAV_KEY}`,
    );
    if (floor) {
      console.log(
        `PERF-UI-FLOOR surface=${UI.label} tickets=${floor.size} rendered_rows=${floor.renderedRows} first_paint_ms=${floor.firstPaintMs}`,
      );
    }
    console.log(`engine=${full.engine}\n`);
    console.log(table(full.rows, floor?.rows));
    console.log(`\n${JSON.stringify({ full, floor })}\n`);

    /** The cadence the Step 4 budgets were measured at: 60 Hz, one frame 16.7 ms. */
    const BUDGET_FRAME_MS = 16.7;
    /** Enough to cover jitter in the median, not enough to cover a halved rate. */
    const FRAME_SLACK_MS = 2;
    const comparable =
      Math.abs(full.frameMs - BUDGET_FRAME_MS) <= FRAME_SLACK_MS;
    if (!comparable) {
      const hz = (1000 / full.frameMs).toFixed(1);
      console.log(
        `NOT COMPARABLE: animation frames are ${full.frameMs}ms (${hz} Hz), not the ` +
          `${BUDGET_FRAME_MS}ms (60 Hz) the Step 4 budgets were set at. Every number above is\n` +
          `quantized to the frame, so this run is not evidence for or against a budget.\n` +
          `On macOS check Low Power Mode first: pmset -g | grep lowpowermode`,
      );
      process.exitCode = 1;
    }

    /** How much slower than the floor the median may run and still be noise. */
    const SLACK_MS = 4;
    const over = full.rows.filter((row, index) => {
      if (row.p95 > 50) return true;
      const base = floor?.rows[index];
      return base ? row.p50 > base.p50 + SLACK_MS : row.p50 > 16;
    });
    if (over.length > 0) {
      console.log(
        `OVER BUDGET (≤50ms p95; median no worse than the ${FLOOR_SIZE}-ticket floor + ${SLACK_MS}ms): ${over
          .map((row) => row.name)
          .join(", ")}`,
      );
      process.exitCode = 1;
    } else if (comparable) {
      console.log(
        `within budget: every p95 ≤ 50ms, and every median within ${SLACK_MS}ms of the ${FLOOR_SIZE}-ticket floor`,
      );
    }
  } finally {
    await browser.close();
    await preview.close();
  }
}

await main();
