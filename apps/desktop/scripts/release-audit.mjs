#!/usr/bin/env node
/**
 * The release privacy and filesystem audit (Step 16b).
 *
 * The v0 promise is that the app works with no account and no network, and
 * touches nothing outside the folder the user picked. Three parts of that are
 * declarative, so a gate can hold them instead of a reviewer: the dependencies
 * the app is built from, the capability and CSP the webview runs under, and the
 * calls the shipped source makes.
 *
 * Dependencies are checked twice, because "we did not ask for it" and "it is not
 * in the build" are different claims. `Cargo.toml` and `package.json` say what
 * was asked for. `cargo tree` says what the **macOS host target** actually
 * compiles, which is the one that ships — and it is the check that matters,
 * because `Cargo.lock` is target-agnostic and lists crates this platform never
 * builds. `reqwest` and `hyper` are in the lockfile today, arriving under Tauri,
 * and are absent from the host graph. Failing on the lockfile would fail on a
 * dependency macOS does not compile; failing on the host graph fails on one it
 * does.
 *
 * **`tauri-plugin-fs` is in the host graph and cannot be removed.** It is a
 * dependency of `tauri-plugin-dialog`, which is how the user picks a folder, so
 * filesystem-plugin code is compiled into the binary whether or not we want it.
 * What keeps it unreachable is the capability file: the webview is granted
 * `core:default`, `core:event:default` and `dialog:allow-open` and nothing else,
 * so no `fs:` command can be invoked. That permission set is pinned exactly
 * below, and it — not the dependency list — is the filesystem boundary. Deleting
 * that assertion would open the plugin without adding a dependency.
 *
 * What none of this sees is the compiled artefact. `scripts/binary-audit.mjs`
 * reads the built binary's symbols and linked frameworks; run it after
 * `build:app`. And neither can see the **webview**, which is network-capable by
 * construction — that is what the CSP `connect-src` restriction is for, and why
 * the process-monitor pass in `docs/acceptance/release-candidate.md` stays
 * manual and stays required.
 *
 * Config lists are compared as sets: a permission list means the same thing
 * shuffled, and failing a release build on key order is noise, not a finding.
 *
 * Usage: node scripts/release-audit.mjs   (exits non-zero on any finding)
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { filesUnder, readSource, report } from "./guard.mjs";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const findings = [];

function fail(message) {
  findings.push(message);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/** Record a finding unless `actual` holds exactly the `expected` values. */
