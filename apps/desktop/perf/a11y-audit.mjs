#!/usr/bin/env node
/**
 * Part A of the accessibility audit (plan 41), automated.
 *
 * The plan split the audit in two: Part A — keyboard-only lifecycle, focus order
 * and return, visible focus, reduced motion, zoom — is release-blocking, because
 * `docs/acceptance/release-candidate.md` § Known issues already calls "an
 * accessibility failure that prevents keyboard completion of the core ticket
 * lifecycle" a release blocker. Part B, the VoiceOver semantic pass, needs a
 * human ear and is not here.
 *
 * Part A is *verification against a written oracle* rather than discovery, and
 * that is exactly the shape a machine can hold: `keyboard-focus-map.md` says
 * which key does what and where focus lands afterwards, so every check below
 * cites a line of it. What this cannot do is speak: it drives the real `App`
 * over the perf harness's stubbed IPC in WebKit — the same engine the packaged
 * app's WKWebView runs — not the packaged app itself. The bundle pass stays
 * manual and stays in the candidate record.
 *
 * Every input is a key. There is not one `page.click` in this file, on purpose:
 * a pointer anywhere in a lifecycle step would make that step's pass meaningless.
 *
 * Usage:
 *   npm run a11y:audit                 # the five Part A rows
 *   npm run a11y:audit -- --only=A3    # one row while it is being written
 *   npm run a11y:audit -- --self-test  # break the build, expect the rows to fail
 */

import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { webkit } from "playwright-core";

import { startPreview } from "./preview-server.mjs";

const here = dirname(fileURLToPath(import.meta.url));
/** This run's own server, up before anything is driven (`preview-server.mjs`). */
let preview;
const OUT = resolve(here, "../dist-a11y");
mkdirSync(OUT, { recursive: true });

