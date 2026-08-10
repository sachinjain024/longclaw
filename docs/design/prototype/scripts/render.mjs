/* Regenerates ../renders/ from prototype.html.
 * Usage: node scripts/render.mjs   (from docs/design/prototype)
 *
 * Drives WebKit through `playwright-core`, resolved out of `apps/desktop` —
 * the same engine and the same resolution the foundations pipeline uses
 * (../../foundations/scripts/render.mjs), and the engine the product actually
 * ships in, since Tauri renders through WKWebView on macOS.
 *
 * It used to import full `playwright` and launch `channel: "chrome"`, neither
 * of which is installed in this repo — so the committed renders could not be
 * regenerated at all, and LC-192 found them eleven weeks stale, still showing
 * accents the design system had retired. A pipeline that cannot run is not a
 * pipeline; it is a screenshot with a script next to it.
 */
import { mkdirSync } from "fs";
import { createRequire } from "module";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(
  resolve(here, "../../../../apps/desktop/package.json"),
);
const { webkit } = require("playwright-core");

const url = "file://" + resolve(here, "../prototype.html");
const out = resolve(here, "../renders");
mkdirSync(out, { recursive: true });

const browser = await webkit.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const shot = (name) => page.screenshot({ path: `${out}/${name}.png` });
const set = async (theme, appearance) => {
  await page.click(`[data-action="drv-theme"][data-value="${theme}"]`);
  await page.click(`[data-action="drv-appearance"][data-value="${appearance}"]`);
  await page.waitForTimeout(350);
};

await page.goto(url);
await page.waitForTimeout(700);

/* board — indigo + clay spot-check, both appearances */
for (const [theme, appearance] of [["indigo", "light"], ["indigo", "dark"], ["clay", "light"], ["clay", "dark"]]) {
  await set(theme, appearance);
  await shot(`board-${theme}-${appearance}`);
}

/* ticket panel — indigo light + clay dark */
await set("indigo", "light");
await page.click('[data-fkey="card:LC-128"]');
await page.waitForTimeout(350);
await shot("panel-indigo-light");
await set("clay", "dark");
await shot("panel-clay-dark");
await page.keyboard.press("Escape");

/* agent round-trip moment — indigo light */
await set("indigo", "light");
await page.click('[data-action="drv-agent"]');
await page.waitForTimeout(6800);
await shot("agent-acknowledged-indigo-light");

/* conflict banner */
await page.click('[data-action="drv-conflict"]');
await page.waitForTimeout(2100);
await shot("conflict-indigo-light");
await page.keyboard.press("Escape");
await page.keyboard.press("Escape");

/* degraded + raw file view */
await page.click('[data-action="drv-corrupt"]');
await page.waitForTimeout(300);
const raw = await page.$('[data-action="open-raw"]');
if (raw) { await raw.click(); await page.waitForTimeout(300); }
await shot("raw-file-indigo-light");
await page.click('[data-action="raw-retry"]');

/* welcome (first launch) */
await page.click('[data-action="drv-reset"]');
await page.waitForTimeout(300);
await shot("welcome-indigo-light");

await browser.close();
console.log("renders written to", out);
