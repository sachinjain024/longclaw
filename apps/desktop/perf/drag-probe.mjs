#!/usr/bin/env node
/**
 * Drives a real drag, in a real engine, and says where the ticket ended up.
 *
 * Every drag test in this repository is jsdom, which dispatches whatever it is
 * told to and so cannot answer the only question that matters when a drag does
 * nothing in the app: did the page refuse the drop, or did the page never get
 * asked? This drives Playwright's WebKit — the same engine as the WKWebView the
 * app runs in — with real mouse input over the perf build, and reports what the
 * page did about it.
 *
 * It exists because that distinction cost a day. LC-60 shipped a green drag
 * that had never worked in the app: Tauri's `dragDropEnabled` defaults to true,
 * so wry answers the WKWebView's dragging-destination messages itself and the
 * page never sees `dragover` at all. Nothing in `npm run verify` can see that,
 * and this can.
 *
 * **The second question is LC-174's, and it is the one that stayed open.** A
 * page can accept a drop and still put the ticket somewhere else — the drop
 * line lands between two rows, the write allocates a rank that does not express
 * that position, and the row appears at the top of the group instead. Accepting
 * is not landing, so this runs with the write commands served (`?rw=1`) and
 * reads the order back afterwards. Each case below is one row of LC-174's
 * checklist:
 *
 *   1. drag between columns on the board, in either order;
 *   2. Manual: place a card at a chosen spot inside its column;
 *   3. drag between groups in the list, in either order;
 *   4. Manual: place a row at a chosen spot inside its group.
 *
 * A fifth case asks the same question of the ticket panel's checklist (LC-185),
 * which is the third list in this app a pointer can rearrange. It has no ranks
 * and no groups — the order is the order of the lines in the file — so what it
 * can get wrong is the landing itself: the anchor a drop names is the row above
 * where the pointer let go, and off by one there is a row that lands beside its
 * gap rather than in it.
 *
 * The two Priority "place" cases are here as the control: ADR 0003 gives a place
 * inside a group to Manual alone, so those two must be *refused* — the pointer
 * says no rather than the row sliding back. A probe that only checked the four
 * that must work would pass just as happily against a build that accepted
 * everything.
 *
 * Usage:
 *   npm run probe:drag                       # every case
 *   node perf/drag-probe.mjs --case=list-place-manual
 *   node perf/drag-probe.mjs --tickets=200   # a longer board
 *   npm run probe:drag -- --self-test        # LC-60's symptom, expecting red
 *
 * `--self-test` puts LC-60's defect back — a capture-phase handler that kills
 * `dragstart` before the page sees it, which is what the window's own drag
 * handler did — and expects the run to go red. A probe that stays green under it
 * is not measuring what it claims to.
 *
 * Reading a failure: `dragover=0` means something between the page and the
 * engine took the drag, which in the app is the window flag; dragovers with
 * `accepted=0` means the page refused every position it was asked about, which
 * is the page's own logic; accepted-and-dropped with the row in the wrong place
 * is the write, not the pointer — and the drop line's position is printed beside
 * it, because a line drawn in the right gap narrows that to rank allocation.
 */

import { webkit } from "playwright-core";

import { startPreview } from "./preview-server.mjs";

/** This run's own server, up before anything is driven (`preview-server.mjs`). */
let preview;

