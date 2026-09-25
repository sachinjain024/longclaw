#!/usr/bin/env node
/**
 * The README's hero image, rendered from the site's own product window.
 *
 * GitHub strips `<style>`, `class` and `style` from README HTML, so the
 * token-driven `AppWindow` that longclaw.io draws cannot render there live. This
 * renders it instead: it serves the built site, opens the home page in WebKit at
 * 2×, puts the hero tour on its Board stage with motion off, and captures the
 * window alone in the light appearance. Light only, on purpose: at README size
 * the dark render's secondary text is too faint to read, and the light window
 * reads well on GitHub's dark theme too.
 *
 * That makes it the one raster of the product in the repository, and a
 * deliberate exception to the site's no-raster rule (see this package's README).
 * It is generated, never hand-taken, so it cannot drift from the site — rerun it
 * whenever `components/product/` or the tokens change:
 *
 *   npm run readme:hero
 *
 * `playwright-core` is resolved from `apps/desktop`, which already carries it
 * for the perf harnesses, rather than added to this package's lockfile for one
 * script. Run `npm --prefix apps/desktop ci` first if it is missing.
 */
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const dist = resolve(here, '../dist');
const repo = resolve(here, '../../..');
const out = join(repo, 'assets/readme');

const require = createRequire(join(repo, 'apps/desktop/package.json'));
const { webkit } = require('playwright-core');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
};

async function serve() {
  await stat(join(dist, 'index.html')).catch(() => {
    throw new Error(`No built site at ${dist}. Run \`npm run site:build\` first.`);
  });
  const server = createServer(async (req, res) => {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path.endsWith('/')) path += 'index.html';
    try {
      const body = await readFile(join(dist, path));
      res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  return server;
}

const server = await serve();
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await webkit.launch();

try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
    deviceScaleFactor: 2,
    colorScheme: 'light',
    reducedMotion: 'reduce',
  });
  await page.goto(`${origin}/`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);

  // The tour opens on Projects; the board is what the README is about.
  await page.click('[data-stage-pill="board"]');
  const win = page.locator('[data-hero-tour] [data-appwin]');
  if ((await win.getAttribute('data-stage')) !== 'board') {
    throw new Error('The hero window did not move to the Board stage.');
  }
  // Let the stage swap settle; reduced motion makes it near-instant.
  await page.waitForTimeout(300);

  // One image serves GitHub's light and dark themes, so the page behind the
  // window's rounded corners must not be captured with it.
  await win.evaluate((el) => {
    for (let node = el.parentElement; node; node = node.parentElement) {
      node.style.setProperty('background', 'transparent', 'important');
    }
  });

  const file = join(out, 'hero.png');
  await win.screenshot({ path: file, omitBackground: true });
  console.log(`wrote ${file}`);
} finally {
  await browser.close();
  server.close();
}
