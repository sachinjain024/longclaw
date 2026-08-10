#!/usr/bin/env node
/**
 * Asks whether the checklist's add-row is still under the human's eye after they
 * append an item — the question LC-193 was filed as, and one nothing in
 * `npm run verify` can answer.
 *
 * The report was "after entering one checklist item, the next input row isn't
 * focussed". It is: `TicketPanel.test.tsx` has asserted `document.activeElement`
 * on that field since LC-106, and it passes. What the field loses is not focus
 * but the screen. The add-row is the checklist's *next row* (`GhostBox`), so an
 * appended item lands exactly where the field was standing and the field moves
 * one row down inside a pane that does not scroll with it. From a panel scrolled
 * so the field sits near the bottom edge — where anyone who has just scrolled the
 * checklist into view is typing from — one Enter puts it under the edge. Focus is
 * intact, the caret is in it, and what the human is looking at is the row they
 * just made. That is a statement about boxes in a scroller, so a layout engine
 * has to answer it: jsdom lays nothing out, and the a11y audit cannot ask it
 * either, because the position it needs is one only a *scroll* produces and there
 * is not a pointer anywhere in that file.
 *
 * So this drives WebKit — the engine the packaged app's WKWebView is — where the
 * reporter was: it opens the panel, types a checklist long enough to scroll,
 * puts the pane where the add-row is the last thing in it, and appends two items
 * with real key input. Both add-rows are checked, because the panel's and the
 * create surface's are the same object and a box drawn twice can come to differ
 * from itself.
 *
 * What it finds without the fix is worth stating, because it is why the report
 * says *focussed*: only the frame after Enter is wrong. WebKit follows the caret
 * on the next keystroke, so by the time a human has typed the next item the field
 * is back — the surface having dropped them and picked them up again, which reads
 * as nothing to do with scrolling at all.
 *
 * The oracle is `keyboard-focus-map.md:63` — "Append item, keep focus in the
 * field" — read as the promise it is rather than as a property of
 * `document.activeElement`: a field that keeps focus under the bottom edge keeps
 * the letter of that line and none of it.
 *
 * **It refuses rather than reports when it cannot reach the position.** A pane
 * with nothing to scroll cannot push anything under its edge, so a green from one
 * would be a green about nothing — the failure LC-190 spent a run on.
 *
 * Usage:
 *   npm run probe:checklist
 *   node perf/checklist-probe.mjs --heights=620
 *   npm run probe:checklist -- --self-test   # take the fix away, expect red
 *
 * `--self-test` neutralises `scrollIntoView` in the page, which is precisely the
 * pre-fix app, and expects the run to go red. A probe that stays green under it
 * is not measuring what it claims to.
 */

import { webkit } from "playwright-core";

import { startPreview } from "./preview-server.mjs";

/** This run's own server, up before anything is driven (`preview-server.mjs`). */
let preview;

