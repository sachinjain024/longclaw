#!/usr/bin/env node
/**
 * Regenerates ../proof/renders/ from the two committed proof pages — the
 * pipeline V0-41 puts in the repo so the Step-1 exit-gate evidence can never
 * again drift from the HTML it is supposed to show.
 *
 * The render set (names and sizes match the original evidence):
 *   board-<preset>-{light,dark}.png                  — 1400×860 viewport
 *   library-indigo-light.png, library-clay-dark.png  — 1200 wide, full page
 *
 * The preset list is read from the token file rather than repeated here. It
 * used to be a literal, which meant adding Graphite in LC-192 left the
 * evidence one preset short while the README went on claiming the gate was
 * met — the exact drift between claim and proof this pipeline exists to stop.
 *
 * Theme and appearance are set the way the token contract says they change:
 * the two root attributes swap, nothing else does.
 *
 * Dependencies: `playwright-core` is resolved out of `apps/desktop`, the one
 * package tree this repo has, and drives WebKit — the engine the product
 * ships in. First run may need: `npx playwright-core install webkit` (from
 * `apps/desktop`).
 *
 * Usage: node scripts/render.mjs   (from docs/design/foundations)
 */

import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(
  resolve(here, "../../../../apps/desktop/package.json"),
);
const { webkit } = require("playwright-core");

const proof = resolve(here, "../proof");
const out = resolve(proof, "renders");
mkdirSync(out, { recursive: true });

const THEMES = Object.keys(
  JSON.parse(
    readFileSync(
      resolve(here, "../../../../apps/desktop/src/tokens/design-tokens.json"),
      "utf8",
    ),
  ).themes,
).filter((k) => k !== "note");
const APPEARANCES = ["light", "dark"];

const browser = await webkit.launch();

const setAxes = (page, theme, appearance) =>
  page.evaluate(
    ([theme, appearance]) => {
      document.documentElement.dataset.lcTheme = theme;
      document.documentElement.dataset.theme = appearance;
    },
    [theme, appearance],
  );

/* Board: every preset × appearance, fixed viewport. */
{
  const page = await browser.newPage({
    viewport: { width: 1400, height: 860 },
  });
  await page.goto(pathToFileURL(resolve(proof, "board.html")).href);
  await page.waitForLoadState("networkidle");
  for (const theme of THEMES) {
    for (const appearance of APPEARANCES) {
      await setAxes(page, theme, appearance);
      await page.screenshot({
        path: `${out}/board-${theme}-${appearance}.png`,
        animations: "disabled",
      });
      console.log(`board-${theme}-${appearance}.png`);
    }
  }
  await page.close();
}

/* Library: the two spot-checks, full page. */
{
  const page = await browser.newPage({
    viewport: { width: 1200, height: 900 },
  });
  await page.goto(pathToFileURL(resolve(proof, "components-library.html")).href);
  await page.waitForLoadState("networkidle");
  for (const [theme, appearance] of [
    ["indigo", "light"],
    ["clay", "dark"],
  ]) {
    await setAxes(page, theme, appearance);
    await page.screenshot({
      path: `${out}/library-${theme}-${appearance}.png`,
      fullPage: true,
      animations: "disabled",
    });
    console.log(`library-${theme}-${appearance}.png`);
  }
  await page.close();
}

await browser.close();
console.log(`renders written to ${out}`);
