#!/usr/bin/env node
/**
 * Screenshots the board in every theme and appearance the board renders in, so a
 * change to how the board is laid out can be diffed against how it looked
 * before. Written next to `docs/design/prototype/renders/`, which is the
 * reference the diff is judged against.
 *
 *   node perf/board-shots.mjs <output-directory> [--tickets=24]
 */

import { mkdirSync } from "node:fs";
import { webkit } from "playwright-core";

import { startPreview } from "./preview-server.mjs";

const out = process.argv[2];
if (!out)
  throw new Error("usage: node perf/board-shots.mjs <output-directory>");
mkdirSync(out, { recursive: true });

const size = Number(
  process.argv.find((value) => value.startsWith("--tickets="))?.slice(10) ?? 24,
);

const preview = await startPreview();

const browser = await webkit.launch();
try {
  for (const theme of ["indigo", "clay"]) {
    for (const appearance of ["light", "dark"]) {
      const page = await browser.newPage({
        viewport: { width: 1_440, height: 900 },
      });
      await page.goto(`${preview.origin}/?tickets=${size}`);
      await page.waitForFunction(
        () => document.querySelectorAll(".ticket-row").length > 0,
      );
      await page.evaluate(
        ([theme, appearance]) => {
          document.documentElement.dataset.theme = theme;
          document.documentElement.dataset.appearance = appearance;
        },
        [theme, appearance],
      );

      // One card wearing an unreviewed agent change, because the acknowledgement
      // is the treatment most at risk from a column that recycles rows.
      await page.evaluate(() => {
        const key =
          document
            .querySelector(".ticket-row")
            ?.getAttribute("data-ticket-key") ?? "";
        const sequence = Number(key.replace("PF-", ""));
        window.__longclawPerf.emit({
          contractVersion: 1,
          sequence: 1,
          projectId: "019c8ca0-0000-7000-8000-0000000000ff",
          emittedAt: "2026-07-31T00:00:00Z",
          event: {
            type: "ticketChanged",
            data: {
              source: "external",
              coalescedEvents: 1,
              detectedInMs: 1,
              attribution: {
                id: "evt_1",
                kind: "update",
                occurredAt: "2026-07-31T00:00:00Z",
                actor: { type: "agent", name: "Claude Code" },
              },
              ticket: {
                state: "indexed",
                key,
                id: `perf-${sequence}`,
                title: `Searchable storage ticket ${sequence}`,
                status: "backlog",
                priority: "none",
                labels: ["storage"],
                createdAt: "2026-07-29T00:00:00Z",
                updatedAt: "2026-07-31T00:00:00Z",
                checkedCount: 0,
                checklistCount: 1,
                commentCount: 0,
                attachmentCount: 0,
                contentHash: "hash-shot",
                relativePath: `.longclaw/tickets/${key}/ticket.md`,
              },
            },
          },
        });
      });
      await page.waitForTimeout(1_200); // Let the two-beat pulse finish.
      // The acknowledgement is the whole point of the shot; a run that quietly
      // lost it would compare two boards that are not the same board.
      await page.waitForSelector(".ticket-row.acknowledged", {
        timeout: 5_000,
      });

      // A fixed viewport rather than the full page, so two builds always produce
      // images of the same size and can be compared pixel for pixel.
      await page.screenshot({
        path: `${out}/board-${theme}-${appearance}.png`,
        animations: "disabled",
      });
      await page.close();
    }
  }
  console.log(`wrote 4 board renders to ${out}`);
} finally {
  await browser.close();
  await preview.close();
}
