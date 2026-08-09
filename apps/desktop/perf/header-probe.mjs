#!/usr/bin/env node
/**
 * Measures the content header while a write is in flight, at the widths the app
 * is actually used at.
 *
 * It exists because LC-149 is a defect nothing in `npm run verify` can see. The
 * report was that the header's control row *reflowed onto two lines* and the
 * ordering control was *clipped* while a write was unsettled — a statement about
 * boxes, made by a layout engine, about a state that lasts as long as a disk
 * write does. jsdom lays nothing out, so the component tests cannot ask it; the
 * theme matrix photographs states but at one width and with the disk quiet; and
 * the a11y audit's 200% row asks whether controls *overlap*, which a cluster that
 * wraps tidily onto a second line does not. This drives WebKit — the engine the
 * packaged app's WKWebView is — starts a real write through the real mutation
 * path, and reads the geometry back.
 *
 * The oracle is `screen-specs.md` § Content header: it is **one row** —
 * identity, path, disk state, then every board control — which wraps only as a
 * last resort, and then by moving the control row down *whole*. So what is
 * checked is not "it looks fine" but the four things that sentence means when
 * the disk speaks up:
 *
 *   1. neither half of the header breaks. The header has exactly two items, the
 *      identity and the controls, and the wrap between them is the designed
 *      failure; a break *inside* either one is not, because that is what strands
 *      a control;
 *   2. nothing in it is clipped;
 *   3. every control is still inside the header — a row that has run out of
 *      width must give some up, not hang past the edge;
 *   4. the write resizes nothing, and every pixel the row has given up since the
 *      widest run is the filter field's — it is the only control here whose
 *      width is a size rather than a content, so it is the only one that can
 *      give any up without losing a label.
 *
 * **What it does not assert, and why.** Not "the header's height never changes
 * while a write is in flight", though that is the prototype's behaviour D-65
 * compares against. Between roughly 1230 and 1400 CSS pixels the header is one
 * row with the disk quiet and cannot be one row with the indicator on it, so the
 * control row moves down whole — the designed wrap, arriving for a reason the
 * user did not ask for. Closing that means reserving the indicator's 32ch
 * whether or not there is a write, which at 1440 leaves 4px of slack: a project
 * whose name is a little longer would then be two rows at the width the design
 * was drawn at. The height is printed beside every check so the band is visible;
 * LC-182 is where the choice is recorded.
 *
 * Usage:
 *   npm run probe:header                  # every width
 *   node perf/header-probe.mjs --widths=1440,720
 *   npm run probe:header -- --self-test   # restore the pre-fix rules, expect red
 *
 * `--self-test` puts the pre-LC-149 header back and expects the run to go red. A
 * probe that stays green under it is not measuring what it claims to, which is
 * how two blind rows were caught in the a11y audit the day it was written. It
 * goes red at the narrow end, where the defect was: the widths above 800 were
 * never broken, and a self-test that failed there would be failing for a reason
 * this file made up.
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
 * The range the window can actually be. 1440 is the matrix's window and the
 * width the design was drawn at, 1180 is the launch size, and 760 is
 * `tauri.conf.json`'s `minWidth` — the app cannot be made narrower, so a header
 * that holds at 760 holds everywhere. 1300 is in the band the note above
 * describes, where the wrap arrives with the write; the rest are where the
 * shortfall first appears and where it first bites.
 */
const WIDTHS = argument("widths", "1440,1300,1180,1024,900,800,760")
  .split(",")
  .map(Number);
/** Enough for a board that scrolls, few enough that a run is seconds. */
const TICKETS = Number(argument("tickets", "40"));
const SELF_TEST = process.argv.includes("--self-test");

/**
 * How long the stub holds a write open. Past `SPINNER_DELAY_MS` (500ms in
 * `WriteFeedback.tsx`), so the run reaches the widest thing the indicator ever
 * is — the spinner *and* the path — rather than stopping at the first frame.
 */
const SLOW_MS = 1_800;

/**
 * The header as it was before LC-149, restored from a stylesheet.
 *
 * `display: contents` is how the DOM half is put back without a second build:
 * it dissolves the identity group, so the name, the gear, the path chip and the
 * indicator become items of the header again, which is exactly the arrangement
 * the fix replaced.
 */
const PRE_FIX_CSS = `
  .header-identity { display: contents; }
  .content-header .toolbar-actions { flex-wrap: wrap; min-width: auto; }
  .content-header .toolbar-actions > * { flex: 0 1 auto; }
  .content-header .filter-wrap { width: auto; min-width: auto; }
  .content-header .filter-field { width: 190px; }
`;

/* ---------- reporting ---------- */

const results = [];
let current;

function width(px) {
  current = { px, checks: [] };
  results.push(current);
}

function check(name, ok, detail) {
  current.checks.push({ name, ok: Boolean(ok), detail });
  return Boolean(ok);
}

