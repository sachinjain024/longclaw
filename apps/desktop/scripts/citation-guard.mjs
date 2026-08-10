#!/usr/bin/env node
/**
 * The design docs are cited by line number from ~400 places, and nothing until
 * now noticed when those lines moved.
 *
 * `screen-specs.md` closes by asking that edits occupy exactly the lines they
 * replace, because the app's own source comments name its lines. Three changes
 * ignored it — the ADR propagation, LC-73's sidebar rewrite, LC-188's new
 * section — and each shifted everything below its insertion. The citations did
 * not move with it, so `RawFileView.tsx` came to point at the board's empty
 * state and `yaml.rs` at a blank line. Nobody noticed for months: a stale line
 * number reads exactly like a fresh one, and no test loads a Markdown file.
 * This is the discipline that note asks for, enforced rather than requested.
 *
 * Every cited line's text is recorded in `citation-lock.json`, and the guard
 * fails when the text at that number changes. That catches drift the moment it
 * happens — insert a line anywhere above a citation and every citation below it
 * goes red, naming where its text actually went.
 *
 * **Pinning is something you do after auditing, not instead of it.** The lock
 * freezes whatever it is handed, mistakes included, so a document pinned while
 * its citations are still wrong just holds them still and prints "clean" over
 * them. Each of the six was audited first: every citation resolved against the
 * document as it stood when that citing line was written, which is the only way
 * to tell a number that was always wrong from one the document walked out from
 * under. That distinction earned its keep — a citing line reformatted after its
 * citation was written makes blame read an already-drifted document, and
 * several citations turned out to have been wrong on the day they were typed.
 * `ThemeSwatch.tsx` named the conflict-banner states while talking about theme
 * swatches; three places cited the focus-return table for the rule that
 * reordering has no keyboard path.
 *
 * A seventh document would take the same route: audit, add to `DOCUMENTS` and
 * `PINNED`, `--update`. Until it is audited it belongs in neither — an unlocked
 * document still gets the structural checks (in range, not reversed), which
 * need no baseline and cannot cement an error.
 *
 * `--update` rewrites the lock from the current documents. It is for when you
 * changed a pinned document's *wording* and have already re-pointed whatever
 * cited it; it is not a way to make a red run go away, since it will happily
 * record drift as the new truth.
 *
 * `--self-test` shifts a pinned document by one line and fails if the guard
 * still passes. Two of the a11y probes were blind when they were written, so
 * this one states its own liveness rather than being trusted.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { filesUnder, report } from "./guard.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../..");
const lockPath = resolve(here, "citation-lock.json");

/** Cited by line number, and checked for it. Paths are repo-relative. */
const DOCUMENTS = {
  "screen-specs.md": "docs/design/prototype/screen-specs.md",
  "keyboard-focus-map.md": "docs/design/prototype/keyboard-focus-map.md",
  "components.md": "docs/design/foundations/components.md",
  "states.md": "docs/design/prototype/states.md",
  "file_format.md": "docs/file_format.md",
  "data-requirements.md": "docs/design/prototype/data-requirements.md",
};

/**
 * The documents whose cited lines are pinned to their text — every document in
 * `DOCUMENTS`, now that all six have been audited. See the header before adding
 * a seventh: pinning an unaudited document freezes its mistakes.
 */
const PINNED = Object.keys(DOCUMENTS);

/**
 * Where citations are read from: the shipping tree, the guards and probes that
 * cite specs in their own comments, and the two planning documents that are
 * still live. Ticket files, completed plans and `cc_screens_diff.md` are dated
 * records of what was true when they were written — their line numbers are part
 * of the record, not a reference to maintain.
 */
const SOURCES = [
  ["apps/desktop/src", /\.(ts|tsx|css)$/],
  ["apps/desktop/scripts", /\.mjs$/],
  ["apps/desktop/perf", /\.mjs$/],
  ["apps/desktop/src-tauri/src", /\.rs$/],
  ["apps/desktop/src-tauri/tests", /\.rs$/],
  ["docs/plans/active", /\.md$/],
  ["docs/backlog", /\.md$/],
];

/**
 * `doc.md:12`, `doc.md:12-14`, and the comma form `doc.md:16-18,131,161` — one
 * citation naming several places at once, which the a11y audit's oracles use.
 * The comma form is the one that hides: matching only its first number leaves
 * every number after the comma unguarded, which is exactly where four stale
 * references were still sitting after the ranges around them were repaired.
 */
const CITATION = /([A-Za-z0-9_-]+\.md):(\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*)/g;

const collapse = (line) => line.split(/\s+/).filter(Boolean).join(" ");

