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
 * The fourth part it cannot see is what the *binary* does at runtime, through
 * transitive dependencies it never names. `src-tauri/Cargo.lock` carries
 * `reqwest` and `hyper` transitively today — pulled in below Tauri, not by us —
 * and nothing here would notice one of them opening a connection. The
 * process-monitor pass in `docs/acceptance/release-candidate.md` is what covers
 * that, it is manual on purpose, and a pass here is not a substitute for it.
 *
 * Config lists are compared as sets: a permission list means the same thing
 * shuffled, and failing a release build on key order is noise, not a finding.
 *
 * Usage: node scripts/release-audit.mjs   (exits non-zero on any finding)
 */

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
