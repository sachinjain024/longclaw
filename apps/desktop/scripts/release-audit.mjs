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
 * The app's own crate, and the second place a client may now arrive
 * (LC-257s, ADR 0015).
 *
 * The star count is a second *caller* rather than a second *road*: it uses the
 * `reqwest` the updater already compiles in, declared directly so the
 * dependency is visible instead of borrowed in silence. Declaring it moves one
 * arrival of that crate from under `tauri-plugin-updater` to under the app —
 * which the ancestry rule below would otherwise read as a client arriving on
 * its own, the exact thing it exists to catch.
 *
 * So the rule is widened by exactly one crate at exactly one place, and two
 * controls are added to pay for it: `reqwest` may only be declared with the
 * updater's own feature set (`FROZEN_REQWEST_FEATURES`), and the set of
 * network-capable crates in the graph must be exactly the set that was there
 * before (`FROZEN_NETWORK_CRATES`). Together those say what the old rule said
 * on its own: nothing new can reach the network, and nothing already here can
 * grow.
 */
const CRATE_ROOT = "longclaw-desktop";

/**
 * The client the app declares, and the only crate `CRATE_ROOT` may hold.
 *
 * Everything under it — the TLS stack, the connection pool, the runtime — is
 * permitted under this name rather than under either root, because it arrives
 * under the same client in both paths and the client's own arrival is what is
 * actually being judged.
 */
const APP_CLIENT = "reqwest";

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
      ["tokio", [SANCTIONED_ROOT, "tauri", APP_CLIENT]],
      ["socket2", [SANCTIONED_ROOT, "tauri", APP_CLIENT]],
      // The client itself, at the two places it now arrives (ADR 0015).
      [APP_CLIENT, [SANCTIONED_ROOT, CRATE_ROOT]],
      // Its stack, which arrives under the client in both paths. Naming the
      // client rather than adding `CRATE_ROOT` to each is what keeps the rule
      // narrow: `rustls` directly under the app is still a finding.
      ...[
        "h2",
        "hyper",
        "hyper-rustls",
        "hyper-util",
        "rustls",
        "rustls-native-certs",
        "rustls-platform-verifier",
        "rustls-webpki",
        "security-framework",
        "tokio-rustls",
      ].map((crate) => [crate, [SANCTIONED_ROOT, APP_CLIENT]]),
    ]),
);

/**
 * Every network-capable crate the graph is allowed to contain, and no others.
 *
 * The ancestry rule answers "did this arrive somewhere sanctioned"; this one
 * answers "is this here at all". It exists because ADR 0015 widened the first
 * question by one crate, and a rule that has been widened once needs something
 * beside it that cannot be widened by the same argument. **Measured off the
 * graph, not predicted** — `npm run verify` is what reports a drift, and the
 * fix for a red run is to decide whether the new crate belongs, never to paste
 * it in here.
 */
const FROZEN_NETWORK_CRATES = [
  APP_CLIENT,
  "hyper",
  "hyper-rustls",
  "hyper-util",
  "rustls",
  "rustls-platform-verifier",
  "rustls-webpki",
  "security-framework",
  "socket2",
  "tokio",
  "tokio-rustls",
];

/**
 * The features `reqwest` may be declared with by `CRATE_ROOT`.
 *
 * This is the control that makes "a second caller, not a second road" a fact
 * rather than an intention. reqwest's defaults are `default-tls`, `charset`,
 * `http2` and `system-proxy`; `tauri-plugin-updater` turns none of them on, so
 * an ordinary `reqwest = "0.13"` here would pull `h2` and `encoding_rs` into a
 * binary that has never had them — and `h2` is on the list above. The feature
 * union has to stay exactly what the updater already asked for, and the only
 * way to say that in a manifest is `default-features = false` plus a subset.
 */