const argument = (name, fallback) => {
  const hit = process.argv.find((value) => value.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

/**
 * The window heights the panel is actually used at: 900 is the matrix's window,
 * 780 is `tauri.conf.json`'s launch height, 620 is its `minHeight` — the app
 * cannot be made shorter — and 450 is the CSS viewport a 200% display scale
 * leaves of a 900px window, which is the shortest pane a human can be looking at.
 */
const HEIGHTS = argument("heights", "900,780,620,450").split(",").map(Number);
/** Enough for a board that scrolls, few enough that a run is seconds. */
const TICKETS = Number(argument("tickets", "40"));
const SELF_TEST = process.argv.includes("--self-test");
const WIDTH = 1_440;

/** The two surfaces that draw an add-row. Both, always: they are one object. */
const SURFACES = ["panel", "create"];

/* ---------- reporting ---------- */

const results = [];
let current;
/** How many sizes could actually be driven into the position under test. */
let measured = 0;

function run(name) {
  current = { name, checks: [] };
  results.push(current);
}

function check(name, ok, detail) {
  current.checks.push({ name, ok: Boolean(ok), detail });
  return Boolean(ok);
}

/* ---------- harness plumbing ---------- */

const settle = (page) => page.waitForTimeout(160);

/**
 * Where the add-row is, and whether the pane that scrolls it can see it.
 *
 * `inside` carries half a pixel of tolerance: a field flush with the edge is on
 * screen, and sub-pixel layout will not say so exactly.
 */
const geometry = (page) =>
  page.evaluate(() => {
    const field = document.querySelector(".checklist-add-field");
    const pane = field?.closest(".ticket-panel");
    if (!field || !pane) return { present: false };
    const box = field.getBoundingClientRect();
    const edge = pane.getBoundingClientRect();
    return {
      present: true,
      focused: document.activeElement === field,
      scrollable: pane.scrollHeight > pane.clientHeight + 1,
      // How much room is left under the field. A row is ~33px, so anything less
      // than that is a field the next append will push under the edge.
      slack: Math.round(edge.bottom - box.bottom),
      inside: box.top >= edge.top - 0.5 && box.bottom <= edge.bottom + 0.5,
      rows: document.querySelectorAll(".checklist-row").length,
    };
  });

/**
 * Puts the pane where the reporter had it: the add-row the last thing in it.
 *
 * The scroller is moved directly rather than with the wheel. Two reasons, and
 * the first is the honest one — headless WebKit aborts the whole browser on a
 * `NSTextInputContext` selector when a pane holding a focused text field is
 * wheeled, so a run driven that way measures nothing at all. The second is that
 * the gesture under test is Enter in the field, not the scroll that got the
 * human there; where the pane starts is this probe's setup, and it is asserted
 * as a setup before anything is typed.
 *
 * Focus is taken *after* this, never before — the same crash, and the reason the
 * order here is not the order a human works in.
 */
async function scrollFieldToEdge(page, margin = 12) {
  for (let turn = 0; turn < 4; turn += 1) {
    const at = await geometry(page);
    if (!at.present || !at.scrollable) return at;
    if (Math.abs(at.slack - margin) <= margin) return at;
    await page.evaluate(
      ([slack, gap]) => {
        const pane = document
          .querySelector(".checklist-add-field")
          ?.closest(".ticket-panel");
        // Scrolling down moves the field up, so closing the gap under it is a
        // scroll *back*. Clamped at 0 by the scroller, which is what makes a
        // pane with too little above the field unreachable rather than wrong.
        if (pane) pane.scrollTop += gap - slack;
      },
      [at.slack, margin],
    );
    await settle(page);
  }
  return geometry(page);
}

/**
 * Types filler items until the checklist above the add-row outgrows the pane.
 *
 * Capped, because a size where it never does is a size this run cannot ask
 * about, and 30 rows is already a longer checklist than any ticket in the
 * fixture project.
 */
async function fillUntilReachable(page) {
  await page.click(".checklist-add-field");
  await settle(page);
  for (let row = 1; row <= 30; row += 1) {
    const reachable = await page.evaluate(() => {
      const field = document.querySelector(".checklist-add-field");
      const pane = field?.closest(".ticket-panel");
      if (!field || !pane) return true;
      // What the scroller would have to give up to put the field at its bottom
      // edge. Once the content above the field is taller than the pane, it can.
      return field.offsetTop >= pane.clientHeight;
    });
    if (reachable) return row - 1;
    await page.keyboard.type(`Filler ${row}`, { delay: 5 });
    await page.keyboard.press("Enter");
    await settle(page);
  }
  return 30;
}

async function open(browser, height, surface) {
  const context = await browser.newContext({
    viewport: { width: WIDTH, height },
  });
  const page = await context.newPage();
  await page.goto(
    `${preview.origin}/?${new URLSearchParams({ tickets: String(TICKETS), rw: "1" })}`,
    { waitUntil: "load" },
  );
  await page.waitForFunction(
    () => document.querySelectorAll("[data-ticket-key]").length > 0,
    undefined,
    { timeout: 60_000 },
  );
  if (SELF_TEST) {
    // The app before the fix, exactly: the call is still made and does nothing.
    await page.addInitScript(() => {
      Element.prototype.scrollIntoView = () => {};
    });
    await page.reload({ waitUntil: "load" });
    await page.waitForFunction(
      () => document.querySelectorAll("[data-ticket-key]").length > 0,
      undefined,
      { timeout: 60_000 },
    );
  }
  if (surface === "create") {
    await page.click(".content-header .primary");
    await settle(page);
    await page.click(".quick-create-modal .ghost");
  } else {
    await page.click("[data-ticket-key]");
  }
  await settle(page);
  return { context, page };
}

/* ---------- the run ---------- */

async function probe(browser, height, surface) {
  run(`${surface} · ${height}px`);
  const { context, page } = await open(browser, height, surface);
  try {
    if (!(await page.$(".checklist-add-field"))) {
      check("the add-row is on screen", false, "no .checklist-add-field");
      return;
    }

    // The position under test needs more above the field than the pane is tall,
    // and a fixture ticket is shorter than that at every size but the smallest.
    // A list long enough is how a human gets there too — this is the surface for
    // rapid entry, and the rows it holds are what makes it scroll — so the run
    // types its way into the position rather than inventing one.
    const filled = await fillUntilReachable(page);
    // Positioned unfocused, then focused: WebKit aborts on scrolling a pane that
    // holds a focused text field (`scrollFieldToEdge`).
    await page.evaluate(() =>
      document.querySelector(".checklist-add-field")?.blur(),
    );
    const start = await scrollFieldToEdge(page);
    // The setup is a claim of its own, and this is where a size drops out.
    //
    // The field can only be made the last thing in the pane when what is above
    // it — title, meta, description — is taller than the pane. Where it is not,
    // this height cannot ask the question, and a check that went green on it
    // would be a green about nothing (LC-190). So the size is *skipped*, out
    // loud, and `main` fails a run in which every size skipped.
    if (!start.present || !start.scrollable || start.slack > 24) {
      current.skipped = true;
      check(
        "this height can put the field at the pane's bottom edge",
        true,
        `skipped — ${start.present ? `${start.slack}px under the field after ${filled} filler rows` : "no add-row"}`,
      );
      return;
    }
    measured += 1;
    await page.click(".checklist-add-field");
    await settle(page);
    check(
      "the field is where the human is typing: focused, at the pane's edge",
      (await geometry(page)).focused,
      `slack=${start.slack}px after ${filled} filler rows`,
    );

    // "One checklist item, and then the next" — the journey the ticket names.
    for (const [index, text] of ["First item", "Second item"].entries()) {
      await page.keyboard.type(text, { delay: 10 });
      await page.keyboard.press("Enter");
      await settle(page);
      await settle(page);
      const at = await geometry(page);
      const nth = index === 0 ? "the first item" : "the next item";
      check(
        `${nth} lands in the list`,
        at.rows === start.rows + index + 1,
        `${at.rows} rows`,
      );
      check(
        `the field still holds focus after ${nth}`,
        at.focused,
        `focused=${at.focused}`,
      );
      check(
        `the field is still on screen after ${nth}`,
        at.inside,
        `${at.inside ? "inside" : "under"} the pane, slack=${at.slack}px`,
      );
    }
  } finally {
    await context.close();
  }
}

async function main() {
  preview = await startPreview();
  const browser = await webkit.launch();
  try {
    for (const height of HEIGHTS) {
      for (const surface of SURFACES) {
        try {
          await probe(browser, height, surface);
        } catch (error) {
          check(
            `the ${surface} run at ${height}px completed`,
            false,
            String(error?.message ?? error),
          );
        }
      }
    }
  } finally {
    await browser.close();
    await preview.close();
  }

  console.log(
    `\nCHECKLIST-PROBE tickets=${TICKETS} width=${WIDTH} engine=WebKit (playwright-core)${SELF_TEST ? " SELF-TEST" : ""}`,
  );
  let failed = 0;
  for (const row of results) {
    console.log(`\n  ${row.name}${row.skipped ? " — skipped" : ""}`);
    for (const item of row.checks) {
      if (!item.ok) failed += 1;
      console.log(
        `    ${item.ok ? "ok  " : "FAIL"}  ${item.name}\n            ${item.detail}`,
      );
    }
  }
  const total = results.reduce((sum, row) => sum + row.checks.length, 0);
  console.log(
    `\n  ${total - failed}/${total} checks passed, ${measured}/${results.length} sizes measured`,
  );

  // A run that skipped everything is a run that asked nothing, and it must not
  // read as a pass — that is the whole of what this probe exists to avoid.
  if (measured === 0) {
    console.log(
      "\n  FAIL — no size could put the field at the pane's edge, so nothing was measured",
    );
    failed += 1;
  }

  if (SELF_TEST) {
    // Inverted: with the scroll taken away this must go red, or it is blind.
    console.log(
      failed > 0
        ? `\n  SELF-TEST ok — the app without the scroll failed ${failed} checks`
        : "\n  SELF-TEST FAILED — the app without the scroll passed every check",
    );
    process.exit(failed > 0 ? 0 : 1);
  }
  process.exit(failed > 0 ? 1 : 0);
}

await main();
