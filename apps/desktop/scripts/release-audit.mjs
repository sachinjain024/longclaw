import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "../../..");
const appRoot = join(repoRoot, "apps/desktop");

const failures = [];

function fail(message) {
  failures.push(message);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function walk(dir, predicate, files = []) {
  for (const entry of readdirSync(dir)) {
    if (["node_modules", "dist", "target"].includes(entry)) continue;
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      walk(path, predicate, files);
    } else if (predicate(path)) {
      files.push(path);
    }
  }
  return files;
}

function assertEqual(actual, expected, label) {
  const left = JSON.stringify(actual);
  const right = JSON.stringify(expected);
  if (left !== right) fail(`${label}: expected ${right}, got ${left}`);
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
assertEqual(
  tauriConfig.app.security.capabilities,
  ["main"],
  "Tauri capabilities",
);
assertEqual(tauriConfig.bundle.targets, ["app", "dmg"], "macOS bundle targets");

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
assertEqual(capability.windows, ["main"], "capability windows");
assertEqual(capability.platforms, ["macOS"], "capability platforms");
assertEqual(
  capability.permissions,
  ["core:default", "core:event:default", "dialog:allow-open"],
  "capability permissions",
);

const shippedFrontendFiles = walk(
  join(appRoot, "src"),
  (path) =>
    /\.(ts|tsx)$/.test(path) &&
    !path.endsWith(".test.ts") &&
    !path.endsWith(".test.tsx"),
);
const shippedRustFiles = walk(join(appRoot, "src-tauri/src"), (path) =>
  path.endsWith(".rs"),
);

const forbiddenFrontendPatterns = [
  [/\bfetch\s*\(/, "fetch"],
  [/\bXMLHttpRequest\b/, "XMLHttpRequest"],
  [/\bWebSocket\b/, "WebSocket"],
  [/\bsendBeacon\b/, "sendBeacon"],
  [/\bEventSource\b/, "EventSource"],
];

const forbiddenRustPatterns = [
  [/\bhttp::|reqwest::|ureq::/, "Rust HTTP client"],
  [/\bCommand::new\s*\(/, "process launch"],
];

for (const file of shippedFrontendFiles) {
  const text = readFileSync(file, "utf8");
  for (const [pattern, label] of forbiddenFrontendPatterns) {
    if (pattern.test(text)) {
      fail(`${relative(repoRoot, file)} uses ${label}`);
    }
  }
}

for (const file of shippedRustFiles) {
  const text = readFileSync(file, "utf8");
  for (const [pattern, label] of forbiddenRustPatterns) {
    if (pattern.test(text)) {
      fail(`${relative(repoRoot, file)} uses ${label}`);
    }
  }
}

if (failures.length > 0) {
  console.error("release audit failed:");
  for (const message of failures) console.error(`- ${message}`);
  process.exit(1);
}

console.log(
  `release audit passed: ${
    shippedFrontendFiles.length + shippedRustFiles.length
  } shipped source files, narrow Tauri capabilities, no direct telemetry/network dependencies`,
);