const FROZEN_REQWEST_FEATURES = ["json", "stream"];

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
    [0, CRATE_ROOT],
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
    {
      what: "the app's own caller, declared beside the updater's (ADR 0015)",
      rows: rows(
        [1, APP_CLIENT],
        [2, "hyper"],
        [2, "rustls"],
        [1, SANCTIONED_ROOT],
        [2, APP_CLIENT],
        [3, "hyper"],
        [3, "rustls"],
      ),
      red: false,
    },
    {
      what: "the client arriving under neither root",
      rows: rows(
        [1, SANCTIONED_ROOT],
        [2, APP_CLIENT],
        [1, "some-other-crate"],
        [2, APP_CLIENT],
      ),
      red: true,
    },
    {
      what: "the stack loose under the app rather than under its client",
      rows: rows([1, SANCTIONED_ROOT], [2, APP_CLIENT], [1, "rustls"]),
      red: true,
    },
  ];

  const everything = FROZEN_NETWORK_CRATES.map((crate) => [1, crate]);
  const frozenCases = [
    {
      what: "the graph the frozen set was measured from",
      rows: everything,
      red: false,
    },
    {
      what: "a network-capable crate the frozen set does not name",
      rows: [...everything, [1, "ureq"]],
      red: true,
    },
    {
      what: "a frozen crate that has left the graph",
      rows: everything.slice(1),
      red: true,
    },
  ];

  const wrong = cases
    .filter(
      (probe) => networkArrivalFindings(probe.rows).length > 0 !== probe.red,
    )
    .concat(
      frozenCases.filter(
        (probe) => frozenSetFindings(probe.rows).length > 0 !== probe.red,
      ),
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
    `release-audit --self-test: the allowlist accepts ${cases.filter((probe) => !probe.red).length} narrow graphs and rejects ${cases.filter((probe) => probe.red).length} broad ones; the frozen set accepts ${frozenCases.filter((probe) => !probe.red).length} and rejects ${frozenCases.filter((probe) => probe.red).length}`,
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
  "ureq",
]) {
  const directDependency = new RegExp(`^${dep}\\s*=`, "m");
  if (directDependency.test(cargoToml))
    fail(`forbidden direct Cargo dependency: ${dep}`);
}

/* `reqwest` left the list above when ADR 0015 made the star count a second
   caller on the update path's client. It is not merely tolerated here: how it
   is declared is the control. Defaults on would pull `h2` and `encoding_rs`
   into a binary that has never had them, so the declaration must turn defaults
   off and ask for nothing the updater has not already asked for — which is what
   keeps "a second caller, not a second road" a fact about the build rather than
   a sentence in an ADR. */
