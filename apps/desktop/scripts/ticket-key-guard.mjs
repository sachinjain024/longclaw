#!/usr/bin/env node
/**
 * The ticket-key collision guard (LC-232).
 *
 * Ticket keys are allocated from the directories in one working tree, so a
 * branch, a `git worktree`, a second clone or a cloud agent that does not carry
 * a sibling's ticket reads a lower maximum and mints the same key again. The
 * trailing character makes that rare — two branches that agree on the number
 * differ on the letter 23 times out of 24 — but it does not make it impossible,
 * and the 24th time is what this reads for.
 *
 * The loud case needs no guard: two directories on one path is an add/add
 * conflict and git raises it. The quiet case is the *resolution* — someone takes
 * one side, or renames a folder to keep both, and what is left on disk is a
 * ticket directory whose `key` field names a different key than its folder does.
 * The app refuses to parse that file, so it drops out of the board silently, one
 * degraded row among the ordinary ones.
 *
 * Two findings, which are the two shapes that resolution leaves behind:
 *
 *   1. **A key field that disagrees with its directory.** The format contract
 *      makes the directory name and the frontmatter key one identity
 *      (`file_format.md:223`), and `TicketDocument::parse` enforces it — so this
 *      is a ticket nothing can read, in a repository where `npm test` is green.
 *   2. **Two directories claiming one key.** The surviving half of a collision
 *      that was resolved by renaming a folder rather than by renumbering the
 *      ticket. Every reference to that key is now ambiguous about which of the
 *      two it meant.
 *
 * The remedy for both is `longclaw ticket renumber <KEY> --id <uuid>`, which
 * moves the directory and rewrites the field together and then reports every
 * path that still names the old key.
 *
 * This reads the repository's own ticket store, which is the one LongClaw
 * project every agent working here writes to. A checkout with no `.longclaw/`
 * passes with nothing checked rather than failing: a guard that cannot run is
 * not a finding.
 *
 * Usage: node scripts/ticket-key-guard.mjs               (non-zero on a finding)
 *        node scripts/ticket-key-guard.mjs --self-test   (plants both defects
 *                                                         and fails if either
 *                                                         goes unreported)
 */

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { report } from "./guard.mjs";

const repo = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  cwd: dirname(fileURLToPath(import.meta.url)),
  encoding: "utf8",
}).trim();

/**
 * The `key` a ticket file claims, or null when the file has no frontmatter this
 * can read.
 *
 * A line scan of the frontmatter rather than a YAML parse: the question is which
 * key the file names, an unparseable file is the app's finding rather than this
 * one's, and a guard that needs a dependency to run is a guard that stops being
 * run.
 */
function claimedKey(file) {
  const lines = readFileSync(file, "utf8").split("\n");
  if (lines[0] !== "---") return null;
  for (const line of lines.slice(1)) {
    if (line === "---") break;
    const match = /^key:\s*(?:"([^"]*)"|'([^']*)'|(\S+))\s*$/.exec(line);
    if (match) return match[1] ?? match[2] ?? match[3];
  }
  return null;
}

/** `{ findings, checked, unreadable }` for one `.longclaw/tickets` directory. */
function scan(tickets, base) {
  const findings = [];
  let unreadable = 0;
  const directories = existsSync(tickets)
    ? readdirSync(tickets)
        .filter((entry) => statSync(join(tickets, entry)).isDirectory())
        .sort()
    : [];
  /** Every directory that named a given key, so a duplicate can name both. */
  const claimants = new Map();

  for (const directory of directories) {
    const file = join(tickets, directory, "ticket.md");
    if (!existsSync(file)) continue;
    const key = claimedKey(file);
    const where = relative(base, file);
    if (key === null) {
      // Not this guard's finding. A ticket file with no readable key field is a
      // file the app already shows as a degraded row with its own diagnostic,
      // and failing `verify` on it would make this guard the reporter of every
      // malformed ticket rather than of the one thing it was written for. It is
      // counted so the pass line never implies it was read.
      unreadable += 1;
      continue;
    }
    if (key !== directory) {
      findings.push(
        `${where} claims key ${key} but its directory is named ${directory} — ` +
          `the app refuses to parse this file, so the ticket is invisible on the board`,
      );
    }
    claimants.set(key, [...(claimants.get(key) ?? []), directory]);
  }

  for (const [key, holders] of [...claimants].sort()) {
    if (holders.length > 1) {
      findings.push(
        `${holders.length} ticket directories claim key ${key}: ${holders.join(", ")} — ` +
          `every reference to ${key} is ambiguous about which of them it means`,
      );
    }
  }
  return { findings, checked: directories.length, unreadable };
}

/**
 * The red half, run rather than remembered: a store carrying both defects must
 * report both. A guard nobody has watched fail is a guard nobody knows still
 * reads anything — two of the first `a11y:audit` probes were blind.
 */
function selfTest() {
  const base = mkdtempSync(join(tmpdir(), "ticket-key-guard-"));
  const tickets = join(base, ".longclaw/tickets");
  const write = (directory, key) => {
    mkdirSync(join(tickets, directory), { recursive: true });
    writeFileSync(
      join(tickets, directory, "ticket.md"),
      `---\nformat: longclaw.ticket/v1\nkey: ${key}\ntitle: Planted\n---\n`,
    );
  };
  try {
    write("LC-1", "LC-1");
    write("LC-2q", "LC-2q");
    // Defect one: the folder was renamed and the field was not.
    write("LC-3w", "LC-3");
    // Defect two: two folders, one key.
    write("LC-4", "LC-4");
    write("LC-4b", "LC-4");
    const { findings } = scan(tickets, base);
    const missed = [
      ["a key field disagreeing with its directory", /claims key LC-3 /],
      [
        "two directories claiming one key",
        /2 ticket directories claim key LC-4/,
      ],
    ].filter(
      ([, pattern]) => !findings.some((finding) => pattern.test(finding)),
    );
    if (missed.length > 0) {
      console.error(
        `ticket-key-guard --self-test: ${missed.length} planted defects went unreported\n` +
          missed.map(([what]) => `  ${what}`).join("\n") +
          `\nwhat it did report:\n` +
          (findings.map((finding) => `  ${finding}`).join("\n") || "  nothing"),
      );
      process.exit(1);
    }
    console.log(
      `ticket-key-guard --self-test: both planted defects reported — the guard still reads the store`,
    );
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
}

if (process.argv.includes("--self-test")) {
  selfTest();
} else {
  const { findings, checked, unreadable } = scan(
    join(repo, ".longclaw/tickets"),
    repo,
  );
  report({
    name: "ticket-key-guard",
    findings,
    checked: checked - unreadable,
    noun: "ticket directories",
    remedy:
      "ticket key collisions. Re-key one side with `longclaw ticket renumber <KEY> --id <uuid>`, " +
      "which moves the directory and rewrites the field together and then reports every path that " +
      "still names the old key:",
    clean:
      "every key field agrees with its directory and no key is claimed twice" +
      (unreadable > 0
        ? ` (${unreadable} with no readable key field, which the app reports as degraded rows)`
        : ""),
  });
}
