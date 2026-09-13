#!/usr/bin/env node
/**
 * The CLI-demo guard: the command the install offer demonstrates is a command
 * the CLI actually has (LC-249a).
 *
 * The offer's whole argument is a terminal block showing one real command. It
 * is the reason a person presses the button, and it is the one piece of copy in
 * the app that makes a **claim about another program** — one that lives on the
 * far side of the IPC, in another language, with no type between them. The
 * imported Claude Design canvas drew `longclaw list --status todo`, which is
 * fiction twice over: the verb is `ticket list`, and it takes no `--status`.
 * That is not a careless mistake, it is the *default* outcome — a designer, or
 * an agent, writing a plausible command against a CLI they cannot run.
 *
 * A trust-building block demonstrating a command that does not exist inverts
 * the first time somebody runs it, and nothing in the build could see it: the
 * vitest suite renders whatever string it is handed, `tsc` has no opinion about
 * the contents of a string literal, and `cargo test` never reads `src/`.
 *
 * So this reads both ends. `cli.rs` compiles its own `USAGE` into the binary —
 * the one description of that surface which cannot go stale — and this holds
 * the demo to it:
 *
 *   1. The line opens on the command's own name, read from `COMMAND_NAME` in
 *      `platform/command_line.rs` rather than from the word `longclaw` typed
 *      into this script.
 *   2. Its verb is a verb `USAGE` lists. `ticket list` is two words and so is
 *      `project init`, so the match is against the usage line's own leading
 *      words rather than against a single token.
 *   3. Every `--flag` in the demo is one that verb is given. This is the half
 *      that catches `--status todo` on a `list` that has no `--status`, which
 *      is exactly what the design drew.
 *   4. The demo module is the only place the string lives. A second spelling in
 *      the component is the drift a constant exists to prevent, and it would
 *      leave this guard checking a string nothing renders.
 *
 * What it deliberately does not check is the **output**. `ticket list` prints
 * pretty-printed JSON of every ticket in the project, so the two lines in the
 * block are a knowing abbreviation, labelled `example` in its own caption
 * rather than presented as a transcript. A guard demanding they match real
 * output would be demanding the block be something it has already decided not
 * to be.
 *
 * Usage: node scripts/cli-demo-guard.mjs             (exits non-zero on a finding)
 *        node scripts/cli-demo-guard.mjs --self-test (expects every check to fail)
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { report } from "./guard.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "../src");
const rust = resolve(here, "../src-tauri/src");

const selfTest = process.argv.includes("--self-test");

const read = (from, file) => readFileSync(resolve(from, file), "utf8");

/** What Rust says the command is called, rather than what this script assumes. */
const commandName = read(rust, "platform/command_line.rs").match(
  /COMMAND_NAME: &str = "([^"]+)"/,
)?.[1];

/** The demonstrated line, read from the constant the component renders. */
const declared = read(src, "commandLineDemo.ts").match(
  /DEMO_COMMAND = "([^"]+)"/,
)?.[1];

const usage = read(rust, "cli.rs").match(
  /const USAGE: &str = "\\\n([\s\S]*?)\n";/,
)?.[1];

/**
 * `USAGE`'s command lines, as `{ verb, flags }`.
 *
 * Only the sections that list commands are read. The rest of the text is prose
 * at the same indent — `PROPERTIES` is three sentences beginning with the word
 * `type` — and a parser that took every indented lower-case line would report a
 * demo against a vocabulary of half-sentences.
 *
 * The vocabulary rows inside `TICKETS` (`status  backlog | todo | …`) are not
 * commands either, and the thing that separates them is not their alternatives
 * — `ticket create` lists two of those inside a bracket — but that a command
 * always names at least one argument or flag, in `<>` or `[]`, and a vocabulary
 * names none. A verb's own flags run on across the wrapped continuation lines,
 * so they are gathered until the next command rather than from one line, and
 * the flags under `ATTRIBUTION` belong to every command rather than to the last
 * one parsed.
 */
