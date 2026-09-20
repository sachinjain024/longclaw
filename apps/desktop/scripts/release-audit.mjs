#!/usr/bin/env node
/**
 * The release privacy and filesystem audit (Step 16b).
 *
 * The v0 promise is that the app works with no account and no telemetry, makes
 * exactly one optional request to learn about a newer LongClaw, and touches
 * nothing outside the folder the user picked. Three parts of that are
 * declarative, so a gate can hold them instead of a reviewer: the dependencies
 * the app is built from, the capability and CSP the webview runs under, and the
 * calls the shipped source makes.
 *
 * **What LC-256a changed.** This script used to assert *no network at all* by
 * listing network-capable crates and failing on any of them. An app with an
 * update path cannot pass that list, and deleting the list would leave the
 * gate asserting nothing — the worse of the two. So the list became an
 * allowlist ([ADR 0014](../../../docs/adr/0014-one-optional-check-for-a-newer-longclaw.md)):
 * every network-capable crate in the macOS host graph must arrive **through
 * `tauri-plugin-updater` and through nothing else**, which is a stricter claim
 * than the old one made about the crates it happened to name. `--self-test`
 * asserts both directions: a graph in the pre-amendment shape goes red, and so
 * does one where a second network-capable crate arrives on its own.
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
 *        node scripts/release-audit.mjs --self-test   (the inversion, above)
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";

import { filesUnder, readSource, report } from "./guard.mjs";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const findings = [];
const SELF_TEST = process.argv.includes("--self-test");

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

/**
 * Every crate the macOS host target compiles that can open a socket, speak TLS,
 * or drive the runtime that does.
 *
 * Deliberately wider than "an HTTP client". A gate that named only `reqwest`
 * would pass a build that swapped it for `ureq`, and one that ignored `tokio`
 * would pass an async runtime pulled in for something that is not an update
 * check. Everything here is permitted **only** under `tauri-plugin-updater`, so
 * breadth costs nothing while the one sanctioned arrival is the one that has
 * them.
 */
/** The one arrival ADR 0014 sanctions. Almost everything below rides under it. */
const SANCTIONED_ROOT = "tauri-plugin-updater";

/**
 * Every crate the macOS host target compiles that can open a socket, speak TLS,
 * or drive the runtime that does, mapped to the dependency each one is allowed
 * to arrive under.
 *
 * Deliberately wider than "an HTTP client". A gate that named only `reqwest`
 * would pass a build that swapped it for `ureq`, and one that ignored `tokio`
 * would pass an async runtime pulled in for something that is not an update
 * check.
 *
 * **Two of them are older than the amendment.** `tokio` and `socket2` arrive
 * under `tauri` itself and did so before there was an update path; the old
 * forbidden list never named them, and calling them new arrivals here would be
 * this gate reporting a change that did not happen. They are pinned to `tauri`
 * rather than dropped, so the same crate arriving under anything else is still
 * a finding.
 */
const NETWORK_CAPABLE = new Map(
  [
    "curl",
    "h2",
    "hyper",
    "hyper-rustls",
    "hyper-util",
    "isahc",
    "native-tls",
    "openssl",
    "openssl-sys",
    "reqwest",
    "rustls",
    "rustls-native-certs",
    "rustls-platform-verifier",
    "rustls-webpki",
    "schannel",
    "security-framework",
    "sentry",
    "surf",
    "tauri-plugin-http",
    "tauri-plugin-shell",
    "tokio-rustls",
    "ureq",
  ]
    .map((crate) => [crate, [SANCTIONED_ROOT]])
    .concat([
      ["tokio", [SANCTIONED_ROOT, "tauri"]],
      ["socket2", [SANCTIONED_ROOT, "tauri"]],
    ]),
);

/**
 * The inversion: run the allowlist against two graphs it must reject, and one
 * it must accept, and fail if any of them answers wrong.
 *
 * Two directions, because a one-sided self-test is satisfied by a guard that
 * fails on everything. **The old broad claim** — the pre-amendment graph, with
 * no updater and no network crates at all — must now go red, because an app
 * whose one sanctioned path has vanished is one this allowlist is not watching.
 * **A too-broad new one** — a second network-capable crate arriving on its own
 * — must go red as well, which is the thing the old forbidden list was for and
 * the thing deleting it would have lost.
 *
 * The graphs are written here rather than captured from cargo. A recorded
 * fixture would pin this test to the shape of a tool that is free to change it,
 * and would keep passing after the real reading stopped working.
 */