const reqwestDeclaration = /^reqwest\s*=\s*(.+)$/m.exec(cargoToml);
if (reqwestDeclaration) {
  const declaration = reqwestDeclaration[1];
  if (!/default-features\s*=\s*false/.test(declaration)) {
    fail(
      `reqwest is declared directly without default-features = false: ${declaration.trim()}`,
    );
  }
  const features = [...declaration.matchAll(/"([^"]+)"/g)]
    .map(([, value]) => value)
    .filter(
      (value) =>
        FROZEN_REQWEST_FEATURES.concat("json", "stream").includes(value) ||
        !/^[\d.^~=*]/.test(value),
    )
    .filter((value) => !/^[\d.^~=*]/.test(value));
  const extra = features.filter(
    (feature) => !FROZEN_REQWEST_FEATURES.includes(feature),
  );
  if (extra.length > 0) {
    fail(
      `reqwest is declared with features beyond the updater's own: ${extra.join(", ")} — the union has to stay what tauri-plugin-updater already asked for`,
    );
  }
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
    // `CRATE_ROOT` is the root of every ancestry, so "is it in the chain" would
    // permit the crate at any depth under the app — which is no rule at all.
    // Permitted *there* means declared there: a direct dependency, nothing
    // deeper. Every other permitted ancestor is an ordinary "somewhere above".
    const admits = (under) =>
      under === CRATE_ROOT ? through.length === 1 : through.includes(under);
    if (permitted.some(admits)) continue;
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

/**
 * The second question the ancestry rule does not ask: not "did this arrive
 * somewhere sanctioned" but "is this here at all" (ADR 0015).
 *
 * Separate from `networkArrivalFindings` because it judges a whole graph rather
 * than each arrival in one, and because the ancestry rule's self-test feeds it
 * fragments — a fragment is missing almost everything, and a set control run
 * over one would report nothing but absences.
 *
 * Both directions are findings. A crate that appears is the obvious one. A
 * crate that *disappears* is the one worth having: a frozen set that has
 * quietly shrunk is a control asserting more than the build contains, and it
 * would keep passing long after it stopped meaning anything.
 */
function frozenSetFindings(rows) {
  const present = new Set(
    rows
      .map(([, crate]) => crate)
      .filter((crate) => NETWORK_CAPABLE.has(crate)),
  );
  const frozen = new Set(FROZEN_NETWORK_CRATES);
  const arrived = [...present].filter((crate) => !frozen.has(crate)).sort();
  const gone = [...frozen].filter((crate) => !present.has(crate)).sort();
  const found = [];
  if (arrived.length > 0) {
    found.push(
      `network-capable crates in the graph that ADR 0015's frozen set does not name: ${arrived.join(", ")} — decide whether they belong, rather than pasting them in`,
    );
  }
  if (gone.length > 0) {
    found.push(
      `frozen network-capable crates the graph no longer has: ${gone.join(", ")} — the set is asserting more than the build contains`,
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
  for (const finding of frozenSetFindings(hostRows)) fail(finding);
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

/* Every GitHub host this app may name, the update path's and the star count's
   together (ADR 0014, ADR 0015). `api.github.com` is not an update endpoint and
   never appears in `tauri.conf.json`; it is a constant in `github.rs`, which is
   why the check below reads source rather than configuration. */
const ALLOWED_GITHUB_HOSTS = [...ALLOWED_UPDATE_HOSTS, "api.github.com"];
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

/* The second caller's address, checked the way the updater's endpoints are
   (LC-257s, ADR 0015).

   The star count's URL is a Rust constant rather than a configuration entry —
   the webview names no URL, so there is nothing for the config audit above to
   read. That does not make it unchecked: it makes it a different file to read.
   Both constants must be https, and the API one must name the host the frozen
   allowlist and the runtime audit are both looking for. A constant quietly
   repointed at another host is exactly the change this catches. */
const githubSource = readFileSync(
  join(appRoot, "src-tauri/src/github.rs"),
  "utf8",
);
const constantUrl = (name) => {
  const match = new RegExp(`pub const ${name}: &str = "([^"]+)"`).exec(
    githubSource,
  );
  if (!match) {
    fail(
      `github.rs declares no ${name} — the address audit has nothing to read`,
    );
    return null;
  }
  return match[1];
};
const apiHostMatch = /pub const API_HOST: &str = "([^"]+)"/.exec(githubSource);
const apiHost = apiHostMatch?.[1];
if (!apiHost) {
  fail(
    "github.rs declares no API_HOST — the runtime audit's allowlist has no source",
  );
} else if (!ALLOWED_GITHUB_HOSTS.includes(apiHost)) {
  fail(
    `github.rs names API_HOST ${apiHost}, which ADR 0015 does not sanction (${ALLOWED_GITHUB_HOSTS.join(", ")})`,
  );
}
for (const name of ["REPOSITORY_URL", "API_URL"]) {
  const value = constantUrl(name);
  if (!value) continue;
  let url;
  try {
    url = new URL(value);
  } catch {
    fail(`github.rs ${name} is not a URL: ${value}`);
    continue;
  }
  if (url.protocol !== "https:")
    fail(`github.rs ${name} is not https: ${value}`);
  if (!ALLOWED_GITHUB_HOSTS.includes(url.host)) {
    fail(
      `github.rs ${name} names ${url.host}, which ADR 0015 does not sanction (${ALLOWED_GITHUB_HOSTS.join(", ")})`,
    );
  }
}
if (apiHost && !constantUrl("API_URL")?.includes(apiHost)) {
  fail(
    "github.rs API_HOST is not the host API_URL names — the runtime audit would be watching for an address the app never asks for",
  );
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

/**
 * The one file that may name an HTTP client (LC-257s, ADR 0015).
 *
 * Narrower than the old rule rather than wider: it used to say "no Rust file",
 * which was true while the updater plugin made every request itself. The star
 * count is the app's own request, so one file makes it — and naming that file
 * here is what keeps a second one from quietly appearing. Everything that is a
 * *decision* about the request still lives in `github.rs`, which is on the
 * wrong side of this line and must stay there.
 */
const HTTP_CLIENT_FILE = "github_client.rs";

failOnMatch(
  shippedRustFiles.filter((file) => !file.endsWith(`/${HTTP_CLIENT_FILE}`)),
  [[/\bhttp::|reqwest::|ureq::/, "Rust HTTP client"]],
);
failOnMatch(shippedRustFiles, [[/\bCommand::new\s*\(/, "process launch"]]);

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
    "narrow Tauri capabilities, every network-capable crate arriving under the sanctioned updater dependency or the one client the app declares beside it, that client declared with no feature the updater did not already ask for, the frozen set of network-capable crates unchanged, update endpoints and the star count's two constants on sanctioned hosts only, no telemetry dependency, and no network, process or update-path call anywhere else in shipped source",
});