function failUnlessSameSet(actual, expected, label) {
  const canonical = (list) => JSON.stringify([...list].sort());
  if (canonical(actual ?? []) !== canonical(expected)) {
    fail(
      `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

/** Record a finding for every `[pattern, label]` any of `files` matches. */
function failOnMatch(files, patterns) {
  for (const file of files) {
    const { path, text } = readSource(file);
    for (const [pattern, label] of patterns) {
      if (pattern.test(text)) fail(`${path} uses ${label}`);
    }
  }
}

const packageJson = readJson(join(appRoot, "package.json"));
const allNodeDeps = {
  ...packageJson.dependencies,
  ...packageJson.devDependencies,
};

for (const dep of [
  "@tauri-apps/plugin-fs",
  "@tauri-apps/plugin-http",
  "@tauri-apps/plugin-shell",
  "@tauri-apps/plugin-updater",
  "@sentry/browser",
  "@sentry/react",
  "posthog-js",
  "analytics",
  "amplitude-js",
  "segmentio",
]) {
  if (dep in allNodeDeps) fail(`forbidden direct npm dependency: ${dep}`);
}

const cargoToml = readFileSync(join(appRoot, "src-tauri/Cargo.toml"), "utf8");
for (const dep of [
  "tauri-plugin-fs",
  "tauri-plugin-http",
  "tauri-plugin-shell",
  "tauri-plugin-updater",
  "sentry",
  "reqwest",
  "ureq",
]) {
  const directDependency = new RegExp(`^${dep}\\s*=`, "m");
  if (directDependency.test(cargoToml))
    fail(`forbidden direct Cargo dependency: ${dep}`);
}

/**
 * Every crate the macOS host target compiles, names only.
 *
 * `--locked` so an audit cannot quietly re-resolve the lockfile it is auditing.
 * A cargo that will not run is a finding rather than a skip: an audit that
 * passes because it could not look is worse than one that fails.
 */
function hostGraphCrates() {
  try {
    const output = execFileSync(
      "cargo",
      ["tree", "--locked", "--edges", "normal", "--prefix", "none"],
      { cwd: join(appRoot, "src-tauri"), encoding: "utf8", stdio: "pipe" },
    );
    return new Set(
      output
        .split("\n")
        .map((line) => line.trim().split(" ")[0])
        .filter(Boolean),
    );
  } catch (error) {
    fail(`could not read the host dependency graph via cargo tree: ${error}`);
    return null;
  }
}

const hostGraph = hostGraphCrates();
if (hostGraph) {
  for (const crate of [
    "reqwest",
    "ureq",
    "hyper",
    "h2",
    "rustls",
    "native-tls",
    "sentry",
    "tauri-plugin-http",
    "tauri-plugin-shell",
    "tauri-plugin-updater",
  ]) {
    if (hostGraph.has(crate)) {
      fail(`network-capable crate compiled into the macOS build: ${crate}`);
    }
  }
}

const tauriConfig = readJson(join(appRoot, "src-tauri/tauri.conf.json"));
failUnlessSameSet(
  tauriConfig.app.security.capabilities,
  ["main"],
  "Tauri capabilities",
);
failUnlessSameSet(
  tauriConfig.bundle.targets,
  ["app", "dmg"],
  "macOS bundle targets",
);

/* The board's drag-and-drop only exists while this is off (LC-60).
   `dragDropEnabled` defaults to true, and with it on wry installs
   `draggingEntered:`/`draggingUpdated:`/`performDragOperation:` on the
   WKWebView for OS file drops. Tauri's handler returns "handled" for every one
   of them, so wry never forwards to super and the page never sees `dragover`
   or `drop` — including for a drag that started inside the page. The card
   lifts and nothing lands, which is what LC-60 reported and what no jsdom test
   can see. Nothing in the app listens for `tauri://drag-drop`; if file drops
   are ever wanted (LC-172), they have to be HTML5 drop events in the webview,
   not the OS handler. */
for (const window of tauriConfig.app.windows) {
  if (window.dragDropEnabled !== false) {
    fail(
      `window "${window.label}" must set dragDropEnabled: false — the OS file-drop handler swallows the board's own drag events (LC-60)`,
    );
  }
}

if (!tauriConfig.bundle.icon?.includes("icons/icon.png")) {
  fail("bundle icon must include icons/icon.png");
}

if (tauriConfig.bundle.macOS?.minimumSystemVersion !== "13.0") {
  fail("macOS minimumSystemVersion must remain 13.0 for the v0 support floor");
}

if (
  !tauriConfig.bundle.shortDescription ||
  !tauriConfig.bundle.longDescription
) {
  fail("bundle metadata must include shortDescription and longDescription");
}

if (!tauriConfig.bundle.longDescription.includes("No account, no telemetry")) {
  fail(
    "bundle longDescription must state the no-account/no-telemetry boundary",
  );
}

const csp = tauriConfig.app.security.csp;
if (!csp.includes("default-src 'self'")) {
  fail("CSP must keep default-src restricted to self");
}
if (!csp.includes("connect-src ipc: http://ipc.localhost")) {
  fail("CSP connect-src must be limited to Tauri IPC");
}
if (/connect-src[^;]*(https?:\/\/(?!ipc\.localhost)|wss?:)/.test(csp)) {
  fail("CSP must not allow arbitrary network connections");
}

const capability = readJson(join(appRoot, "src-tauri/capabilities/main.json"));
failUnlessSameSet(capability.windows, ["main"], "capability windows");
failUnlessSameSet(capability.platforms, ["macOS"], "capability platforms");
failUnlessSameSet(
  capability.permissions,
  ["core:default", "core:event:default", "dialog:allow-open"],
  "capability permissions",
);

/**
 * No `src/tokens/` exemption here, unlike the token guards: a generated stylesheet
 * is exempt from the *scale*, not from the network boundary.
 */
const shippedFrontendFiles = filesUnder(join(appRoot, "src"), /\.tsx?$/).filter(
  (path) => !/\.test\.tsx?$/.test(path),
);
const shippedRustFiles = filesUnder(join(appRoot, "src-tauri/src"), /\.rs$/);

failOnMatch(shippedFrontendFiles, [
  [/\bfetch\s*\(/, "fetch"],
  [/\bXMLHttpRequest\b/, "XMLHttpRequest"],
  [/\bWebSocket\b/, "WebSocket"],
  [/\bsendBeacon\b/, "sendBeacon"],
  [/\bEventSource\b/, "EventSource"],
]);

failOnMatch(shippedRustFiles, [
  [/\bhttp::|reqwest::|ureq::/, "Rust HTTP client"],
  [/\bCommand::new\s*\(/, "process launch"],
]);

report({
  name: "release-audit",
  findings,
  checked: shippedFrontendFiles.length + shippedRustFiles.length,
  remedy:
    "release boundary violation(s) — the v0 boundary is docs/acceptance/release-candidate.md:",
  clean:
    "narrow Tauri capabilities, no direct telemetry/network dependency, no network or process call in shipped source",
});