if (SELF_TEST) {
  const rows = (...names) => [
    [0, "longclaw-desktop"],
    [1, "tauri"],
    [2, "tokio"],
    [3, "socket2"],
    ...names,
  ];

  const cases = [
    {
      what: "the narrow shape ADR 0014 describes",
      rows: rows(
        [1, SANCTIONED_ROOT],
        [2, "reqwest"],
        [3, "hyper"],
        [3, "rustls"],
        [3, "tokio"],
      ),
      red: false,
    },
    {
      what: "the pre-amendment graph, with no update path at all",
      rows: rows(),
      red: true,
    },
    {
      what: "a second network-capable crate arriving on its own",
      rows: rows([1, SANCTIONED_ROOT], [2, "reqwest"], [1, "ureq"]),
      red: true,
    },
    {
      what: "a sanctioned crate arriving under something else",
      rows: rows([1, SANCTIONED_ROOT], [1, "some-other-crate"], [2, "rustls"]),
      red: true,
    },
  ];

  const wrong = cases.filter(
    (probe) => networkArrivalFindings(probe.rows).length > 0 !== probe.red,
  );
  if (wrong.length > 0) {
    console.error(
      "release-audit --self-test: the inversion did not hold\n" +
        wrong
          .map(
            (probe) =>
              `  ${probe.red ? "stayed green on" : "went red on"}: ${probe.what}`,
          )
          .join("\n"),
    );
    process.exit(1);
  }
  console.log(
    `release-audit --self-test: the allowlist accepts ${cases.filter((probe) => !probe.red).length} narrow graph and rejects ${cases.filter((probe) => probe.red).length} broad ones`,
  );
  process.exit(0);
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
  "sentry",
  "reqwest",
  "ureq",
]) {
  const directDependency = new RegExp(`^${dep}\\s*=`, "m");
  if (directDependency.test(cargoToml))
    fail(`forbidden direct Cargo dependency: ${dep}`);
}

/* The one sanctioned network arrival, asserted present rather than tolerated.
   Every crate in the allowlist below is permitted *because* it arrives under
   this one, so a graph that no longer has it is a graph this gate has nothing
   to say about — and would pass while asserting nothing. */
if (!new RegExp(`^${SANCTIONED_ROOT}\\s*=`, "m").test(cargoToml)) {
  fail(
    `${SANCTIONED_ROOT} is not a direct Cargo dependency — the update path ADR 0014 sanctions is gone, and the allowlist below is asserting nothing`,
  );
}

/**
 * The macOS host graph as `[depth, crate]` rows, fully expanded.
 *
 * `--no-dedupe` because the question is about *paths*, not membership: cargo's
 * default elides a subtree it has already printed, so a second, unsanctioned
 * route to a network crate could hide behind a `(*)`. `--locked` so an audit
 * cannot quietly re-resolve the lockfile it is auditing. A cargo that will not
 * run is a finding rather than a skip: an audit that passes because it could
 * not look is worse than one that fails.
 */
function hostGraphRows() {
  try {
    const output = execFileSync(
      "cargo",
      [
        "tree",
        "--locked",
        "--edges",
        "normal",
        "--prefix",
        "depth",
        "--no-dedupe",
      ],
      {
        cwd: join(appRoot, "src-tauri"),
        encoding: "utf8",
        stdio: "pipe",
        maxBuffer: 256 * 1024 * 1024,
      },
    );
    const rows = [];
    for (const line of output.split("\n")) {
      const match = /^(\d+)(\S+)/.exec(line);
      if (match) rows.push([Number(match[1]), match[2]]);
    }
    return rows;
  } catch (error) {
    fail(`could not read the host dependency graph via cargo tree: ${error}`);
    return null;
  }
}

/**
 * Every finding the allowlist has about one graph.
 *
 * Pure, and takes the rows rather than running cargo, so `--self-test` can feed
 * it the pre-amendment graph and an over-broad one and assert that each goes
 * red. A guard whose judgment cannot be run against a known-bad input is a
 * guard nobody has ever seen fail.
 */