function documentLines(name) {
  return readFileSync(resolve(repo, DOCUMENTS[name]), "utf8").split("\n");
}

/** Every citation in the scanned tree, one entry per span, in file order. */
function citations() {
  const found = [];
  for (const [dir, match] of SOURCES) {
    for (const file of filesUnder(resolve(repo, dir), match)) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((text, index) => {
        for (const [, doc, spans] of text.matchAll(CITATION)) {
          if (!DOCUMENTS[doc]) continue;
          for (const span of spans.split(",")) {
            const [from, to] = span.split("-");
            found.push({
              where: `${relative(repo, file)}:${index + 1}`,
              doc,
              start: Number(from),
              end: to ? Number(to) : Number(from),
              cited: `${doc}:${span}`,
            });
          }
        }
      });
    }
  }
  return found;
}

/** `{ doc: { line: text } }` for every line any citation names in a pinned doc. */
function buildLock(all) {
  const lock = {};
  for (const name of PINNED) {
    const lines = documentLines(name);
    const pinned = {};
    for (const one of all.filter((c) => c.doc === name)) {
      for (const number of [one.start, one.end]) {
        if (number >= 1 && number <= lines.length) {
          pinned[number] = collapse(lines[number - 1]);
        }
      }
    }
    lock[name] = Object.fromEntries(
      Object.keys(pinned)
        .map(Number)
        .sort((a, b) => a - b)
        .map((number) => [number, pinned[number]]),
    );
  }
  return lock;
}

/**
 * The findings, given the documents as they are now. `override` swaps a
 * document's lines for the self-test, which is the only caller that passes it.
 */
function check(all, lock, override = {}) {
  const findings = [];
  const cache = {};
  const linesOf = (name) =>
    (cache[name] ??= override[name] ?? documentLines(name));

  for (const one of all) {
    const lines = linesOf(one.doc);
    if (one.end < one.start) {
      findings.push(
        `${one.where} cites ${one.cited} — the range runs backwards`,
      );
      continue;
    }
    if (one.start < 1 || one.end > lines.length) {
      findings.push(
        `${one.where} cites ${one.cited} — ${one.doc} has ${lines.length} lines`,
      );
      continue;
    }
    if (!PINNED.includes(one.doc)) continue;

    const expected = lock[one.doc] ?? {};
    for (const number of [one.start, one.end]) {
      const want = expected[number];
      if (want === undefined) {
        findings.push(
          `${one.where} cites ${one.cited} — line ${number} is not in the lock; run --update`,
        );
        continue;
      }
      const actual = collapse(lines[number - 1]);
      if (actual === want) continue;
      const movedTo = lines.findIndex((line) => collapse(line) === want) + 1;
      findings.push(
        `${one.where} cites ${one.cited} — ${one.doc}:${number} now reads ` +
          `"${actual.slice(0, 60)}"` +
          (movedTo > 0
            ? `; what it cited is at :${movedTo}`
            : "; what it cited is gone"),
      );
    }
  }
  return [...new Set(findings)];
}

const all = citations();

if (process.argv.includes("--update")) {
  writeFileSync(lockPath, `${JSON.stringify(buildLock(all), null, 2)}\n`);
  const pinned = PINNED.map(
    (name) => `${name} (${all.filter((c) => c.doc === name).length} citations)`,
  ).join(", ");
  console.log(`citation-guard: lock rewritten from ${pinned}`);
  process.exit(0);
}

const lock = JSON.parse(readFileSync(lockPath, "utf8"));

if (process.argv.includes("--self-test")) {
  // One line inserted at the top of a pinned document is the exact defect this
  // guard exists for: every citation below it now names the wrong line. Each
  // pinned document is shifted in turn, because a lock that had silently lost
  // one of them would still pass a test that only ever shifted the first.
  const blind = [];
  const caught = [];
  for (const name of PINNED) {
    const shifted = { [name]: ["", ...documentLines(name)] };
    const findings = check(all, lock, shifted);
    if (findings.length === 0) blind.push(name);
    else caught.push(`${name} ${findings.length}`);
  }
  if (blind.length > 0) {
    console.error(
      `citation-guard --self-test: shifting ${blind.join(", ")} still passed — the guard is blind there`,
    );
    process.exit(1);
  }
  console.log(
    `citation-guard --self-test: a one-line shift is caught in each pinned document (${caught.join(", ")} findings)`,
  );
  process.exit(0);
}

report({
  name: "citation-guard",
  findings: check(all, lock),
  checked: all.length,
  noun: "citations",
  remedy: `citation(s) name a line the document no longer has there`,
  clean: `every cited line is in range, and ${PINNED.length} pinned documents still read as their citations say`,
});