const argument = (name, fallback) => {
  const hit = process.argv.find((value) => value.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

/** Enough for six groups deep enough to drop into, few enough to be seconds. */
const TICKETS = Number(argument("tickets", "40"));
const ONLY = argument("case", undefined);
const SELF_TEST = process.argv.includes("--self-test");

/**
 * Which row the "place" cases pick up, and which gap they let go over. Both are
 * flags because the failure LC-174 was reported for is directional: a row
 * dropped *above* everything ranked lands where it was let go, and the same row
 * dropped three places *down* does not move at all.
 */
const FROM_ROW = Number(argument("from", "0"));
const TO_GAP = Number(argument("gap", "3"));
/**
 * Where an `across` run lets go in the group it is aiming at. Not a gap — a
 * status change has no place to choose, so this is a row to land *on*, and the
 * second one rather than the first because the first shares an edge with the
 * group's heading.
 */
const ACROSS_ROW = 1;

/** What each surface calls its parts, and how it is reached. */
const SURFACES = {
  board: {
    row: ".ticket-row",
    group: ".board-column",
    head: "h3",
    scroller: ".board-stack",
    lit: ".board-column.drop-target",
    line: ".drop-line",
    open: async () => {},
  },
  list: {
    row: ".list-row",
    group: ".list-group",
    head: ".list-group-header",
    scroller: ".issue-list",
    lit: ".list-group.drop-target",
    line: ".list-drop-line",
    open: async (page) => {
      await page.click('button[aria-pressed="false"]:has-text("List")');
      await page.waitForSelector(".list-row", { timeout: 30_000 });
    },
  },
  /**
   * The ticket panel's checklist (LC-185). It has no groups and no scroller of
   * its own, so it names only the two things `drag` paints with: what lights up
   * — here the row wearing the insertion line — and where that line was drawn.
   * The line is a pseudo-element on the row's own edge rather than an element
   * (`styles.css`), so the box read back is the row's, which is the boundary the
   * drop is about either way.
   */
  panel: {
    row: ".checklist-row",
    lit: ".checklist-row.drop-above, .checklist-row.drop-below",
    line: ".checklist-row.drop-above, .checklist-row.drop-below",
    open: async (page) => {
      await page.click(".ticket-row");
      await page.waitForSelector(".checklist-row", { timeout: 30_000 });
    },
  },
};

/**
 * LC-174's checklist, as runs. `across` is a status change and both orders have
 * it (ADR 0003 as revised for LC-60); `place` is a rank, which is Manual's
 * alone — so the two Priority `place` rows expect a refusal rather than a move.
 */
const CASES = [
  {
    id: "board-across-priority",
    item: "1. board: drag between columns (Priority)",
    surface: "board",
    order: "priority",
    move: "across",
  },
  {
    id: "board-across-manual",
    item: "1. board: drag between columns (Manual)",
    surface: "board",
    order: "manual",
    move: "across",
  },
  {
    id: "board-place-manual",
    item: "2. board: place a card inside its column (Manual)",
    surface: "board",
    order: "manual",
    move: "place",
  },
  {
    id: "board-place-priority",
    item: "control: a place inside a column is Manual's alone (ADR 0003)",
    surface: "board",
    order: "priority",
    move: "place",
    refused: true,
  },
  {
    id: "list-across-priority",
    item: "3. list: drag between groups (Priority)",
    surface: "list",
    order: "priority",
    move: "across",
  },
  {
    id: "list-across-manual",
    item: "3. list: drag between groups (Manual)",
    surface: "list",
    order: "manual",
    move: "across",
  },
  {
    id: "list-place-manual",
    item: "4. list: place a row inside its group (Manual)",
    surface: "list",
    order: "manual",
    move: "place",
  },
  {
    id: "list-place-priority",
    item: "control: a place inside a group is Manual's alone (ADR 0003)",
    surface: "list",
    order: "priority",
    move: "place",
    refused: true,
  },
  {
    id: "panel-checklist",
    item: "5. panel: drag a checklist row to another place in the list (LC-185)",
    surface: "panel",
    checklist: true,
  },
];

/* ---------- reporting ---------- */

const results = [];
let current;

function run(row) {
  current = { ...row, checks: [] };
  results.push(current);
}

function check(name, ok, detail) {
  current.checks.push({ name, ok: Boolean(ok), detail });
  return Boolean(ok);
}

/* ---------- harness plumbing ---------- */

/**
 * Every group on the surface and the rows it is drawing, in visual order.
 *
 * By box rather than by document order: both surfaces place their rows
 * absolutely and mount anchors out of sequence, so the DOM is not the order the
 * human sees. `visible` is whether the row is inside its own scroller, which is
 * what makes a row a thing this probe may aim a pointer at.
 */
const read = (page, surface) =>
  page.evaluate(
    (sel) => {
      return [...document.querySelectorAll(sel.group)].map((group) => {
        const heading = group.querySelector(sel.head);
        // Text nodes only: the heading also holds a status dot and a count, and
        // neither is the group's name.
        const title = heading
          ? [...heading.childNodes]
              .filter((node) => node.nodeType === 3)
              .map((node) => node.textContent)
              .join("")
              .trim()
          : "";
        // The board's scroller is one per column and inside it; the list's is the
        // one scroller every group is in.
        const clip = (
          group.querySelector(sel.scroller) ??
          group.closest(sel.scroller) ??
          group
        ).getBoundingClientRect();
        const rows = [...group.querySelectorAll(sel.row)]
          .map((row) => {
            const box = row.getBoundingClientRect();
            return {
              key: row.dataset.ticketKey,
              draggable: row.draggable,
              x: box.left,
              y: box.top,
              w: box.width,
              h: box.height,
              visible: box.top >= clip.top && box.bottom <= clip.bottom,
            };
          })
          .sort((left, right) => left.y - right.y);
        return { title, rows };
      });
    },
    pick(surface, "group", "head", "scroller", "row"),
  );

/** The selectors one `page.evaluate` needs, without the handlers it cannot take. */
function pick(surface, ...names) {
  return Object.fromEntries(
    names.map((name) => [name, SURFACES[surface][name]]),
  );
}

/** Where a pointer lands on a row: its middle, and its top edge for a gap. */
const middle = (row) => ({
  x: row.x + Math.min(row.w / 2, 80),
  y: row.y + row.h / 2,
});
const topEdge = (row) => ({ x: row.x + Math.min(row.w / 2, 80), y: row.y + 3 });

/**
 * One drag, with real mouse input, reporting what the page saw and what it
 * painted while the pointer was still hanging over the target.
 */
async function drag(page, surface, from, to) {
  const ui = SURFACES[surface];
  await page.evaluate(() => {
    window.__seen = [];
    for (const name of ["dragstart", "dragover", "drop", "dragend"]) {
      window.addEventListener(name, (event) => {
        window.__seen.push({ name, accepted: event.defaultPrevented });
      });
    }
  });

  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let step = 1; step <= 12; step += 1) {
    await page.mouse.move(
      from.x + ((to.x - from.x) * step) / 12,
      from.y + ((to.y - from.y) * step) / 12,
      { steps: 2 },
    );
    await page.waitForTimeout(30);
  }
  // `dragover` fires on its own every ~350ms while the pointer is still, so a
  // settle here is what makes the last position the one that is reported.
  await page.mouse.move(to.x + 1, to.y);
  await page.waitForTimeout(500);

  const painted = await page.evaluate(
    (selectors) => {
      const line = document.querySelector(selectors.line);
      return {
        lit: document.querySelectorAll(selectors.lit).length,
        line: line ? line.getBoundingClientRect().top : null,
      };
    },
    { lit: ui.lit, line: ui.line },
  );

  await page.mouse.up();
  await page.waitForTimeout(200);

  const seen = await page.evaluate(() => window.__seen);
  const overs = seen.filter((event) => event.name === "dragover");
  return {
    painted,
    dragstart: seen.some((event) => event.name === "dragstart"),
    overs: overs.length,
    accepted: overs.filter((event) => event.accepted).length,
    dropped: seen.some((event) => event.name === "drop" && event.accepted),
  };
}

/**
 * The order once the write has landed, or once it is clear none is coming.
 *
 * The move is optimistic and the stub settles in a microtask, so the interesting
 * failure is not slowness — it is a write that lands and then decays back when
 * the receipt disagrees with it. So this waits for the order to change and then
 * waits again, and reports what is on screen after the surface has stopped
 * moving.
 */
async function settled(page, surface, before) {
  const flat = (groups) =>
    groups.map((group) => group.rows.map((row) => row.key).join(",")).join("|");
  const deadline = Date.now() + 2_000;
  let after = await read(page, surface);
  while (flat(after) === flat(before) && Date.now() < deadline) {
    await page.waitForTimeout(100);
    after = await read(page, surface);
  }
  await page.waitForTimeout(400);
  return read(page, surface);
}

/** Where a key sits, as group title and index, or null when it is nowhere. */
function seatOf(groups, key) {
  for (const group of groups) {
    const index = group.rows.findIndex((row) => row.key === key);
    if (index >= 0) return { title: group.title, index };
  }
  return null;
}

const show = (seat) => (seat ? `${seat.title}[${seat.index}]` : "nowhere");

/* ---------- the run ---------- */

/**
 * The checklist rows as they read, top to bottom, with the box each one is
 * drawn in — the item id is the identity here, the way a ticket key is on the
 * two ticket surfaces.
 */
const readChecklist = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll(".checklist-row")].map((row) => {
      const box = row.getBoundingClientRect();
      return {
        key: row.dataset.itemId,
        draggable: row.draggable,
        x: box.left,
        y: box.top,
        w: box.width,
        h: box.height,
      };
    }),
  );