function usageCommands(text) {
  const COMMAND_SECTIONS = new Set(["PROJECT", "TICKETS"]);
  const flagsIn = (line) =>
    [...line.matchAll(/--[a-z][\w-]*/g)].map(([f]) => f);
  const commands = [];
  const everywhere = [];
  let section = "";
  for (const line of text.split("\n")) {
    if (/^[A-Z][A-Z ]*$/.test(line)) {
      section = line.trim();
      continue;
    }
    if (section === "ATTRIBUTION") {
      everywhere.push(...flagsIn(line));
      continue;
    }
    if (!COMMAND_SECTIONS.has(section)) continue;
    // A verb is one or two lower-case words, ended by the gap before its
    // arguments: two or more spaces, ` <`, ` [`, or the end of the line.
    const started = /^ {2}([a-z][\w-]*(?: [a-z][\w-]*)?)(?=\s{2,}| <| \[)/.exec(
      line,
    );
    // A command names something it takes; a vocabulary row names alternatives.
    const takesSomething = /[<[]/.test(line);
    if (started && takesSomething) {
      commands.push({ verb: started[1], flags: flagsIn(line) });
    } else if (!started && commands.length > 0) {
      commands[commands.length - 1].flags.push(...flagsIn(line));
    }
  }
  for (const command of commands) command.flags.push(...everywhere);
  return commands;
}

const commands = usage ? usageCommands(usage) : [];

if (!commandName || !declared || commands.length === 0) {
  console.error(
    "cli-demo-guard: could not read one of its two ends — " +
      `COMMAND_NAME ${commandName ? "found" : "missing"}, ` +
      `DEMO_COMMAND ${declared ? "found" : "missing"}, ` +
      `${commands.length} usage commands parsed`,
  );
  process.exit(1);
}

/* Under `--self-test` both ends are perturbed rather than one: the demo becomes
   the design's fictional line, which misses the name, the verb and the flag at
   once, and the component is given the literal the constant exists to keep out
   of it. A self-test that only broke the demo would leave the fourth check
   passing and prove nothing about it. */
const demo = selfTest ? "longclue list --status todo" : declared;
const component = selfTest
  ? `${read(src, "CommandLineInstall.tsx")}\nconst drifted = "${declared}";`
  : read(src, "CommandLineInstall.tsx");

const findings = [];
let checked = 0;

/** Records one check, and inverts its verdict under `--self-test`. */
function must(passed, finding) {
  checked += 1;
  if (passed !== selfTest) return;
  findings.push(
    selfTest ? `${finding} — did not fail under --self-test` : finding,
  );
}

const words = demo.split(/\s+/);
const rest = words.slice(1);

/* 1 — the name. */
must(
  words[0] === commandName,
  `the demo opens on \`${words[0]}\`, and the command is called \`${commandName}\` ` +
    "(`platform/command_line.rs` — COMMAND_NAME)",
);

/* 2 — the verb. Longest first, so `ticket list` wins over a bare `ticket`. */
const matched = [...commands]
  .sort((a, b) => b.verb.split(" ").length - a.verb.split(" ").length)
  .find((command) =>
    command.verb.split(" ").every((part, at) => rest[at] === part),
  );
must(
  matched !== undefined,
  `\`${rest.join(" ")}\` is not a command \`cli.rs\` dispatches — ` +
    `usage lists ${commands.map((one) => `\`${one.verb}\``).join(", ")}`,
);

/* 3 — the flags. A demo with none still counts as checked, so a real run does
   not read as a narrower run than the inverted one. */
const used = [...demo.matchAll(/--[a-z][\w-]*/g)].map(([flag]) => flag);
if (used.length === 0) checked += 1;
for (const flag of used) {
  must(
    matched?.flags.includes(flag) === true,
    `\`${matched?.verb ?? rest.join(" ")}\` takes no \`${flag}\`, and the demo uses it`,
  );
}

/* 4 — one spelling. The component renders the constant; a literal beside it is
   the drift the constant exists to prevent. */
must(
  !component.includes(`"${declared}"`) &&
    !component.includes(`\`${declared}\``),
  `\`CommandLineInstall.tsx\` spells out \`${declared}\` as a literal — ` +
    "it should render `DEMO_COMMAND`, which is the string this guard checks",
);

if (selfTest) {
  if (findings.length > 0) {
    console.error(
      `cli-demo-guard --self-test: \`${demo}\` still passed ${findings.length} of ` +
        `${checked} checks — the guard is blind there\n` +
        findings.map((finding) => `  ${finding}`).join("\n"),
    );
    process.exit(1);
  }
  console.log(
    `cli-demo-guard --self-test: the design's own \`${demo}\` is caught on ` +
      `every one of ${checked} checks`,
  );
  process.exit(0);
}

report({
  name: "cli-demo-guard",
  findings,
  checked,
  noun: "claims",
  remedy: "claims the offer's demo makes that `cli.rs` does not support:",
  clean: `\`${demo}\` is a command the CLI has`,
});
