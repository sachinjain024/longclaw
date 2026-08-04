#!/usr/bin/env node
/**
 * The half of the release audit that reads the compiled artefact (Step 16b).
 *
 * `release-audit.mjs` reads what the build is *declared* to contain — manifests,
 * the host dependency graph, the capability file, the CSP. This reads what the
 * shipped binary actually is: which symbols the linker kept, and which system
 * libraries it loads. Those are different questions, and Step 16b's checklist
 * claimed a "binary/package audit" while only ever asking the first one.
 *
 * It is a separate script, and deliberately not in `npm run check`, because it
 * needs a release bundle that only `npm run build:app` produces. A check that
 * skipped whenever the artefact was missing would be a check that never ran.
 *
 * **The controls are the point.** A grep for absent symbols passes trivially
 * against a binary it failed to read, a stripped binary, or the wrong path — the
 * same way the Step 16a matrix once passed a contrast check it could not see.
 * So the probe asserts what must be *present* before believing anything about
 * what is absent: a plausible symbol count, and three symbols this app cannot
 * work without. If the controls fail, the run fails, whatever the forbidden list
 * says.
 *
 * **What this cannot prove.** WebKit is linked and is network-capable by
 * construction; no symbol table will tell you what the webview does. The CSP
 * `connect-src` restriction is what bounds that, and the process-monitor pass in
 * `docs/acceptance/release-candidate.md` is what verifies it. A pass here means
 * the Rust side links no HTTP client and calls no socket API. It does not mean
 * the app made no connection.
 *
 * Usage: node scripts/binary-audit.mjs   (exits non-zero on any finding)
 */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { report } from "./guard.mjs";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BINARY = join(
  appRoot,
  "src-tauri/target/release/bundle/macos/LongClaw.app/Contents/MacOS/longclaw-desktop",
);

const findings = [];
const fail = (message) => findings.push(message);

const run = (command, args) =>
  execFileSync(command, args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });

if (!existsSync(BINARY)) {
  console.error(
    `binary-audit: no release binary at\n  ${BINARY}\nRun npm run build:app first — this audit reads the shipped artefact.`,
  );
  process.exit(1);
}

const symbols = run("nm", ["-a", BINARY]);
const undefined_ = run("nm", ["-u", BINARY])
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean);
const libraries = run("otool", ["-L", BINARY])
  .split("\n")
  .slice(1)
  .map((line) => line.trim().replace(/\s*\(.*/, ""))
  .filter(Boolean);

// Controls first. Everything below is an absence claim, and an absence claim is
// only worth what the reading is worth.
if (undefined_.length < 50) {
  fail(
    `only ${undefined_.length} undefined symbols: the symbol table did not read as expected, so no absence below is trustworthy`,
  );
}
for (const control of ["_open", "_stat", "_FSEventStreamCreate"]) {
  if (!undefined_.some((symbol) => symbol === control)) {
    fail(
      `control symbol ${control} is missing: this app opens files and watches them, so the probe is not reading what it thinks it is`,
    );
  }
}
if (!libraries.some((library) => library.includes("WebKit"))) {
  fail(
    "control: WebKit is not linked, which a Tauri app cannot be — the binary read is wrong",
  );
}

for (const marker of [
  "reqwest",
  "hyper_util",
  "rustls",
  "native_tls",
  "h2::",
  "sentry",
]) {
  if (symbols.includes(marker)) {
    fail(`network or telemetry symbols linked into the binary: ${marker}`);
  }
}

// The Rust side reaches the network through libSystem or not at all. These are
// the imports it would need; none of them is used by local file work.
for (const stub of ["_connect", "_socket", "_sendto", "_getaddrinfo"]) {
  if (undefined_.some((symbol) => symbol === stub)) {
    fail(`the binary imports the socket API: ${stub}`);
  }
}

for (const framework of [
  "CFNetwork",
  "Network.framework",
  "Security.framework",
]) {
  if (libraries.some((library) => library.includes(framework))) {
    fail(`a network-capable system framework is linked: ${framework}`);
  }
}

report({
  name: "binary-audit",
  findings,
  checked: undefined_.length,
  noun: `imported symbols and ${libraries.length} linked libraries`,
  remedy:
    "finding(s) in the shipped binary — the v0 boundary is docs/acceptance/release-candidate.md:",
  clean:
    "no HTTP client, telemetry, socket import, or network framework in the shipped binary (controls passed; the webview is out of scope and stays a manual pass)",
});
