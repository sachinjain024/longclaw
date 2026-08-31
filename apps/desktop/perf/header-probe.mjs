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
 *   1. the control row does not break. Since LC-239w the header holds one item
 *      and nothing else — everything that named the project moved to the side
 *      panel — so there is no seam left for it to wrap at, and a second line
 *      inside the cluster is the failure that strands a control;
 *   2. nothing in it is clipped;
 *   3. every control is still inside the header — a row that has run out of
 *      width must give some up, not hang past the edge;
 *   4. the write resizes nothing, and every pixel the row has given up since the
 *      widest run is the filter field's — it is the only control here whose
 *      width is a size rather than a content, so it is the only one that can
 *      give any up without losing a label;
 *   5. the side panel's path fits its box and clears the gear above it, the
 *      block is the width of the rows under it with its gear on their `⋮`, and
 *      the list scrolls under a pinned create pair;
 *   6. and the side panel holds still. The write lands in the identity block
 *      now, whose disk row is reserved rather than conditional: a row that
 *      arrived with the write would push every project under it down and pull
 *      it back up when the write settled, which is (1)'s defect on the other
 *      axis. `.identity-disk` in `styles.css` carries the reasoning.
 *
 * **What LC-239w settled.** This file carried a paragraph explaining why "the
 * header's height never changes while a write is in flight" could not be
 * asserted: between roughly 1230 and 1400 CSS pixels the header was one row with
 * the disk quiet and could not be one with the indicator on it, so the control
 * row moved down whole — the designed wrap, arriving for a reason the user did
 * not ask for (LC-182). The indicator is not in the header any more and the
 * header has one item, so that band is gone and the height simply holds. The
 * cost moved with it, into the side panel, where it is paid as one reserved row
 * of the disk-state line's own height rather than as a wrap — which is what the
 * last check measures.
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
 * The two defects this probe exists for, restored from a stylesheet.
 *
 * It used to put back the pre-LC-149 header with `display: contents` on the
 * identity group. There is no identity group any more — LC-239w moved the name,
 * the path and the disk-state line to the side panel and left the header
 * holding controls alone — so the inversion is now the two rules that would
 * bring the same class of defect back:
 *
 *   1. the control row free to wrap and free to refuse to shrink, which is
 *      LC-149's `New ticket` on a second line and, past that, off the side;
 *   2. the identity block's disk row free to collapse, which is the same defect
 *      turned on its side — the project list moving down when a write starts
 *      and back up when it lands, on every write.
 */
