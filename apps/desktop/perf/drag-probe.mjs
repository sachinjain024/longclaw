#!/usr/bin/env node
/**
 * Drives a real drag, in a real engine, and says what the page did about it.
 *
 * Every drag test in this repository is jsdom, which dispatches whatever it is
 * told to and so cannot answer the only question that matters when a drag does
 * nothing in the app: did the page refuse the drop, or did the page never get
 * asked? This drives Playwright's WebKit — the same engine as the WKWebView the
 * app runs in — with real mouse input over the perf build, and reports the
 * events the page actually saw.
 *
 * It exists because that distinction cost a day. LC-60 shipped a green drag
 * that had never worked in the app: Tauri's `dragDropEnabled` defaults to true,
 * so wry answers the WKWebView's dragging-destination messages itself and the
 * page never sees `dragover` at all. Nothing in `npm run verify` can see that,
 * and this can.
 *
 * Usage:
 *   node perf/drag-probe.mjs                  # the board
 *   node perf/drag-probe.mjs --surface=list   # the issue list
 *   node perf/drag-probe.mjs --order=manual   # Manual, where a rank is written
 *
 * Reading it: `dragover ACCEPTED` means a surface called `preventDefault`, so
 * the drop is allowed there. `refused` at a position the drop should be allowed
 * is the page's fault; no `dragover` at all is something between the page and
 * the engine, which in the app means the window's own drag handler.
 */

import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { webkit } from "playwright-core";

const here = dirname(fileURLToPath(import.meta.url));
const ORIGIN = "http://localhost:4173";

const argument = (name, fallback) => {
  const hit = process.argv.find((value) => value.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const SURFACE = argument("surface", "board");
const ORDER = argument("order", "priority");
const TICKETS = Number(argument("tickets", "40"));

/** What each surface calls its parts, and where another status can be found. */
const SURFACES = {
  board: {
    row: ".ticket-row",
    /** The element a drop into another status lands on. */
    target: ".board-column",
    lit: ".board-column.drop-target",
    line: ".drop-line",
    open: async () => {},
  },
  list: {
    row: ".list-row",
    target: ".list-group",
    lit: ".list-group.drop-target",
    line: ".list-drop-line",
    open: async (page) => {
      await page.click('button[aria-pressed="false"]:has-text("List")');
      await page.waitForSelector(".list-row", { timeout: 30_000 });
    },
  },
};

const UI = SURFACES[SURFACE];
if (!UI) throw new Error(`--surface must be board or list, not ${SURFACE}`);

/** Starts `vite preview` and resolves once it answers. */
async function serve() {
  const server = spawn(
    "npx",
    ["vite", "preview", "--config", resolve(here, "vite.config.ts")],
    { cwd: resolve(here, ".."), stdio: "ignore" },
  );
  const deadline = Date.now() + 30_000;
  for (;;) {
    try {
      const response = await fetch(ORIGIN);
      if (response.ok) return server;
    } catch {
      // Not up yet.
    }
    if (Date.now() > deadline) {
      server.kill();
      throw new Error("vite preview did not start");
    }
    await new Promise((wake) => setTimeout(wake, 200));
  }
}

const server = await serve();
const browser = await webkit.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

try {
  await page.goto(`${ORIGIN}/?tickets=${TICKETS}`, { waitUntil: "load" });
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

  // On `window`, in the bubble phase: by the time an event lands here every
  // handler the page has for it has already run, so `defaultPrevented` is the
  // page's answer rather than a guess at it.
  await page.evaluate(() => {
    window.__seen = [];
    for (const name of ["dragstart", "dragover", "drop", "dragend"]) {
      window.addEventListener(name, (event) => {
        window.__seen.push({
          name,
          accepted: event.defaultPrevented,
          y: Math.round(event.clientY ?? -1),
        });
      });
    }
  });

  const from = await page.locator(UI.row).first().boundingBox();
  const key = await page
    .locator(UI.row)
    .first()
    .getAttribute("data-ticket-key");
  const draggable = await page
    .locator(UI.row)
    .first()
    .getAttribute("draggable");

  // The nearest target that is not the one the row is already in. On the board
  // that is sideways; on the list it is down.
  const boxes = [];
  for (const target of await page.locator(UI.target).all()) {
    boxes.push(await target.boundingBox());
  }
  const landing = boxes.find(
    (box) =>
      box &&
      from &&
      (box.x > from.x + 100 || box.y > from.y + from.height + 80),
  );
  if (!from || !landing) throw new Error(`no ${SURFACE} row or target`);

  const to = {
    x: landing.x + Math.min(landing.width / 2, 120),
    y: landing.y + 80,
  };
  await page.mouse.move(from.x + 60, from.y + from.height / 2);
  await page.mouse.down();
  for (let step = 1; step <= 12; step += 1) {
    await page.mouse.move(
      from.x + 60 + ((to.x - from.x - 60) * step) / 12,
      from.y +
        from.height / 2 +
        ((to.y - from.y - from.height / 2) * step) / 12,
      { steps: 2 },
    );
    await page.waitForTimeout(40);
  }
  // `dragover` fires on its own every ~350ms while the pointer is still, so a
  // settle here is what makes the last position the one that is reported.
  await page.mouse.move(to.x + 1, to.y);
  await page.waitForTimeout(600);

  const painted = await page.evaluate(
    (selectors) => ({
      lit: document.querySelectorAll(selectors.lit).length,
      line: document.querySelectorAll(selectors.line).length,
    }),
    { lit: UI.lit, line: UI.line },
  );
  await page.mouse.up();
  await page.waitForTimeout(400);

  const seen = await page.evaluate(() => window.__seen);
  const overs = seen.filter((event) => event.name === "dragover");
  console.log(`surface=${SURFACE} order=${ORDER} row=${key}`);
  console.log(`draggable=${draggable}`);
  console.log(
    `dragstart=${seen.some((e) => e.name === "dragstart")} ` +
      `dragover=${overs.length} accepted=${overs.filter((e) => e.accepted).length} ` +
      `drop=${seen.some((e) => e.name === "drop" && e.accepted)}`,
  );
  console.log(`while hanging over the target: ${JSON.stringify(painted)}`);
  if (overs.length === 0) {
    console.log(
      "the page never saw a dragover — something between it and the engine took the drag",
    );
  } else if (!overs.some((event) => event.accepted)) {
    console.log("the page refused every position it was asked about");
  } else {
    console.log("the page accepted the drop");
  }
} finally {
  await browser.close();
  server.kill();
}