/* ---------- harness plumbing ---------- */

/**
 * Everything the checks read, in one round trip: the header's box, the cluster's
 * box, and every control in it with whether its own content fits inside it.
 */
const measure = (page) =>
  page.evaluate(() => {
    const box = (element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      };
    };
    const header = document.querySelector(".content-header");
    const cluster = header?.querySelector(".toolbar-actions");
    const identity = header?.querySelector(".header-identity");
    if (!header || !cluster || !identity) return null;
    const indicator = header.querySelector(".disk-path");
    const tallest = (element) =>
      Math.max(...[...element.children].map((child) => box(child).height));
    return {
      header: box(header),
      cluster: box(cluster),
      window: window.innerWidth,
      // The two halves the header may break between, and nowhere else: each is
      // on one line when it is no taller than the tallest thing standing in it.
      lines: [
        { name: "identity", box: box(identity), tallest: tallest(identity) },
        { name: "controls", box: box(cluster), tallest: tallest(cluster) },
      ],
      controls: [...cluster.children].map((element) => ({
        name:
          element.className.toString().split(/\s+/).filter(Boolean)[0] ??
          element.tagName.toLowerCase(),
        box: box(element),
        // A control whose content is wider than the box drawn for it. This is
        // "the ordering control was clipped" as something measurable: `Order`
        // and its trigger no longer fit in the width the row gave them.
        clipped: element.scrollWidth > element.clientWidth + 1,
      })),
      indicator: indicator
        ? { text: indicator.textContent.trim(), box: box(indicator) }
        : null,
    };
  });

/** Enters the board's roving focus and opens the focused card's `P` menu. */
async function openPriorityMenu(page) {
  for (let press = 0; press < 40; press += 1) {
    await page.keyboard.press("Tab");
    const onCard = await page.evaluate(
      () => document.activeElement?.dataset?.ticketKey !== undefined,
    );
    if (onCard) break;
  }
  await page.keyboard.press("ArrowDown");
  const key = await page.evaluate(
    () => document.activeElement?.dataset?.ticketKey,
  );
  if (!key) throw new Error("no card took focus, so no write could be started");
  await page.keyboard.press("p");
  await page.waitForSelector(".menu-popover", { timeout: 5_000 });
  return key;
}

/* ---------- the run ---------- */

/**
 * What each control is wide at the widest width, filled in by the first run.
 *
 * The narrow runs are read against it, because "the filter field is the one
 * that yields" is a claim about what a shortfall costs, and a shortfall only
 * exists at a width where there is one. Compared within a single run it would
 * be a check that passes because nothing happened.
 */
const natural = new Map();