function networkArrivalFindings(rows) {
  const found = [];
  const ancestry = [];
  let sanctionedSeen = false;
  const reported = new Set();

  for (const [depth, crate] of rows) {
    ancestry.length = depth;
    ancestry[depth] = crate;
    if (crate === SANCTIONED_ROOT) sanctionedSeen = true;
    const permitted = NETWORK_CAPABLE.get(crate);
    if (!permitted || reported.has(crate)) continue;
    const through = ancestry.slice(0, depth);
    if (permitted.some((under) => through.includes(under))) continue;
    reported.add(crate);
    found.push(
      `network-capable crate ${crate} arrives outside ${permitted.join(" or ")}: ${ancestry
        .slice(0, depth + 1)
        .join(" > ")}`,
    );
  }

  if (!sanctionedSeen) {
    found.push(
      `${SANCTIONED_ROOT} is not in the macOS host graph — ADR 0014's one sanctioned network path is gone, so this allowlist is asserting nothing`,
    );
  }
  return found;
}

const hostRows = hostGraphRows();
if (hostRows) {
  if (hostRows.length < 100) {
    fail(
      `the host dependency graph read as ${hostRows.length} rows, which is not this app's graph — no claim below is trustworthy`,
    );
  }
  for (const finding of networkArrivalFindings(hostRows)) fail(finding);
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

/**
 * Where the updater is pointed, which is the other half of ADR 0014's promise.
 *
 * The dependency allowlist says *what* may speak; this says *to whom*. Both are
 * needed: a sanctioned crate aimed at an unsanctioned host is the amendment
 * spent on something it was not granted for, and the runtime audit would only
 * catch it on a machine somebody remembered to run it on.
 *
 * The key is deliberately allowed to be empty. It is empty until the release
 * engineer generates the pair, and a build with no key reports the update path
 * unavailable rather than offering a download it could never verify — so an
 * empty key is a state, not a misconfiguration. `binary-audit.mjs`, which only
 * ever reads a release bundle, is where a real key is required.
 */
const ALLOWED_UPDATE_HOSTS = ["github.com", "objects.githubusercontent.com"];
const updaterConfig = tauriConfig.plugins?.updater;
if (!updaterConfig) {
  fail(
    "tauri.conf.json configures no updater — the plugin's setup needs the section, and without it the app fails to launch rather than reporting the update path unavailable",
  );
} else {
  if (typeof updaterConfig.pubkey !== "string") {
    fail(
      "the updater configuration must carry a pubkey field, even an empty one",
    );
  }
  for (const endpoint of updaterConfig.endpoints ?? []) {
    let host;
    try {
      const url = new URL(endpoint);
      host = url.host;
      if (url.protocol !== "https:") {
        fail(`update endpoint is not https: ${endpoint}`);
      }
    } catch {
      fail(`update endpoint is not a URL: ${endpoint}`);
      continue;
    }
    if (!ALLOWED_UPDATE_HOSTS.includes(host)) {
      fail(
        `update endpoint names ${host}, which ADR 0014 does not sanction (${ALLOWED_UPDATE_HOSTS.join(", ")})`,
      );
    }
  }
  if ((updaterConfig.endpoints ?? []).length === 0) {
    fail(
      "the updater configuration names no endpoint, so the update path can never answer",
    );
  }
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

/**
 * The update path is reached from three files and no others.
 *
 * ADR 0014's offline invariant is that no existing code path calls into the
 * updater — project open, ticket read and write, the watcher, the index,
 * search, settings and the CLI never wait on it. That is a claim about the
 * *shape* of the source, so a guard can hold it: `update.rs` decides,
 * `update_plugin.rs` carries it out, `lib.rs` registers the plugin and declares
 * the four intent commands, and nothing else may name any of it.
 */
const UPDATE_MODULES = new Set(["update.rs", "update_plugin.rs", "lib.rs"]);
for (const file of shippedRustFiles) {
  const { path, text } = readSource(file);
  if (UPDATE_MODULES.has(path.split("/").pop())) continue;
  for (const [pattern, what] of [
    [/\btauri_plugin_updater\b/, "the updater plugin"],
    [/\bupdate_plugin\b/, "the updater adapter"],
    [/\bUpdatePath\b/, "the update path"],
  ]) {
    if (pattern.test(text)) {
      fail(
        `${path} names ${what} — no existing code path may reach the update path (ADR 0014)`,
      );
    }
  }
}

report({
  name: "release-audit",
  findings,
  checked: shippedFrontendFiles.length + shippedRustFiles.length,
  remedy:
    "release boundary violation(s) — the v0 boundary is docs/acceptance/release-candidate.md:",
  clean:
    "narrow Tauri capabilities, every network-capable crate arriving under the one sanctioned updater dependency, update endpoints on sanctioned hosts only, no telemetry dependency, and no network, process or update-path call anywhere else in shipped source",
});