/**
 * A checklist row dragged to another place in its own list (LC-185).
 *
 * The question is LC-174's, asked of a different list: not whether the page
 * accepted the drop but whether the row **landed where it was let go**. So the
 * order is read back after the write has settled — the stub serves the order it
 * wrote (`stubs/core.ts`), so an order that only looks right until the file
 * answers shows up here as a row that moved back.
 */
async function probeChecklist(browser, row) {
  run(row);
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  try {
    await page.goto(`${preview.origin}/?tickets=${TICKETS}&rw=1`, {
      waitUntil: "load",
    });
    await page.waitForFunction(
      () => document.querySelectorAll("[data-ticket-key]").length > 0,
      undefined,
      { timeout: 60_000 },
    );
    await SURFACES.panel.open(page);
    if (SELF_TEST) await swallowDragstart(page);

    const before = await readChecklist(page);
    if (before.length < 2) throw new Error("the panel drew no list to reorder");
    const moving = before[0];
    const onto = before[before.length - 1];
    check(
      "the row can be picked up",
      moving.draggable,
      `${moving.key}, draggable=${moving.draggable}`,
    );

    // The lower half of the last row, which is the one gap below every item.
    const saw = await drag(page, "panel", middle(moving), {
      x: onto.x + Math.min(onto.w / 2, 80),
      y: onto.y + onto.h - 3,
    });
    check(
      "the page accepted the drop",
      saw.accepted > 0 && saw.dropped,
      `dragstart=${saw.dragstart} dragover=${saw.overs} ` +
        `accepted=${saw.accepted} drop=${saw.dropped}`,
    );
    check(
      "the insertion line is drawn on the boundary under the pointer",
      saw.painted.lit > 0,
      `lit=${saw.painted.lit} line=${saw.painted.line ?? "none"}`,
    );

    // Settled, not optimistic: the panel re-reads after the write, and a move
    // the file disagreed with decays back here rather than in front of a human.
    const deadline = Date.now() + 3_000;
    let after = await readChecklist(page);
    while (
      after.map((item) => item.key).join(",") ===
        before.map((item) => item.key).join(",") &&
      Date.now() < deadline
    ) {
      await page.waitForTimeout(100);
      after = await readChecklist(page);
    }
    await page.waitForTimeout(400);
    after = await readChecklist(page);
    const wanted = [...before.slice(1), moving].map((item) => item.key);
    check(
      `${moving.key} is last in the list now`,
      after.map((item) => item.key).join(",") === wanted.join(","),
      `${before.map((item) => item.key).join(" ")} → ` +
        `${after.map((item) => item.key).join(" ")}`,
    );
  } finally {
    await context.close();
  }
}