async function probe(browser, px) {
  width(px);
  const context = await browser.newContext({
    viewport: { width: px, height: 900 },
  });
  const page = await context.newPage();
  try {
    const query = new URLSearchParams({
      tickets: String(TICKETS),
      rw: "1",
      slow: String(SLOW_MS),
    });
    await page.goto(`${preview.origin}/?${query}`, { waitUntil: "load" });
    await page.waitForFunction(
      () => document.querySelectorAll("[data-ticket-key]").length > 0,
      undefined,
      { timeout: 60_000 },
    );
    if (SELF_TEST) await page.addStyleTag({ content: PRE_FIX_CSS });

    const quiet = await measure(page);
    check(
      "the header is on screen with the disk quiet",
      quiet && quiet.indicator === null,
      quiet
        ? `header ${Math.round(quiet.header.height)}px, indicator ${quiet.indicator?.text ?? "absent"}`
        : "no content header",
    );
    if (!quiet) return;
    // The widest run comes first, and it is where every control is at the size
    // the design gives it. Every narrower run is read against these.
    if (natural.size === 0) {
      for (const control of quiet.controls)
        natural.set(control.name, control.box.width);
    }

    // `Urgent` because the fixture writes `none` and `p2`, so the pick is always
    // a change — `changePriority` returns without writing when it is not.
    await openPriorityMenu(page);
    await page.click('.menu-row:has-text("Urgent")');
    await page.waitForSelector(".content-header .disk-path.writing", {
      timeout: 5_000,
    });
    const writing = await measure(page);
    await page.waitForSelector(".content-header .write-spinner", {
      timeout: 5_000,
    });
    const spinning = await measure(page);

    // The probe's own honesty check: if the indicator is not up, or does not
    // name the file, every geometry check below passes for the wrong reason.
    check(
      "a write is in flight and the indicator names the file",
      /^writing tickets\/.+\/ticket\.md…$/.test(
        spinning.indicator?.text.replace(/^⟳\s*/, "") ?? "",
      ),
      JSON.stringify(spinning.indicator?.text ?? null),
    );

    for (const [state, seen] of [
      ["while writing", writing],
      ["with the spinner up", spinning],
    ]) {
      // Not "every child has the same `top`": they are different heights and the
      // row centres them, so they never do. A second line inside a half is that
      // half standing taller than the tallest thing in it.
      const broken = seen.lines.filter(
        (line) => line.box.height > line.tallest + 1,
      );
      check(
        `neither half of the header breaks ${state}`,
        broken.length === 0,
        seen.lines
          .map(
            (line) =>
              `${line.name} ${Math.round(line.box.height)}px/${Math.round(line.tallest)}px`,
          )
          .join(", ") +
          // Reported, not asserted: see the note at the top of this file about
          // the band of widths where this number does change.
          `; header ${Math.round(quiet.header.height)}px quiet → ${Math.round(seen.header.height)}px`,
      );

      const clipped = seen.controls.filter((control) => control.clipped);
      check(
        `no control is clipped ${state}`,
        clipped.length === 0,
        clipped.length
          ? clipped.map((control) => control.name).join(", ")
          : seen.controls.map((control) => control.name).join(" "),
      );

      // The controls' own extent, not the cluster's box: a cluster that has
      // shrunk as far as it can and then let its contents hang out the right
      // side draws a box that fits and a `New ticket` that does not.
      const left = Math.min(...seen.controls.map((c) => c.box.left));
      const right = Math.max(...seen.controls.map((c) => c.box.right));
      check(
        `every control stays inside the header ${state}`,
        left >= seen.header.left - 1 && right <= seen.header.right + 1,
        `controls ${Math.round(left)}..${Math.round(right)} in header ${Math.round(seen.header.left)}..${Math.round(seen.header.right)}`,
      );

      // And the header is not itself wider than the window it is in. An
      // indivisible row is a claim on width, and a claim the region cannot meet
      // is paid by the window: this is the check that would have caught
      // `nowrap` pushing `New ticket` off the right-hand side at 200% zoom,
      // which the accessibility gate's A5 row found instead.
      check(
        `the header stays inside the window ${state}`,
        seen.header.right <= seen.window + 1,
        `header ends at ${Math.round(seen.header.right)} of ${seen.window}px`,
      );

      const widthOf = (controls, name) =>
        controls.find((control) => control.name === name)?.box.width ?? 0;

      // The write resizes nothing. Weak on its own — at most widths there is
      // nothing to resize — but it is the difference between a row that yields
      // and a row that jumps under the pointer, so it is asked at every width.
      const resized = seen.controls
        .map((control, index) => ({ control, before: quiet.controls[index] }))
        .filter(
          ({ control, before }) =>
            !before || Math.abs(before.box.width - control.box.width) > 1,
        );
      check(
        `no control is resized by the write ${state}`,
        resized.length === 0,
        resized.length
          ? resized
              .map(
                ({ control, before }) =>
                  `${control.name} ${Math.round(before?.box.width ?? 0)}→${Math.round(control.box.width)}`,
              )
              .join(", ")
          : `filter holds at ${Math.round(widthOf(seen.controls, "filter-wrap"))}px`,
      );

      // And the width the row has given up since 1440 is all the filter's. This
      // is the check with something to say at 800 and 760, where the row is
      // genuinely short: a view segment or a `New ticket` narrower than the
      // design draws it would be losing a label rather than a few characters of
      // a query.
      const shrunk = seen.controls.filter(
        (control) =>
          control.name !== "filter-wrap" &&
          natural.has(control.name) &&
          natural.get(control.name) - control.box.width > 1,
      );
      check(
        `only the filter field has given up width ${state}`,
        shrunk.length === 0,
        shrunk.length
          ? shrunk
              .map(
                (control) =>
                  `${control.name} ${Math.round(natural.get(control.name))}→${Math.round(control.box.width)}`,
              )
              .join(", ")
          : `filter ${Math.round(natural.get("filter-wrap") ?? 0)}→${Math.round(widthOf(seen.controls, "filter-wrap"))}px since ${WIDTHS[0]}px`,
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
    for (const px of WIDTHS) {
      try {
        await probe(browser, px);
      } catch (error) {
        check(
          `the ${px}px run completed`,
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
    `\nHEADER-PROBE tickets=${TICKETS} slow=${SLOW_MS}ms engine=WebKit (playwright-core)${SELF_TEST ? " SELF-TEST" : ""}`,
  );
  let failed = 0;
  for (const row of results) {
    console.log(`\n  ${row.px}px`);
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
    // Inverted: the pre-fix stylesheet must break this, or the probe is blind.
    console.log(
      failed > 0
        ? `\n  SELF-TEST ok — the pre-fix rules failed ${failed} checks`
        : "\n  SELF-TEST FAILED — the pre-fix rules passed every check",
    );
    process.exit(failed > 0 ? 0 : 1);
  }
  process.exit(failed > 0 ? 1 : 0);
}

await main();