const PRE_FIX_CSS = `
  .content-header .toolbar-actions { flex-wrap: wrap; min-width: auto; }
  .content-header .toolbar-actions > * { flex: 0 1 auto; }
  .content-header .toolbar-actions > .filter-wrap { flex: none; max-width: none; }
  .content-header .filter-wrap { width: 380px; min-width: 0; }
  .identity-disk { height: auto; min-height: 0; margin-top: 0; }
  .project-nav { overflow-y: visible; min-height: auto; }
  .project-identity .path-chip { max-width: 100%; }
  .project-identity { padding-right: 4px; }
  .identity-text { flex: 0 1 auto; }
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
    // The identity block is in the side panel now (LC-239w), which is where the
    // write lands and where the disk-state line lives.
    const identity = document.querySelector(".project-identity");
    const nav = document.querySelector(".project-nav");
    if (!header || !cluster || !identity || !nav) return null;
    const indicator = identity.querySelector(".disk-path");
    const tallest = (element) =>
      Math.max(...[...element.children].map((child) => box(child).height));
    return {
      header: box(header),
      cluster: box(cluster),
      // The block the write now writes into, and the top of the list under it.
      // A block that grows when a write starts pushes every project row down
      // and pulls it back up when the write lands — LC-149's defect on the
      // other axis, and the reason the disk row is reserved rather than
      // conditional.
      identity: box(identity),
      navTop: box(nav).top,
      window: window.innerWidth,
      // The header is one item now, so it has one line to hold: it is on it
      // when it is no taller than the tallest thing standing in it.
      lines: [
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

    // The side panel's two load-bearing rules, computed rather than read off the
    // stylesheet — LC-73 moved the create pair *up* because `.project-nav` had
    // no `overflow-y` and at the foot of a long list it left the window, and
    // LC-239w moves it back down on the strength of that one declaration. jsdom
    // renders no CSS, so this is the layer that can ask.
    const panel = await page.evaluate(() => {
      const nav = document.querySelector(".project-nav");
      const footer = document.querySelector(".side-panel-footer");
      const pair = footer?.querySelector(".project-actions");
      const side = document.querySelector(".side-panel");
      if (!nav || !pair || !side) return null;
      const box = (element) => element.getBoundingClientRect();
      return {
        navScrolls: getComputedStyle(nav).overflowY === "auto",
        navShrinks: getComputedStyle(nav).minHeight === "0px",
        // The pair is inside the panel it is pinned to, at every width.
        pairInside: box(pair).bottom <= box(side).bottom + 1,
        pairBottom: Math.round(box(pair).bottom),
        panelBottom: Math.round(box(side).bottom),
      };
    });
    // The path fits its box, and the box is the one the character cap in
    // `pathDisplay.ts` was measured against. Four different numbers were wrong
    // before that constant was right — each one arithmetic from the panel's
    // width rather than a measurement — and every one of them would have shown
    // as a second ellipsis on screen and nowhere else. `scrollWidth` over
    // `clientWidth` is the whole check.
    const path = await page.evaluate(() => {
      const txt = document.querySelector(".project-identity .path-chip .txt");
      const chip = document.querySelector(".project-identity .path-chip");
      const gear = document.querySelector(".project-identity .settings-button");
      if (!txt || !chip || !gear) return null;
      const box = (element) => {
        const rect = element.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
        };
      };
      return {
        text: txt.textContent,
        needs: Math.round(txt.scrollWidth),
        has: Math.round(txt.clientWidth),
        // And it does not run under the gear. They are on different rows since
        // the gear went into the flow of the name's, so this is a box overlap
        // rather than a left-of test — the two were side by side once, and a
        // chip that ran past the gear handed the path's last characters to the
        // control that opens settings.
        clearsGear: (() => {
          const a = box(chip);
          const b = box(gear);
          return !(
            a.right > b.left &&
            a.left < b.right &&
            a.bottom > b.top &&
            a.top < b.bottom
          );
        })(),
      };
    });
    check(
      "the path fits its box on one line and stops short of the gear",
      path && path.needs <= path.has + 0.5 && path.clearsGear,
      path
        ? `"${path.text}" ${path.needs}px in ${path.has}px, gear ${path.clearsGear ? "clear" : "OVERLAPPED"}`
        : "no path chip",
    );

    // The identity block is the same width as the rows under it, and the gear
    // ends where their `⋮` ends. Both are alignments between elements that
    // share no rule and no parent — the arithmetic agreed on paper at every
    // width and disagreed on screen at all of them, because the text column was
    // sizing to the project's name rather than to the panel (LC-239w, round 4).
    const aligned = await page.evaluate(() => {
      const box = (selector) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return { left: Math.round(rect.left), right: Math.round(rect.right) };
      };
      const block = box(".project-identity");
      const row = box(".project-row");
      const gear = box(".project-identity .settings-button");
      const kebab = box(".project-row .row-menu-button");
      if (!block || !row || !gear || !kebab) return null;
      return {
        block,
        row,
        gear,
        kebab,
        sameBox: block.left === row.left && block.right === row.right,
        sameEdge: gear.right === kebab.right,
      };
    });
    check(
      "the identity block is the rows' width and its gear is on their `⋮`",
      aligned && aligned.sameBox && aligned.sameEdge,
      aligned
        ? `block ${aligned.block.left}..${aligned.block.right} vs row ${aligned.row.left}..${aligned.row.right}, ` +
            `gear ends ${aligned.gear.right} vs ⋮ ${aligned.kebab.right}`
        : "no identity block or project row",
    );

    check(
      "the project list scrolls and the pinned pair is inside the panel",
      panel && panel.navScrolls && panel.navShrinks && panel.pairInside,
      panel
        ? `overflow-y ${panel.navScrolls ? "auto" : "visible"}, min-height ${panel.navShrinks ? "0" : "auto"}, pair ends at ${panel.pairBottom} of ${panel.panelBottom}px`
        : "no side panel",
    );

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
    await page.waitForSelector(".identity-disk .disk-path.writing", {
      timeout: 5_000,
    });
    const writing = await measure(page);
    await page.waitForSelector(".identity-disk .write-spinner", {
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
        `the header's control row does not break ${state}`,
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

      // And the block the write lands in does not change size, so the list
      // under it does not move: `.identity-disk` reserves its line whether or
      // not there is anything to put in it. This is the check that goes red if
      // someone makes that row conditional, and nothing in `npm test` lays
      // anything out to notice.
      check(
        `the identity block and the list hold still ${state}`,
        Math.abs(seen.identity.height - quiet.identity.height) <= 1 &&
          Math.abs(seen.navTop - quiet.navTop) <= 1,
        `block ${Math.round(quiet.identity.height)}→${Math.round(seen.identity.height)}px, ` +
          `list top ${Math.round(quiet.navTop)}→${Math.round(seen.navTop)}px`,
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