/** LC-60's defect, restored: the drag never reaches the page at all. */
const swallowDragstart = (page) =>
  page.evaluate(() => {
    window.addEventListener(
      "dragstart",
      (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
      },
      true,
    );
  });

async function probe(browser, row) {
  run(row);
  const ui = SURFACES[row.surface];
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  try {
    await page.goto(`${preview.origin}/?tickets=${TICKETS}&rw=1`, {
      waitUntil: "load",
    });
    await page.waitForFunction(
      () => document.querySelectorAll("[data-ticket-key]").length > 0,
      undefined,
      { timeout: 60_000 },
    );
    await ui.open(page);
    if (row.order === "manual") {
      await page.click('button[aria-label^="Order:"]');
      await page.click('[role="menuitemradio"]:has-text("Manual")');
      await page.waitForSelector(ui.row, { timeout: 30_000 });
    }
    if (SELF_TEST) await swallowDragstart(page);

    const before = await read(page, row.surface);
    /**
     * The rows a run ever points at: the one it picks up, the one an `across`
     * drop is aimed at, and the gap a `place` drop is aimed at. Those are what
     * "drawn where a pointer can reach it" has to mean.
     *
     * It used to mean *every* rendered row, and that quietly tied which columns
     * this probe was willing to use to how tall a card is. LC-166 raised the
     * card 90 → 108px, at which point a 7-card column no longer fit its
     * scroller end to end, four of the six columns stopped being eligible, and
     * the target fell through to `Canceled` — the far side of a board that
     * scrolls sideways, where the drop does not land. Three checks went red for
     * a change that had nothing to do with drag. `--tickets=46` reproduces the
     * same three on the pre-LC-166 card, which is what says the coupling was
     * always here and 40 tickets merely stepped over it.
     */
    const aimedAt = [FROM_ROW, ACROSS_ROW, TO_GAP];
    // The synthetic unreadable group and the archive name no status and take no
    // drop, so neither is a source or a target here.
    const usable = before.filter(
      (group) =>
        group.rows.length > TO_GAP &&
        aimedAt.every((index) => group.rows[index]?.visible) &&
        !["Unreadable", "Archived"].includes(group.title),
    );
    if (usable.length < 2) throw new Error("no two groups a drag can reach");

    const source = usable[0];
    const moving = source.rows[FROM_ROW];
    check(
      "the row can be picked up",
      moving.draggable,
      `${moving.key} in ${source.title}, draggable=${moving.draggable}`,
    );

    const target = row.move === "across" ? usable[1] : source;
    const landing =
      row.move === "across"
        ? middle(target.rows[ACROSS_ROW])
        : topEdge(target.rows[TO_GAP]);
    const saw = await drag(page, row.surface, middle(moving), landing);
    const after = await settled(page, row.surface, before);

    const events =
      `dragstart=${saw.dragstart} dragover=${saw.overs} ` +
      `accepted=${saw.accepted} drop=${saw.dropped}`;
    const was = seatOf(before, moving.key);
    const now = seatOf(after, moving.key);

    if (row.refused) {
      check("the page refuses every position", saw.accepted === 0, events);
      check(
        "nothing is written and the row stays where it was",
        now?.title === was?.title && now?.index === was?.index,
        `${moving.key} ${show(was)} → ${show(now)}`,
      );
      check(
        "no drop line is drawn where no place can be chosen",
        saw.painted.line === null,
        `lit=${saw.painted.lit} line=${saw.painted.line ?? "none"}`,
      );
      return;
    }

    check(
      "the page accepted the drop",
      saw.accepted > 0 && saw.dropped,
      events,
    );
    // A group lights up for a ticket *arriving*, which is a status change; a
    // ticket let go back in its own group is placed, and the drop line already
    // says where. So the same paint is an assertion either way round.
    check(
      row.move === "across"
        ? "the group under the pointer lights up"
        : "its own group does not light up, having nothing to take",
      row.move === "across" ? saw.painted.lit > 0 : saw.painted.lit === 0,
      `lit=${saw.painted.lit}`,
    );

    if (row.move === "across") {
      check(
        `${moving.key} is in ${target.title} now`,
        now?.title === target.title,
        `${moving.key} ${show(was)} → ${show(now)}`,
      );
      check(
        `and is gone from ${source.title}`,
        now?.title !== source.title,
        after
          .find((group) => group.title === source.title)
          ?.rows.map((cell) => cell.key)
          .join(" ") ?? "no such group",
      );
      return;
    }

    // A place inside the group: the row it was let go above stays below it.
    // `TO_GAP` counts gaps in the order the drag started from, so taking the
    // moving row out of the way is what turns it into an index.
    const expected = TO_GAP > FROM_ROW ? TO_GAP - 1 : TO_GAP;
    // The line is drawn on the boundary the drop reads, so a line in the right
    // place and a row in the wrong one is the write's fault and not the
    // pointer's — which is the whole diagnosis this case exists to make.
    const wanted = target.rows[TO_GAP].y;
    check(
      "the drop line is drawn in the gap under the pointer",
      saw.painted.line !== null && Math.abs(saw.painted.line - wanted) <= 4,
      `line at ${saw.painted.line === null ? "none" : Math.round(saw.painted.line)}, gap ${TO_GAP} at ${Math.round(wanted)}`,
    );
    check(
      `${moving.key} lands at index ${expected} of ${source.title}`,
      now?.title === source.title && now?.index === expected,
      `${moving.key} ${show(was)} → ${show(now)}\n            ` +
        `was ${before
          .find((g) => g.title === source.title)
          ?.rows.map((c) => c.key)
          .join(" ")}\n            ` +
        `now ${after
          .find((g) => g.title === source.title)
          ?.rows.map((c) => c.key)
          .join(" ")}`,
    );
  } finally {
    await context.close();
  }
}