const argument = (name, fallback) => {
  const hit = process.argv.find((value) => value.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

/**
 * Big enough that columns scroll and the window is doing real work — plan 41
 * asks for a project `fixtures/representative-project` is too small for — and
 * small enough that a lifecycle step is not waiting on 5,000 rows.
 */
const TICKETS = Number(argument("tickets", "600"));
const ONLY = argument("only", "A1,A2,A3,A4,A5").split(",");
const SELF_TEST = process.argv.includes("--self-test");
/** 1440×900 is the matrix's window; halving the CSS viewport is A5's 200%. */
const VIEWPORT = { width: 1_440, height: 900 };

/* ---------- reporting ---------- */

const rows = [];
let current;

function row(id, name) {
  current = { id, name, checks: [] };
  rows.push(current);
}

/** One assertion, with the line of the oracle it is checking. */
function check(name, ok, detail, oracle) {
  current.checks.push({ name, ok: Boolean(ok), detail, oracle });
  return Boolean(ok);
}

/* ---------- harness plumbing ---------- */

async function board(browser, options = {}) {
  const context = await browser.newContext({
    viewport: options.viewport ?? VIEWPORT,
    reducedMotion: options.reducedMotion,
  });
  const page = await context.newPage();
  const query = new URLSearchParams({ tickets: String(TICKETS), rw: "1" });
  if (options.fail) query.set("fail", options.fail);
  await page.goto(`${preview.origin}/?${query}`, { waitUntil: "load" });
  await page.waitForFunction(
    () => document.querySelectorAll("[data-ticket-key]").length > 0,
    undefined,
    { timeout: 60_000 },
  );
  if (SELF_TEST && options.selfTest) await options.selfTest(page);
  return { context, page };
}

/** What currently holds focus, in the terms the checks below are written in. */
const focused = (page) =>
  page.evaluate(() => {
    const empty = { tag: "body", className: "", label: "", role: "", text: "" };
    const element = document.activeElement;
    // Focus on the body is a result the checks read, not an absence — "nothing
    // holds focus" is exactly what a lost focus return looks like — so it comes
    // back in the same shape as everything else.
    if (!element || element === document.body) return empty;
    const box = element.getBoundingClientRect();
    return {
      tag: element.tagName.toLowerCase(),
      className: element.className?.toString?.() ?? "",
      label: element.getAttribute("aria-label") ?? "",
      role: element.getAttribute("role") ?? "",
      text: (element.textContent ?? "").trim().slice(0, 60),
      ticketKey: element.dataset?.ticketKey,
      box: { x: box.x, y: box.y, width: box.width, height: box.height },
    };
  });

/**
 * Tabs until `predicate` holds, and reports how many presses it took.
 *
 * Reachability is itself an A1 question — a Retry that no number of Tab presses
 * can reach is a keyboard failure however good it looks — so the count is
 * recorded rather than hidden inside a wait.
 */
async function tabTo(page, predicate, limit = 40) {
  for (let presses = 1; presses <= limit; presses += 1) {
    await page.keyboard.press("Tab");
    const at = await focused(page);
    if (predicate(at)) return { found: true, presses, at };
  }
  return { found: false, presses: limit, at: await focused(page) };
}

const isCard = (at) => at.ticketKey !== undefined;

/** Enters the board's roving focus the way a human arriving by keyboard does. */
async function focusFirstCard(page) {
  const reached = await tabTo(page, isCard);
  if (!reached.found) return reached;
  await page.keyboard.press("ArrowDown");
  return { ...reached, at: await focused(page) };
}

const visible = (page, selector) =>
  page.evaluate((css) => {
    const element = document.querySelector(css);
    return Boolean(element && element.getBoundingClientRect().width > 0);
  }, selector);

const textOf = (page, selector) =>
  page.evaluate(
    (css) => document.querySelector(css)?.textContent?.trim() ?? "",
    selector,
  );

const settle = (page) => page.waitForTimeout(120);

/* ---------- A1: keyboard-only core ticket lifecycle ---------- */

/**
 * Create, find, open, edit, move, search, archive, undo and retry — the row the
 * gate names, driven with the keyboard alone. `keyboard-focus-map.md` § Global,
 * § Board, § Ticket panel, § Command palette, § Quick create and § Menus are the
 * oracle for every step.
 */
async function auditLifecycle(browser) {
  row("A1", "Keyboard-only core ticket lifecycle");
  // The failing first edit is armed here rather than in a run of its own: Retry
  // is a lifecycle step, and reaching it any other way would prove less.
  const { context, page } = await board(browser, {
    fail: "edit",
    // Swallow `C` before it reaches React: the keyboard path to creating a
    // ticket, gone, which is the shape of the defect this row actually found.
    selfTest: (target) =>
      target.evaluate(() => {
        document.addEventListener(
          "keydown",
          (event) => {
            if (event.key === "c") event.stopImmediatePropagation();
          },
          true,
        );
      }),
  });
  try {
    const entry = await focusFirstCard(page);
    check(
      "the board takes focus from the keyboard",
      entry.found && isCard(entry.at),
      `${entry.presses} Tab presses, then ArrowDown → ${entry.at.ticketKey ?? entry.at.tag}`,
      "keyboard-focus-map.md:39 — arrows move focus within the column",
    );

    // Create (§ Global `C`, § Quick create `Enter`).
    await page.keyboard.press("c");
    await settle(page);
    const modal = await visible(page, "form.quick-create-modal");
    const inTitle = await focused(page);
    check(
      "`C` opens quick create with focus in the title field",
      modal && inTitle.label === "Title",
      `modal=${modal} focus=${inTitle.label || inTitle.tag}`,
      "keyboard-focus-map.md:32,133",
    );
    const title = `Keyboard lifecycle ${Date.now() % 100_000}`;
    await page.keyboard.type(title);
    await page.keyboard.press("Enter");
    await settle(page);
    const afterCreate = await focused(page);
    const createdKey = afterCreate.ticketKey;
    check(
      "`Enter` creates the ticket and focus moves to the new card",
      createdKey !== undefined,
      `focus=${createdKey ?? (afterCreate.className || afterCreate.tag)}`,
      "keyboard-focus-map.md:131,164 — focus moves to the new card",
    );

    // Find (§ Global `⌘F`, and the filter's rung of the `Esc` ladder).
    await page.keyboard.press("Meta+f");
    const inFilter = await focused(page);
    await page.keyboard.type(title.slice(0, 18));
    await settle(page);
    const narrowed = await page.evaluate(
      () => document.querySelectorAll("[data-ticket-key]").length,
    );
    check(
      "`⌘F` focuses the filter and typing narrows the surface",
      inFilter.className.includes("filter-field") && narrowed > 0,
      `focus=${inFilter.className} rows=${narrowed}`,
      "keyboard-focus-map.md:31",
    );
    await page.keyboard.press("Escape");
    await settle(page);
    const cleared = await page.evaluate(
      () => document.querySelector(".filter-field")?.value ?? "?",
    );
    check(
      "`Esc` clears the filter — the ladder's last rung",
      cleared === "",
      `filter=${JSON.stringify(cleared)}`,
      "keyboard-focus-map.md:19-21",
    );

    // Open (§ Board `Enter`).
    const onCard = await tabTo(page, isCard);
    await page.keyboard.press("Enter");
    await settle(page);
    check(
      "`Enter` opens the focused ticket in the panel",
      await visible(page, ".ticket-panel"),
      `opened from ${onCard.at.ticketKey}`,
      "keyboard-focus-map.md:41",
    );

    // Edit (§ Ticket panel `Tab`, § Description editor `⌘↵`).
    const toEdit = await tabTo(page, (at) =>
      at.className.includes("description-edit"),
    );
    check(
      "the description editor is reachable by Tab inside the panel",
      toEdit.found,
      `${toEdit.presses} presses`,
      "keyboard-focus-map.md:61",
    );
    if (toEdit.found) {
      await page.keyboard.press("Enter");
      await settle(page);
      const inTextarea = await focused(page);
      check(
        "entering edit focuses the textarea",
        inTextarea.label === "Description",
        `focus=${inTextarea.label || inTextarea.tag}`,
        "keyboard-focus-map.md:91-92",
      );
      await page.keyboard.type(" Edited with the keyboard.");
      await page.keyboard.press("Meta+Enter");
      await settle(page);
      const stillEditing = await visible(
        page,
        "textarea[aria-label=Description]",
      );
      check(
        "`⌘↵` saves and leaves edit mode",
        !stillEditing,
        `textarea still up: ${stillEditing}`,
        "keyboard-focus-map.md:87",
      );
    }

    // Retry: the description save is the write `?fail=edit` refused, so the
    // danger toast is up now. It has to be reachable and operable by key.
    const failed = await visible(page, ".toast.danger");
    check(
      "a refused write raises the danger toast",
      failed,
      await textOf(page, ".toast-message"),
      "V0-29 / failure.ts — what happened, what to do, what is safe",
    );
    if (failed) {
      const toRetry = await tabTo(page, (at) =>
        at.className.includes("toast-action"),
      );
      check(
        "Retry is reachable with the keyboard",
        toRetry.found && toRetry.at.text.startsWith("Retry"),
        `${toRetry.presses} presses → ${toRetry.at.text || toRetry.at.tag}`,
        "keyboard-focus-map.md:11-12 — every pointer action has a keyboard path",
      );
      if (toRetry.found) {
        await page.keyboard.press("Enter");
        await settle(page);
        check(
          "Retry re-sends the write and the danger toast goes",
          !(await visible(page, ".toast.danger")),
          `toast up: ${await visible(page, ".toast.danger")}`,
          "mutations.ts — Retry is the ordinary write path again",
        );
      }
    }

    // Move (§ Board `S`), from the panel's own ticket.
    await page.keyboard.press("Escape");
    await settle(page);
    const backOnCard = await focused(page);
    check(
      "`Esc` closes the panel and focus returns to the card that opened it",
      isCard(backOnCard),
      `focus=${backOnCard.ticketKey ?? (backOnCard.className || backOnCard.tag)}`,
      "keyboard-focus-map.md:60,161",
    );
    const movedFrom = backOnCard.ticketKey;
    await page.keyboard.press("s");
    await settle(page);
    const menuUp = await visible(page, ".menu-popover");
    check(
      "`S` opens the status menu on the focused card",
      menuUp,
      `menu=${menuUp}`,
      "keyboard-focus-map.md:42",
    );
    if (menuUp) {
      const before = await page.evaluate(
        (key) =>
          document
            .querySelector(`[data-ticket-key="${key}"]`)
            ?.closest(".board-column")
            ?.querySelector("h3")?.textContent ?? "",
        movedFrom,
      );
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      await settle(page);
      const after = await page.evaluate(
        (key) =>
          document
            .querySelector(`[data-ticket-key="${key}"]`)
            ?.closest(".board-column")
            ?.querySelector("h3")?.textContent ?? "",
        movedFrom,
      );
      check(
        "picking a status moves the card across columns",
        before !== after && after !== "",
        `${before.trim()} → ${after.trim()}`,
        "keyboard-focus-map.md:132 — pick applies optimistically",
      );
    }

    // Search (§ Command palette).
    await page.keyboard.press("Meta+k");
    await settle(page);
    const paletteUp = await visible(page, ".command-palette");
    check(
      "`⌘K` opens the command palette",
      paletteUp,
      `palette=${paletteUp}`,
      "keyboard-focus-map.md:29",
    );
    if (paletteUp) {
      // A key at the root, before the search sub-mode (LC-171). Typed into the
      // root list, where it used to filter command labels and find nothing.
      await page.keyboard.type("PF-12");
      // No debounce to wait out: the root reads rows the app already holds.
      await settle(page);
      const offered = await page.evaluate(
        () =>
          document.querySelector('[role="option"] .search-key')?.textContent ??
          "",
      );
      check(
        "a ticket key typed at the root offers that ticket first",
        offered === "PF-12",
        `first row=${offered || "(no ticket row)"}`,
        "keyboard-focus-map.md:109,114-118",
      );
      if (offered === "PF-12") {
        await page.keyboard.press("Enter");
        await settle(page);
        const opened = await page.evaluate(
          () =>
            document
              .querySelector(".ticket-panel")
              ?.getAttribute("aria-label") ?? "",
        );
        check(
          "`Enter` on it opens that ticket, on the search row's own path",
          opened === "Ticket PF-12",
          `panel=${opened || "(none)"}`,
          "keyboard-focus-map.md:114-118",
        );
      }
      // Back to the board and into the palette again, so the sub-mode below
      // starts where it always did.
      await page.keyboard.press("Escape");
      await settle(page);
      await page.keyboard.press("Meta+k");
      await settle(page);

      await page.keyboard.type("search");
      await settle(page);
      await page.keyboard.press("Enter");
      await settle(page);
      await page.keyboard.type(title.slice(0, 18));
      await page.waitForTimeout(400);
      const hits = await page.evaluate(
        () => document.querySelectorAll('[role="option"]').length,
      );
      check(
        "search reaches the ticket the keyboard created",
        hits > 0,
        `${hits} results for the created title`,
        "keyboard-focus-map.md:106-112",
      );
      if (hits > 0) {
        await page.keyboard.press("Enter");
        await settle(page);
        check(
          "`Enter` on a result opens the ticket panel",
          await visible(page, ".ticket-panel"),
          `panel=${await visible(page, ".ticket-panel")}`,
          "keyboard-focus-map.md:111",
        );
      }
    }

    // Archive and undo (§ Command palette is their keyboard path, § Global ⌘Z).
    await page.keyboard.press("Escape");
    await settle(page);
    await page.keyboard.press("Meta+k");
    await page.keyboard.type("archive");
    await settle(page);
    await page.keyboard.press("Enter");
    await settle(page);
    const archivedToast = await textOf(page, ".toast-message");
    check(
      "the palette archives the ticket",
      /archiv/i.test(archivedToast),
      archivedToast || "(no toast)",
      "keyboard-focus-map.md:120-125 — the palette is archive's keyboard path",
    );
    await page.keyboard.press("Meta+z");
    await settle(page);
    const undone = await textOf(page, ".toast-message");
    check(
      "`⌘Z` takes the archive back",
      undone !== "" && undone !== archivedToast,
      undone || "(no toast)",
      "keyboard-focus-map.md:30 — undo is paired with the toast",
    );

    await page.screenshot({ path: resolve(OUT, "A1-lifecycle.png") });
  } finally {
    await context.close();
  }
}

/* ---------- A2: focus order and focus return ---------- */

/**
 * The § Focus-return table, row by row, plus the one thing a DOM can be asked
 * about reading order: that the Tab sequence inside the panel runs down the
 * page rather than jumping about.
 */
async function auditFocusOrder(browser) {
  row("A2", "Focus order and focus return");
  const { context, page } = await board(browser, {
    // The return half of the contract, removed at the root: every programmatic
    // `focus()` becomes a no-op, so Tab still works and nothing the app tries to
    // focus deliberately ever lands. That is precisely what a broken focus
    // return looks like, and it is deterministic rather than a race with rAF.
    selfTest: (target) =>
      target.evaluate(() => {
        HTMLElement.prototype.focus = function noop() {};
      }),
  });
  try {
    await focusFirstCard(page);
    const card = (await focused(page)).ticketKey;

    // Palette → whatever held focus before ⌘K.
    await page.keyboard.press("Meta+k");
    await settle(page);
    await page.keyboard.press("Escape");
    await settle(page);
    const afterPalette = await focused(page);
    check(
      "closing the palette returns focus to what held it before `⌘K`",
      afterPalette.ticketKey === card,
      `${card} → ${afterPalette.ticketKey ?? (afterPalette.className || afterPalette.tag)}`,
      "keyboard-focus-map.md:154",
    );

    // Quick create (canceled) → prior focus.
    await page.keyboard.press("c");
    await settle(page);
    await page.keyboard.press("Escape");
    await settle(page);
    const afterCancel = await focused(page);
    check(
      "canceling quick create returns focus to where it was",
      afterCancel.ticketKey === card,
      `${card} → ${afterCancel.ticketKey ?? (afterCancel.className || afterCancel.tag)}`,
      "keyboard-focus-map.md:157",
    );

    // Menu → the focused card (the single-key path).
    await page.keyboard.press("s");
    await settle(page);
    await page.keyboard.press("Escape");
    await settle(page);
    const afterMenu = await focused(page);
    check(
      "closing a menu returns focus to the card it was anchored to",
      afterMenu.ticketKey === card,
      `${card} → ${afterMenu.ticketKey ?? (afterMenu.className || afterMenu.tag)}`,
      "keyboard-focus-map.md:153",
    );

    // Ticket panel → the card that opened it.
    await page.keyboard.press("Enter");
    await settle(page);
    const opened = await visible(page, ".ticket-panel");
    await page.keyboard.press("Escape");
    await settle(page);
    const afterPanel = await focused(page);
    check(
      "closing the ticket panel returns focus to the card that opened it",
      opened && afterPanel.ticketKey === card,
      `${card} → ${afterPanel.ticketKey ?? (afterPanel.className || afterPanel.tag)}`,
      "keyboard-focus-map.md:161",
    );

    // Reading order inside the panel: the Tab sequence must run down the page.
    await page.keyboard.press("Enter");
    await settle(page);
    const sequence = [];
    for (let press = 0; press < 14; press += 1) {
      await page.keyboard.press("Tab");
      const at = await focused(page);
      if (!at.box) break;
      const panel = await page.evaluate(
        () => !!document.activeElement?.closest(".ticket-panel"),
      );
      if (!panel) break;
      sequence.push(at);
    }
    /** A step backwards up the page that is not a new row is out of order. */
    const backwards = sequence.filter((at, index) => {
      const previous = sequence[index - 1];
      if (!previous) return false;
      const sameBand = Math.abs(at.box.y - previous.box.y) < 8;
      return sameBand
        ? at.box.x < previous.box.x - 1
        : at.box.y < previous.box.y - 8;
    });
    check(
      "the panel's Tab order runs down the page in reading order",
      sequence.length >= 4 && backwards.length === 0,
      `${sequence.length} stops, ${backwards.length} out of order` +
        (backwards.length
          ? `: ${backwards.map((at) => at.label || at.text || at.className).join(", ")}`
          : ""),
      "keyboard-focus-map.md:61 — the panel's natural order",
    );

    // Settings → the gear (LC-125). Two presses because the Tab walk above ends
    // inside the panel, and a field there answers the first `Esc` itself.
    await page.keyboard.press("Escape");
    await settle(page);
    await page.keyboard.press("Escape");
    await settle(page);
    const gear = await tabTo(page, (at) => at.label === "Project settings");
    await page.keyboard.press("Enter");
    await settle(page);
    const settingsUp = await visible(page, ".settings-panel");
    const inName = await page.evaluate(
      () => !!document.activeElement?.closest(".settings-identity"),
    );
    check(
      "the gear opens project settings with focus in its first field",
      gear.found && settingsUp && inName,
      `presses=${gear.presses} dialog=${settingsUp} focus=${inName ? "Name" : (await focused(page)).tag}`,
      "keyboard-focus-map.md:143-147 — focus enters the first meaningful control",
    );

    await page.keyboard.press("Escape");
    await settle(page);
    const afterSettings = await focused(page);
    check(
      "`Esc` closes settings and focus returns to the gear",
      !(await visible(page, ".settings-panel")) &&
        afterSettings.label === "Project settings",
      `focus=${afterSettings.label || afterSettings.className || afterSettings.tag}`,
      "keyboard-focus-map.md:166 — settings returns focus to its opener",
    );
  } finally {
    await context.close();
  }
  await auditRawFileFocus(browser);
}

/**
 * The raw file view's default action, on its own page.
 *
 * A file that will not parse has none of the panel's ordinary stops — no title,
 * no status, no checklist — so the only keyboard question it raises is which
 * control the view opens on, and `keyboard-focus-map.md:148-149` answers it:
 * `Retry parse`. It is a second page rather than a step in the walk above,
 * because `?fail=parse` degrades every read and the checks before it need a
 * ticket that parses.
 */
async function auditRawFileFocus(browser) {
  const { context, page } = await board(browser, {
    fail: "parse",
    selfTest: (target) =>
      target.evaluate(() => {
        HTMLElement.prototype.focus = function noop() {};
      }),
  });
  try {
    await focusFirstCard(page);
    await page.keyboard.press("Enter");
    await settle(page);
    const shown = await visible(page, ".raw-file-view");
    const at = await focused(page);
    check(
      "the raw file view opens with `Retry parse` focused",
      shown && at.text === "Retry parse",
      `raw view=${shown} focus=${at.text || at.label || at.className || at.tag}`,
      "keyboard-focus-map.md:148-149 — `Retry parse` is the default-focused action",
    );
  } finally {
    await context.close();
  }
}

/* ---------- A3: visible focus ---------- */

/**
 * The row a jsdom suite is structurally blind to. Component tests assert focus
 * *placement*; this asserts the ring is on screen and painted — inside the
 * viewport, inside whatever scroll container the element lives in, and visibly
 * different from the same element unfocused.
 */
async function auditVisibleFocus(browser) {
  row("A3", "Visible focus survives panels, overlays, and scroll containers");
  const { context, page } = await board(browser, {
    selfTest: (target) =>
      target.addStyleTag({
        // The exact mistake this row exists to catch.
        content: "*:focus, *:focus-visible { outline: none !important; }",
      }),
  });
  try {
    /** Is the focused element inside the viewport and inside its scroller? */
    const clipping = () =>
      page.evaluate(() => {
        const element = document.activeElement;
        if (!element || element === document.body)
          return { ok: false, why: "nothing focused" };
        const box = element.getBoundingClientRect();
        const inViewport =
          box.top >= -1 &&
          box.left >= -1 &&
          box.bottom <= window.innerHeight + 1 &&
          box.right <= window.innerWidth + 1;
        let scroller = element.parentElement;
        while (scroller) {
          const style = getComputedStyle(scroller);
          if (/(auto|scroll)/.test(style.overflowY + style.overflowX)) break;
          scroller = scroller.parentElement;
        }
        const clip = scroller?.getBoundingClientRect();
        const inScroller =
          !clip ||
          (box.bottom > clip.top - 1 &&
            box.top < clip.bottom + 1 &&
            box.right > clip.left - 1 &&
            box.left < clip.right + 1);
        return {
          ok: inViewport && inScroller,
          why: `viewport=${inViewport} scroller=${inScroller}`,
          box: { x: box.x, y: box.y, width: box.width, height: box.height },
        };
      });

    /**
     * Does focusing this element change any pixels? Screenshots the element and
     * a two-pixel margin around it — where a ring lives — with and without
     * focus, and compares. A ring drawn in a token nobody can see fails here and
     * nowhere else.
     */
    const paints = async (label) => {
      const geometry = await page.evaluate(() => {
        const box = document.activeElement?.getBoundingClientRect();
        return box
          ? { x: box.x, y: box.y, width: box.width, height: box.height }
          : null;
      });
      if (!geometry || geometry.width === 0)
        return { ok: false, why: "no box" };
      const clip = {
        x: Math.max(0, geometry.x - 4),
        y: Math.max(0, geometry.y - 4),
        width: Math.min(geometry.width + 8, VIEWPORT.width - geometry.x),
        height: Math.min(geometry.height + 8, VIEWPORT.height - geometry.y),
      };
      const withFocus = await page.screenshot({ clip });
      await page.evaluate(() => document.activeElement?.blur?.());
      await page.waitForTimeout(60);
      const without = await page.screenshot({ clip });
      await page.screenshot({ clip, path: resolve(OUT, `A3-${label}.png`) });
      return {
        ok: !withFocus.equals(without),
        why: `${withFocus.length} vs ${without.length} bytes`,
      };
    };

    // A card deep in a scrolled column: the focus ring's hardest case, because
    // the column is the scroll container and the card is drawn into a window.
    await focusFirstCard(page);
    for (let press = 0; press < 25; press += 1)
      await page.keyboard.press("ArrowDown");
    await settle(page);
    const cardClip = await clipping();
    check(
      "a card 25 rows into a scrolled column keeps its ring on screen",
      cardClip.ok,
      cardClip.why,
      "keyboard-focus-map.md:16-18 — focus is visible and never lost",
    );
    const cardPaint = await paints("card-in-scroller");
    check("that card's focus paints something", cardPaint.ok, cardPaint.why);

    // The palette input, over the scrim.
    await page.keyboard.press("Meta+k");
    await settle(page);
    const paletteClip = await clipping();
    check(
      "the palette input's focus is on screen over the scrim",
      paletteClip.ok,
      paletteClip.why,
    );
    await page.keyboard.press("Escape");
    await settle(page);

    // A control inside the ticket panel, which overlays the surface. `paints`
    // blurs whatever it measured, so focus is put back on a card before the
    // `Enter` that opens the panel — otherwise this would be measuring a panel
    // that never opened.
    await focusFirstCard(page);
    await page.keyboard.press("Enter");
    await settle(page);
    const toEdit = await tabTo(page, (at) =>
      at.className.includes("description-edit"),
    );
    if (toEdit.found) {
      const panelClip = await clipping();
      check(
        "a control inside the ticket panel is not painted under the panel edge",
        panelClip.ok,
        panelClip.why,
      );
      const panelPaint = await paints("panel-control");
      check(
        "that control's focus paints something",
        panelPaint.ok,
        panelPaint.why,
      );
    } else {
      check(
        "a control inside the ticket panel is reachable",
        false,
        "Tab never reached it",
      );
    }
  } finally {
    await context.close();
  }
}

/* ---------- A4: reduced motion ---------- */

/**
 * Not "no animation" — `mvp_plan_order.md` § Step 16b asks that meaningful
 * motion stay short and never be the only carrier of state. So this checks two
 * things: that the durations actually collapse, and that a state change is still
 * legible once they have. An acknowledgement flash that was the *only* signal an agent
 * touched a ticket would pass the first and fail the second.
 */
async function auditReducedMotion(browser) {
  row("A4", "Reduced motion preserves state changes");
  const { context, page } = await board(browser, {
    reducedMotion: "reduce",
    selfTest: (target) =>
      target.addStyleTag({
        // A duration that outlives the media query: what plan 37 found once.
        content: ".ticket-row { transition-duration: 400ms !important; }",
      }),
  });
  try {
    const durations = await page.evaluate(() => {
      const seen = [];
      for (const element of document.querySelectorAll("*")) {
        const style = getComputedStyle(element);
        for (const value of [
          ...style.transitionDuration.split(","),
          ...style.animationDuration.split(","),
        ]) {
          const ms = value.trim().endsWith("ms")
            ? Number.parseFloat(value)
            : Number.parseFloat(value) * 1000;
          if (Number.isFinite(ms) && ms > 0) {
            seen.push({
              ms,
              on:
                element.className?.toString?.().slice(0, 40) ?? element.tagName,
            });
          }
        }
      }
      return seen;
    });
    /** `tokens/build.mjs:292` derives the block from the motion token group. */
    const long = durations.filter((entry) => entry.ms > 1);
    check(
      "no element animates once reduced motion is on",
      long.length === 0,
      long.length
        ? `${long.length} still animating, e.g. ${long[0].ms}ms on .${long[0].on}`
        : `${durations.length} durations, all collapsed`,
      "tokens/build.mjs:292 — the prefers-reduced-motion block",
    );

    // The state change most at risk of being motion-only: an external write.
    // The envelope is `board-trace.mjs`'s, down to `attribution` — the store
    // reads that, not an `actor` — and it lands on `PF-3`, whose status it keeps,
    // so the card repaints in place rather than moving column.
    await page.evaluate(() => {
      window.__longclawPerf.emit({
        contractVersion: 1,
        // Exactly one past the snapshot: a gap makes the store reconcile
        // instead of applying, and a reconcile carries no attribution.
        sequence: 1,
        projectId: "019c8ca0-0000-7000-8000-0000000000ff",
        emittedAt: "2026-08-04T00:00:00Z",
        event: {
          type: "ticketChanged",
          data: {
            source: "external",
            coalescedEvents: 1,
            detectedInMs: 12,
            attribution: {
              id: "evt_a11y",
              kind: "update",
              occurredAt: "2026-08-04T00:00:00Z",
              actor: { type: "agent", name: "Claude Code" },
            },
            ticket: {
              state: "indexed",
              key: "PF-3",
              id: "perf-3",
              title: "An agent touched this ticket",
              status: "in_review",
              priority: "none",
              labels: ["storage"],
              createdAt: "2026-07-29T00:00:00Z",
              updatedAt: "2026-08-04T00:00:00Z",
              checkedCount: 1,
              checklistCount: 1,
              commentCount: 0,
              attachmentCount: 0,
              contentHash: "hash-external",
              relativePath: ".longclaw/tickets/PF-3/ticket.md",
            },
          },
        },
      });
    });
    await settle(page);
    const treatment = await page.evaluate(() => {
      const acknowledged = document.querySelector(".ticket-row.acknowledged");
      if (!acknowledged) return { marked: false };
      const plain = document.querySelector(".ticket-row:not(.acknowledged)");
      const a = getComputedStyle(acknowledged);
      const b = plain ? getComputedStyle(plain) : undefined;
      return {
        marked: true,
        // The acknowledgement line: text, not motion.
        acknowledgement:
          acknowledged.querySelector(".actor")?.textContent?.trim() ?? "",
        border: a.borderTopColor,
        plainBorder: b?.borderTopColor ?? "",
      };
    });
    check(
      "an external change is still marked with motion collapsed",
      treatment.marked &&
        (treatment.acknowledgement !== "" ||
          treatment.border !== treatment.plainBorder),
      treatment.marked
        ? `text=${JSON.stringify(treatment.acknowledgement)} border ${treatment.border} vs ${treatment.plainBorder}`
        : "no card carried the acknowledgement",
      "mvp_plan_order.md § Step 16b — motion must not be the only carrier of state",
    );
    await page.screenshot({ path: resolve(OUT, "A4-reduced-motion.png") });
  } finally {
    await context.close();
  }
}

/* ---------- A5: zoom and larger text ---------- */

/**
 * The mechanism, named, because "200% zoom" without one is not reproducible:
 * the CSS viewport is halved to 720×450 against the same 1440×900 window, which
 * is what a 200% display scale or webview zoom does to layout. macOS larger text
 * is a third mechanism and is not this one.
 */
async function auditZoom(browser) {
  row("A5", "200% zoom does not overlap or hide primary controls");
  const { context, page } = await board(browser, {
    viewport: { width: VIEWPORT.width / 2, height: VIEWPORT.height / 2 },
    // Every header control pinned to the same spot: the overlap this row exists
    // to catch. `display: block` was the first attempt and proved nothing —
    // stacked controls do not overlap, so the row stayed green against a break.
    selfTest: (target) =>
      target.addStyleTag({
        content:
          ".content-header .toolbar-actions > * { position: fixed; top: 8px; left: 8px; }",
      }),
  });
  try {
    /** The controls a user cannot complete the lifecycle without. */
    const PRIMARY = [
      [".content-header .primary", "New ticket"],
      [".filter-field", "Filter field"],
      ['.view-segment button[aria-pressed="true"]', "View segment"],
      [".ordering-control .menu-trigger", "Ordering"],
      [".project-actions .ghost", "Open folder"],
    ];
    const measured = await page.evaluate((controls) => {
      return controls.map(([selector, name]) => {
        const element = document.querySelector(selector);
        if (!element) return { name, present: false };
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          name,
          present: true,
          box: { x: box.x, y: box.y, width: box.width, height: box.height },
          shown: style.visibility !== "hidden" && style.display !== "none",
          inWindow:
            box.width > 0 &&
            box.height > 0 &&
            box.left >= -1 &&
            box.right <= window.innerWidth + 1,
        };
      });
    }, PRIMARY);

    const missing = measured.filter(
      (control) => !control.present || !control.shown,
    );
    check(
      "every primary control is still rendered at 200%",
      missing.length === 0,
      missing.length
        ? missing.map((c) => c.name).join(", ")
        : measured.map((c) => c.name).join(", "),
      "release-candidate.md § Accessibility report",
    );

    const clipped = measured.filter(
      (control) => control.present && !control.inWindow,
    );
    check(
      "no primary control is pushed outside the window at 200%",
      clipped.length === 0,
      clipped.length
        ? clipped
            .map(
              (c) =>
                `${c.name} at x=${Math.round(c.box.x)}..${Math.round(c.box.x + c.box.width)}`,
            )
            .join(", ")
        : "all within the window",
    );

    const overlaps = [];
    for (let left = 0; left < measured.length; left += 1) {
      for (let right = left + 1; right < measured.length; right += 1) {
        const a = measured[left];
        const b = measured[right];
        if (!a.present || !b.present) continue;
        const hit =
          a.box.x < b.box.x + b.box.width - 1 &&
          b.box.x < a.box.x + a.box.width - 1 &&
          a.box.y < b.box.y + b.box.height - 1 &&
          b.box.y < a.box.y + a.box.height - 1;
        if (hit) overlaps.push(`${a.name} × ${b.name}`);
      }
    }
    check(
      "no two primary controls overlap at 200%",
      overlaps.length === 0,
      overlaps.length ? overlaps.join(", ") : "none",
    );

    // The lifecycle still has to run at this size — a control that is on screen
    // but unreachable is the same failure one step later.
    const entry = await focusFirstCard(page);
    await page.keyboard.press("c");
    await settle(page);
    check(
      "quick create still opens at 200%",
      await visible(page, "form.quick-create-modal"),
      `entered the board in ${entry.presses} presses`,
      "keyboard-focus-map.md:32",
    );
    await page.screenshot({
      path: resolve(OUT, "A5-zoom.png"),
      fullPage: false,
    });
  } finally {
    await context.close();
  }
}

/* ---------- main ---------- */

const AUDITS = [
  ["A1", auditLifecycle],
  ["A2", auditFocusOrder],
  ["A3", auditVisibleFocus],
  ["A4", auditReducedMotion],
  ["A5", auditZoom],
];

async function main() {
  preview = await startPreview();
  const browser = await webkit.launch();
  try {
    for (const [id, audit] of AUDITS) {
      if (!ONLY.includes(id)) continue;
      try {
        await audit(browser);
      } catch (error) {
        check(
          `${id} ran to completion`,
          false,
          String(error?.message ?? error),
        );
      }
    }

    const engine =
      "WebKit (playwright-core), the engine the packaged app's WKWebView runs";
    console.log(
      `\nA11Y-PART-A tickets=${TICKETS} viewport=${VIEWPORT.width}x${VIEWPORT.height}`,
    );
    console.log(`engine=${engine}${SELF_TEST ? " mode=self-test" : ""}\n`);
    for (const audited of rows) {
      const failed = audited.checks.filter((entry) => !entry.ok);
      console.log(
        `${audited.id}  ${failed.length === 0 ? "PASS" : "FAIL"}  ${audited.name}`,
      );
      for (const entry of audited.checks) {
        console.log(`      ${entry.ok ? "ok  " : "FAIL"}  ${entry.name}`);
        if (entry.detail) console.log(`            ${entry.detail}`);
        if (entry.oracle) console.log(`            oracle: ${entry.oracle}`);
      }
    }
    console.log(
      `\n${JSON.stringify({ tickets: TICKETS, selfTest: SELF_TEST, rows })}\n`,
    );

    const failures = rows.flatMap((audited) =>
      audited.checks
        .filter((entry) => !entry.ok)
        .map((entry) => `${audited.id}: ${entry.name}`),
    );
    if (SELF_TEST) {
      // Inverted on purpose: a broken build that still passes means the probes
      // are not looking at anything. Plan 37's theme-dot test is why this exists.
      const silent = rows.filter((audited) =>
        audited.checks.every((entry) => entry.ok),
      );
      if (silent.length > 0) {
        console.log(
          `SELF-TEST FAILED: ${silent.map((a) => a.id).join(", ")} passed against a broken build`,
        );
        process.exitCode = 1;
      } else {
        console.log(`self-test: every row went red against its injected break`);
      }
      return;
    }
    if (failures.length > 0) {
      console.log(
        `ACCESSIBILITY PART A FAILED (${failures.length}):\n  ${failures.join("\n  ")}`,
      );
      process.exitCode = 1;
    } else {
      // Named rather than described, so a `--only` run cannot read as a full
      // pass in a record somebody quotes later.
      console.log(
        `Part A passes: ${rows.map((audited) => `${audited.id} ${audited.name.toLowerCase()}`).join("; ")}`,
      );
    }
  } finally {
    await browser.close();
    await preview.close();
  }
}

await main();