async function main() {
  const cases = CASES.filter((row) => ONLY === undefined || row.id === ONLY);
  if (cases.length === 0) throw new Error(`no case named ${ONLY}`);

  preview = await startPreview();
  const browser = await webkit.launch();
  try {
    for (const row of cases) {
      try {
        await (row.checklist ? probeChecklist : probe)(browser, row);
      } catch (error) {
        check(
          `the ${row.id} run completed`,
          false,
          String(error?.message ?? error),
        );
      }
    }
  } finally {
    await browser.close();
    await preview.close();
  }

  console.log(
    `\nDRAG-PROBE tickets=${TICKETS} engine=WebKit (playwright-core)` +
      `${SELF_TEST ? " SELF-TEST" : ""}`,
  );
  let failed = 0;
  for (const row of results) {
    console.log(`\n  ${row.id} — ${row.item}`);
    for (const item of row.checks) {
      if (!item.ok) failed += 1;
      console.log(
        `    ${item.ok ? "ok  " : "FAIL"}  ${item.name}\n            ${item.detail}`,
      );
    }
  }
  const total = results.reduce((sum, row) => sum + row.checks.length, 0);
  console.log(`\n  ${total - failed}/${total} checks passed`);

  if (SELF_TEST) {
    // Inverted: a drag the page never sees must break this, or it is blind.
    console.log(
      failed > 0
        ? `\n  SELF-TEST ok — a swallowed dragstart failed ${failed} checks`
        : "\n  SELF-TEST FAILED — a swallowed dragstart passed every check",
    );
    process.exit(failed > 0 ? 0 : 1);
  }
  process.exit(failed > 0 ? 1 : 0);
}

await main();
