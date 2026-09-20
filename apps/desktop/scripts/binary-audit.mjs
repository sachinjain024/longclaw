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
 * **Two binaries, not one** (LC-233). `Contents/MacOS/` holds the window *and*
 * the `longclaw` CLI: `tauri build` compiles every `[[bin]]` this crate declares
 * and the bundler seals each one into the app, which is how installing the app
 * installs the command. That was already true before LC-233 and nothing said
 * so, so nothing would have said so if it stopped being true — a `default-run`
 * edit, or a bundler that stopped enumerating bins, and the app ships with the
 * install button pointing at a file that is not there. So the CLI's presence is
 * asserted here rather than assumed, and it is audited the way the window is:
 * the no-network claim covers both processes, and the CLI is a *separate*
 * process that this script never once looked at.
 *
 * Their control sets differ, and deliberately. Both open and stat files, so
 * both must import `_open` and `_stat`; only the window watches a folder, so
 * `_FSEventStreamCreate` is the window's control alone and demanding it of the
 * CLI would be demanding a watcher the CLI is documented not to start
 * (`cli.rs`). What stands in for it is a positive read of the CLI's own code —
 * the `longclaw_desktop_lib::cli` symbols — because "the forbidden symbols are
 * absent" is worth nothing from a file that turned out to be the wrong one.
 *
 * **What this cannot prove.** WebKit is linked and is network-capable by
 * construction; no symbol table will tell you what the webview does. The CSP
 * `connect-src` restriction is what bounds that, and the process-monitor pass in
 * `docs/acceptance/release-candidate.md` is what verifies it. A pass here means
 * the Rust side links no HTTP client and calls no socket API. It does not mean
 * the app made no connection. It is also silent about the CLI's *behaviour*:
 * `tests/cli.rs` is what covers that.
 *
 * Usage: node scripts/binary-audit.mjs   (exits non-zero on any finding)
 *        node scripts/binary-audit.mjs --self-test   (see the signing section)
 */

import { Buffer } from "node:buffer";
import { execFileSync, spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { report } from "./guard.mjs";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const APP_BUNDLE = join(
  appRoot,
  "src-tauri/target/release/bundle/macos/LongClaw.app",
);
const MACOS_DIR = join(APP_BUNDLE, "Contents/MacOS");
const DMG_DIR = join(appRoot, "src-tauri/target/release/bundle/dmg");

/* `--self-test` asks only the signing question, so the symbol audit — two `nm`
   reads over a 200MB binary — is skipped for it. */
const SELF_TEST = process.argv.includes("--self-test");

/**
 * Every Mach-O the bundle ships, and the controls that prove each was read.
 *
 * `sourceSymbol` is the positive read: a Rust path this binary's own code must
 * contain. Absence claims are the whole point of this script, and an absence
 * read off the wrong file is the failure mode it was written to avoid — the
 * same reasoning as the symbol-count floor, one level up.
 */
/**
 * Every socket call a process could make through libSystem.
 *
 * The *set* is what is audited, not a handful of names. The old check listed
 * four and asked whether any was present; an enumerated expectation has to know
 * every name it might see, or a build that swapped `_connect` for `_connectx`
 * would read as a build that stopped connecting.
 */
const SOCKET_API = [
  "_accept",
  "_bind",
  "_connect",
  "_connectx",
  "_freeaddrinfo",
  "_getaddrinfo",
  "_getnameinfo",
  "_getpeername",
  "_getsockname",
  "_getsockopt",
  "_listen",
  "_recv",
  "_recvfrom",
  "_recvmsg",
  "_send",
  "_sendmsg",
  "_sendto",
  "_setsockopt",
  "_shutdown",
  "_socket",
  "_socketpair",
];

/** Every system framework that can carry traffic off this machine. */
const NETWORK_FRAMEWORKS = [
  "CFNetwork",
  "Network.framework",
  "Security.framework",
  "SystemConfiguration.framework",
];

/**
 * Every Mach-O the bundle ships, and the controls that prove each was read.
 *
 * `sourceSymbol` is the positive read: a Rust path this binary's own code must
 * contain. Absence claims are the whole point of this script, and an absence
 * read off the wrong file is the failure mode it was written to avoid — the
 * same reasoning as the symbol-count floor, one level up.
 *
 * **`socketApi` and `networkFrameworks` are exact sets, not forbidden lists**
 * (LC-256a). ADR 0014 sanctions one update check, so "no network anything" is
 * no longer true of the window and a gate that still claimed it would have to
 * be deleted to go green — which is how a gate stops watching. An enumerated
 * expectation fails when the set *grows* as surely as when a control is
 * missing: a second caller, a new TLS stack, or a framework nobody asked for
 * all move the set and all go red.
 */
const BINARIES = [
  {
    name: "longclaw-desktop",
    what: "the window",
    imports: ["_open", "_stat", "_FSEventStreamCreate"],
    why: "this app opens files and watches them",
    sourceSymbol: "longclaw_desktop_lib",
    // A Tauri app links WebKit or it is not the app. The CLI links it too
    // today, through the shared lib, but that is incidental — a control has to
    // be something the binary cannot work without, so it is claimed only here.
    frameworks: ["WebKit"],
    // Exactly what the updater's TLS stack reaches libSystem for, and nothing
    // else. **Measured off a signed build on 2026-09-20, not predicted.** The
    // first nine were written from the crate graph before a build with the
    // updater in it existed, and the first one that did added three more:
    // `_getpeername`, `_getsockname` and `_shutdown`. They are not a wider
    // boundary — every one of them operates on a socket this process has
    // already connected, so it names no host, opens nothing and sends nothing,
    // and `_shutdown` is how an orderly TLS close ends. A process holding
    // `_connect` and `_send` already has everything they could add.
    //
    // What is absent is what the claim rests on, and it must stay absent:
    // `_sendto` and `_recvfrom`, because HTTPS is a connected stream and a
    // datagram call would be something else entirely; `_listen` and `_accept`,
    // because nothing here is a server; and `_connectx`, `_getnameinfo`,
    // `_recvmsg`, `_sendmsg` and `_socketpair`.
    socketApi: [
      "_bind",
      "_connect",
      "_freeaddrinfo",
      "_getaddrinfo",
      "_getpeername",
      "_getsockname",
      "_getsockopt",
      "_recv",
      "_send",
      "_setsockopt",
      "_shutdown",
      "_socket",
    ],
    // `Security` for the platform certificate verifier and `SystemConfiguration`
    // for the system proxy settings — both arriving with the updater's client.
    // `CFNetwork` and `Network.framework` are the two that must stay out: they
    // are how a process reaches the network *without* the crate graph saying so,
    // which is the thing `release-audit.mjs` cannot see.
    networkFrameworks: ["Security.framework", "SystemConfiguration.framework"],
    // The positive read for the update path itself. Without it a build that
    // quietly lost the updater would pass every absence claim below.
    networkMarkers: ["reqwest", "rustls"],
    // The architectures every other bundled binary must match.
    setsTheArchitecture: true,
  },
  {
    name: "longclaw",
    what: "the longclaw CLI, which ships inside the app (LC-233)",
    // No `_FSEventStreamCreate`: the CLI starts no watcher, on purpose
    // (`cli.rs` — "it does not start an engine").
    imports: ["_open", "_stat"],
    why: "the CLI reads and writes ticket files",
    sourceSymbol: "longclaw_desktop_lib3cli",
    frameworks: [],
    // **The CLI still imports no socket call at all**, which is the claim that
    // matters and the one ADR 0014 keeps strict for it: it starts no updater
    // and can make no connection.
    socketApi: [],
    // It does link the two frameworks the window does, and that is not a
    // regression being tolerated — it is the shared library being honest. Both
    // binaries are built from one `longclaw_desktop_lib` on purpose (ADR 0011:
    // the CLI links the same core so the write seams and the file format stay
    // in one implementation), and `security-framework-sys` declares its links
    // at link time whether or not a caller reaches them. Linking a framework is
    // not calling one; the empty `socketApi` above is what says nothing is
    // called, and it is stronger evidence than the framework line ever was.
    networkFrameworks: ["Security.framework", "SystemConfiguration.framework"],
    // And it must not contain the update path's own code.
    networkMarkers: [],
    setsTheArchitecture: false,
  },
];

/** Whichever of `names` the reading actually found, in a stable order. */
const present = (names, haystack) =>
  names.filter((name) => haystack.some((entry) => entry.includes(name)));

/**
 * Every finding about one binary's network shape, given what was read off it.
 *
 * Pure, and taking the reading rather than performing it, so `--self-test` can
 * hand it the pre-amendment shape and an over-broad one and assert that each
 * goes red. A guard whose judgment cannot be run against a known-bad input is a
 * guard nobody has ever seen fail.
 */
function networkShapeFindings(binary, undefinedSymbols, libraries) {
  const found = [];
  const note = (message) => found.push(`${binary.name}: ${message}`);
  const sameSet = (left, right) =>
    left.length === right.length &&
    left.every((name, at) => name === right[at]);

  const socket = SOCKET_API.filter((name) => undefinedSymbols.includes(name));
  if (!sameSet(socket, [...binary.socketApi].sort())) {
    note(
      `the socket API it imports is [${socket.join(", ")}], and ADR 0014 sanctions exactly [${[...binary.socketApi].sort().join(", ")}]`,
    );
  }

  const frameworks = present(NETWORK_FRAMEWORKS, libraries);
  if (!sameSet(frameworks, [...binary.networkFrameworks].sort())) {
    note(
      `the network-capable frameworks it links are [${frameworks.join(", ")}], and ADR 0014 sanctions exactly [${[...binary.networkFrameworks].sort().join(", ")}]`,
    );
  }
  return found;
}

const findings = [];
const fail = (message) => findings.push(message);

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

const run = (command, args) =>
  execFileSync(command, args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });

/** The architectures a Mach-O carries, so a sidecar cannot be the odd one out. */
const archsOf = (path) =>
  run("lipo", ["-archs", path]).trim().split(/\s+/).filter(Boolean).sort();

for (const { name } of BINARIES) {
  if (existsSync(join(MACOS_DIR, name))) continue;
  console.error(
    `binary-audit: no release binary at\n  ${join(MACOS_DIR, name)}\nRun npm run build:app first — this audit reads the shipped artefact.`,
  );
  process.exit(1);
}

let importedSymbols = 0;
let linkedLibraries = 0;

for (const binary of SELF_TEST ? [] : BINARIES) {
  const path = join(MACOS_DIR, binary.name);
  const label = `${binary.name} (${binary.what})`;
  const symbols = run("nm", ["-a", path]);
  const undefined_ = run("nm", ["-u", path])
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const libraries = run("otool", ["-L", path])
    .split("\n")
    .slice(1)
    .map((line) => line.trim().replace(/\s*\(.*/, ""))
    .filter(Boolean);
  importedSymbols += undefined_.length;
  linkedLibraries += libraries.length;

  // Controls first. Everything below is an absence claim, and an absence claim is
  // only worth what the reading is worth.
  if (undefined_.length < 50) {
    fail(
      `${label}: only ${undefined_.length} undefined symbols: the symbol table did not read as expected, so no absence below is trustworthy`,
    );
  }
  for (const control of binary.imports) {
    if (!undefined_.some((symbol) => symbol === control)) {
      fail(
        `${label}: control symbol ${control} is missing: ${binary.why}, so the probe is not reading what it thinks it is`,
      );
    }
  }
  if (!symbols.includes(binary.sourceSymbol)) {
    fail(
      `${label}: no ${binary.sourceSymbol} symbol — this is not the binary this check believes it is reading`,
    );
  }

  // Telemetry is still forbidden outright: ADR 0014 amended the network claim
  // and left this one exactly where it was.
  for (const marker of ["sentry", "posthog", "amplitude"]) {
    if (symbols.includes(marker)) {
      fail(`${label}: telemetry symbols linked in: ${marker}`);
    }
  }

  // The update path, read positively. A build that lost it would otherwise pass
  // every absence claim in this script by having nothing in it at all.
  for (const marker of binary.networkMarkers) {
    if (!symbols.includes(marker)) {
      fail(
        `${label}: no ${marker} symbol — the update path ADR 0014 sanctions is not in this binary, so the sets below are describing a different build`,
      );
    }
  }

  // The socket API and the network frameworks, as exact sets rather than as
  // forbidden lists. See `networkShapeFindings`.
  for (const finding of networkShapeFindings(binary, undefined_, libraries)) {
    fail(finding);
  }

  for (const framework of binary.frameworks) {
    if (!libraries.some((library) => library.includes(framework))) {
      fail(
        `${label}: control: ${framework} is not linked, which this binary cannot be without — the binary read is wrong`,
      );
    }
  }
}

/* Both bins come out of one `cargo build` for one target, so they agree by
   construction — which is exactly the kind of fact that stops holding quietly
   when someone adds a per-binary build step. The reference is the entry that
   declares itself the reference, rather than whichever one is written first. */
const reference = BINARIES.find((binary) => binary.setsTheArchitecture);
const expected = SELF_TEST ? [] : archsOf(join(MACOS_DIR, reference.name));
for (const binary of SELF_TEST
  ? []
  : BINARIES.filter((entry) => entry !== reference)) {
  const archs = archsOf(join(MACOS_DIR, binary.name));
  if (archs.join() !== expected.join()) {
    fail(
      `${binary.name} is built for ${archs.join("+")} and ${reference.name} for ${expected.join("+")} — the bundled command will not run everywhere the app does`,
    );
  }
}

/**
 * The updater key, and whether it is the key that signed the manifest (D3).
 *
 * Losing or mismatching this key orphans every installed copy — the exact
 * problem LC-256a exists to end — so a mismatch has to fail the build rather
 * than every user's update. Two questions:
 *
 * - **Is there a key at all?** The public half is committed in the Tauri
 *   configuration, which is how it reaches every bundle. It is empty until the
 *   release engineer generates the pair, and an empty key makes the app report
 *   the update path unavailable rather than offering a download it could never
 *   verify. That is the right behaviour for a dev window and the wrong one for
 *   a release, so it is a finding *here* — this script only ever reads a
 *   release bundle — and not in `release-audit.mjs`.
 * - **Did that key sign the manifest?** minisign puts an 8-byte key id in both
 *   the public key and every signature, so the two can be compared without a
 *   cryptographic library. This proves the release was signed by the key the
 *   bundle carries. It does **not** prove the signature is valid over the
 *   archive — that is `release-macos.mjs`'s step, which fetches the published
 *   manifest back and verifies it. A key id match is the failure this catches,
 *   and it is the one that would otherwise reach users.
 */
const MANIFEST_NAME = "latest.json";

/** The 8-byte minisign key id inside a base64-wrapped `.pub` or `.sig` body. */
function minisignKeyId(wrapped) {
  const lines = Buffer.from(wrapped.trim(), "base64")
    .toString("utf8")
    .split("\n")
    .filter((line) => line.trim() && !line.startsWith("untrusted comment"));
  if (lines.length === 0) return null;
  const body = Buffer.from(lines[0].trim(), "base64");
  // Two bytes of algorithm, then the key id.
  return body.length >= 10 ? body.subarray(2, 10).toString("hex") : null;
}

function updaterKeyFindings() {
  const found = [];
  const pubkey = readJson(join(appRoot, "src-tauri/tauri.conf.json")).plugins
    ?.updater?.pubkey;
  if (!pubkey) {
    found.push({
      tag: "updaterKey",
      message:
        "the bundle carries no updater public key, so every copy it installs is a permanent one — generate the pair per docs/release-signing-runbook.md",
    });
    return found;
  }

  const keyId = minisignKeyId(pubkey);
  if (!keyId) {
    found.push({
      tag: "updaterKey",
      message:
        "the updater public key is not a minisign key this script can read",
    });
    return found;
  }

  // The manifest is written beside the DMG by the release script. Before that
  // step has run there is nothing to compare against, and saying so is better
  // than passing silently.
  const manifestPath = join(DMG_DIR, MANIFEST_NAME);
  if (!existsSync(manifestPath)) {
    found.push({
      tag: "manifest",
      message: `no ${MANIFEST_NAME} beside the DMG — the release has no update manifest, so nothing an installed copy reads was produced`,
    });
    return found;
  }

  const manifest = readJson(manifestPath);
  const platforms = Object.entries(manifest.platforms ?? {});
  if (platforms.length === 0) {
    found.push({
      tag: "manifest",
      message: `${MANIFEST_NAME} names no platform, so it can update nobody`,
    });
  }
  for (const [platform, entry] of platforms) {
    const signed = minisignKeyId(entry.signature ?? "");
    if (signed !== keyId) {
      found.push({
        tag: "manifestKey",
        message: `${MANIFEST_NAME}'s ${platform} signature was made by key ${signed ?? "an unreadable key"}, and the bundle verifies against ${keyId} — every update would be refused`,
      });
    }
  }
  return found;
}

/**
 * The signature, the identity behind it, and Apple's notarization ticket.
 *
 * Every candidate through Step 17 shipped a `.app` that macOS refuses to open:
 * Tauri wrote no `signingIdentity`, so the bundle was never signed — only the
 * Mach-O carried the linker's ad-hoc signature, `Sealed Resources` was `none`,
 * and there was no `_CodeSignature` at all. On the build machine that is
 * invisible, because a locally built app has never been downloaded and so has no
 * quarantine attribute to trigger the check. Give it one, as any browser or
 * AirDrop would, and Apple Silicon reports **"LongClaw is damaged and can't be
 * opened"** with no *Open Anyway* button — so the route the release notes
 * document does not exist, and a user's only offered option is Move to Bin.
 *
 * That is why the seal is checked, and it stays checked: it costs nothing and it
 * is what caught the defect that shipped through Step 17.
 *
 * **What LC-47 changed.** This section used to tolerate `spctl` refusing the
 * bundle, in a comment, and it was right to: an unsigned release was what
 * shipped, a rejection was the expected answer, and the case *did* offer Open
 * Anyway. The release now signs with a Developer ID identity and staples a
 * notarization ticket, so a rejection is the defect rather than the baseline,
 * and an audit that passed on the old state has to fail on it or it is not
 * watching anything. Four questions are asked that were not:
 *
 * - the authority chain is a **Developer ID** one, leaf through Apple's root,
 *   rather than ad-hoc or a development certificate;
 * - the **Hardened Runtime** flag is set, which notarization requires. Tauri
 *   passes `--options runtime` itself — it is set even on the ad-hoc build, so
 *   nothing in the config asks for it and nothing in the config would say so if
 *   that stopped being true;
 * - **Gatekeeper accepts**, which is the user's actual first-launch question;
 * - a notarization **ticket is stapled**, on both artefacts. This is the offline
 *   case, and for this app it is the one that matters: without the staple a
 *   first launch needs a round trip to Apple, which is precisely what a
 *   local-only tool should not require of someone.
 *
 * **Two artefacts, and they are not asked the same questions.** The `.app` is a
 * bundle of executable code: it seals resources, it carries the runtime flag,
 * and Gatekeeper assesses it as `execute`. The DMG is a container — it seals
 * nothing (`Sealed Resources=none`), its CodeDirectory flags are `0x0(none)`,
 * and the assessment that matches what a user does with it is `open` against the
 * primary signature. Demanding a seal or a runtime flag of the DMG would be
 * demanding something correct signing does not produce, which is a guard that
 * fails on a good release — the same class of mistake as tolerating a bad one.
 *
 * **There is no opt-out flag.** `npm run build:app` on a machine holding no
 * certificate still produces an openable ad-hoc bundle, which is what CI builds
 * on every PR (`.github/workflows/ci.yml`) — but CI does not run this script,
 * and this is the *release* audit. A switch that let it pass on an unsigned
 * artefact would be the tolerance this ticket removed, spelled differently.
 */

/** The three links a Developer ID chain has, and what each one being absent means. */
const AUTHORITY_CHAIN = [
  [
    /^Authority=Developer ID Application: .+ \([A-Z0-9]{10}\)$/m,
    "a Developer ID Application leaf certificate",
  ],
  [
    /^Authority=Developer ID Certification Authority$/m,
    "Apple's Developer ID intermediate",
  ],
  [/^Authority=Apple Root CA$/m, "the Apple root"],
];

/**
 * `{ status, out }` for a tool that says what it means on stderr, or in its
 * exit status, or both.
 *
 * `codesign -dv` writes its entire report to stderr and exits 0. `spctl` and
 * `stapler` put the sentence on stdout and the verdict in the status —
 * `stapler` exits 65 for a missing ticket, and both print a plausible-looking
 * "Processing:" line on the way to failing. `execFileSync` returns stdout
 * alone, and throws away everything when the status is non-zero, so a probe
 * built on it reads an empty string for half of these and calls it a pass.
 * Both streams and the status, every time.
 */
const probe = (command, args) => {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return {
    status: result.status ?? 1,
    out: `${result.stdout ?? ""}${result.stderr ?? ""}`,
  };
};

/**
 * Every signing finding for one artefact, each tagged with the question it
 * answers.
 *
 * The tags are what `--self-test` reads. A finding's prose is for a person and
 * will be reworded; the tag is what lets the inversion assert that *this
 * particular* check fired rather than that something, somewhere, failed —
 * which is how a self-test passes while three of four checks are blind.
 */
function signingFindings({ path, label, seals, hardened, assess }) {
  const found = [];
  const note = (tag, message) =>
    found.push({ tag, message: `${label}: ${message}` });

  const verified = probe("codesign", ["--verify", "--deep", "--strict", path]);
  if (verified.status !== 0) {
    note(
      "verify",
      `the signature does not verify, so macOS will call it damaged and offer only "Move to Bin": ${verified.out.trim()}`,
    );
  }

  const details = probe("codesign", ["-dv", "--verbose=4", path]).out;
  const adhoc = /^Signature=adhoc$/m.test(details);

  if (seals && /Sealed Resources=none/.test(details)) {
    note(
      "seal",
      "seals no resources — it was never signed as a bundle, only linker-signed",
    );
  }

  for (const [pattern, what] of AUTHORITY_CHAIN) {
    if (!pattern.test(details)) {
      note(
        "authority",
        `no ${what} in the authority chain — this is ${adhoc ? "an ad-hoc signature" : "not a Developer ID signature"}`,
      );
    }
  }

  if (!/^TeamIdentifier=[A-Z0-9]{10}$/m.test(details)) {
    note("team", "the signature carries no Team ID");
  }

  if (hardened) {
    const flags = details.match(
      /^CodeDirectory .*\bflags=0x[0-9a-f]+\(([^)]*)\)/m,
    );
    if (!(flags?.[1] ?? "").split(",").includes("runtime")) {
      note(
        "runtime",
        "the Hardened Runtime flag is not set, which notarization requires",
      );
    }
  }

  const assessed = probe("spctl", ["--assess", ...assess, "-vv", path]);
  if (assessed.status !== 0) {
    note(
      "spctl",
      `Gatekeeper rejects it — ${assessed.out.trim().split("\n").join(" / ")}`,
    );
  }

  const stapled = probe("xcrun", ["stapler", "validate", path]);
  if (stapled.status !== 0) {
    note(
      "staple",
      `no notarization ticket is stapled, so a first launch needs a round trip to Apple — ${stapled.out.trim().split("\n").pop()}`,
    );
  }

  return found;
}

/** The `.app`, and the one DMG the release ships beside it. */
function artefacts() {
  const dmgs = existsSync(DMG_DIR)
    ? readdirSync(DMG_DIR).filter((name) => name.endsWith(".dmg"))
    : [];
  if (dmgs.length !== 1) {
    fail(
      dmgs.length === 0
        ? `no DMG in ${DMG_DIR} — run npm run build:app first; the DMG is half of what is released and is notarized separately`
        : `${dmgs.length} DMGs in ${DMG_DIR} (${dmgs.join(", ")}) — the audit cannot tell which one is the release`,
    );
  }
  return [
    {
      path: APP_BUNDLE,
      label: "the app bundle",
      seals: true,
      hardened: true,
      assess: ["--type", "execute"],
    },
    ...dmgs.slice(0, 1).map((name) => ({
      path: join(DMG_DIR, name),
      label: `the DMG (${name})`,
      seals: false,
      hardened: false,
      // What Gatekeeper is asked when a person opens a downloaded disk image,
      // rather than when it launches an app.
      assess: ["--type", "open", "--context", "context:primary-signature"],
    })),
  ];
}

/**
 * The inversion: run the signing checks against an artefact in exactly the
 * state this ticket removed, and fail if any of them stays green.
 *
 * The subject is built rather than recorded. A fixture of captured `codesign`
 * output would pin this test to the wording of a tool that is free to change
 * its wording, and would keep passing after the real thing stopped being
 * readable — the failure mode the symbol-count floor exists for, one level up.
 * So a throwaway `.app` is assembled from the CLI the bundle already ships, and
 * signed **ad-hoc**, which is what `signingIdentity: "-"` produces and what
 * every candidate through Step 17 shipped.
 *
 * It is signed rather than left bare on purpose. An unsigned directory would
 * fail every check at once, including the two that were always here, and a
 * green run would prove nothing about the four that LC-47 added. A correctly
 * ad-hoc-signed bundle separates them: it verifies, it seals its resources —
 * so `verify` and `seal` must *not* fire — and it has no Developer ID, no Team
 * ID, no Hardened Runtime, no Gatekeeper acceptance and no stapled ticket, so
 * the other five must. Both halves are asserted. A self-test that only checks
 * that something failed is satisfied by a guard that is blind everywhere but
 * one place.
 */
const INFO_PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleExecutable</key><string>Probe</string>
<key>CFBundleIdentifier</key><string>io.longclaw.binary-audit.self-test</string>
<key>CFBundleName</key><string>Probe</string>
<key>CFBundlePackageType</key><string>APPL</string>
</dict></plist>
`;

const MUST_FIRE = ["authority", "team", "runtime", "spctl", "staple"];
const MUST_NOT_FIRE = ["verify", "seal"];

/**
 * The network-shape inversion (LC-256a).
 *
 * The signing self-test below builds its subject; this one writes its readings
 * out, because a reading is what `nm` and `otool` hand over and there is no
 * cheaper way to produce a binary that links a framework it should not. Four
 * cases, and both directions matter:
 *
 * - the shape ADR 0014 describes must stay green;
 * - **the pre-amendment shape** — no socket imports, no network frameworks —
 *   must now go red for the window, because that is a build with no update path
 *   and this script's sets describe one that has it;
 * - **one extra socket call** must go red, which is what the old forbidden list
 *   was for and what deleting it would have lost;
 * - **one extra framework** must go red for the same reason.
 */
function networkShapeSelfTest() {
  const window_ = BINARIES.find((binary) => binary.name === "longclaw-desktop");
  const cli = BINARIES.find((binary) => binary.name === "longclaw");
  const linked = (...names) =>
    names.map(
      (name) =>
        `/System/Library/Frameworks/${name}.framework/Versions/A/${name}`,
    );

  return [
    {
      what: "the window in the shape ADR 0014 describes",
      binary: window_,
      symbols: window_.socketApi,
      libraries: linked("Security", "SystemConfiguration"),
      red: false,
    },
    {
      what: "the CLI, which imports no socket call at all",
      binary: cli,
      symbols: [],
      libraries: linked("Security", "SystemConfiguration"),
      red: false,
    },
    {
      what: "the window in its pre-amendment shape, with no update path",
      binary: window_,
      symbols: [],
      libraries: [],
      red: true,
    },
    {
      what: "the window with one socket call more than the update path needs",
      binary: window_,
      symbols: [...window_.socketApi, "_sendto"],
      libraries: linked("Security", "SystemConfiguration"),
      red: true,
    },
    {
      what: "the window linking one network framework more",
      binary: window_,
      symbols: window_.socketApi,
      libraries: linked("Security", "SystemConfiguration", "CFNetwork"),
      red: true,
    },
    {
      what: "the CLI having acquired a socket call",
      binary: cli,
      symbols: ["_connect"],
      libraries: linked("Security", "SystemConfiguration"),
      red: true,
    },
  ];
}

/** The key-id comparison, against a pair that agrees and a pair that does not. */
function updaterKeySelfTest() {
  const wrap = (keyId) =>
    Buffer.from(
      `untrusted comment: probe\n${Buffer.concat([
        Buffer.from([0x45, 0x64]),
        Buffer.from(keyId, "hex"),
        Buffer.alloc(32),
      ]).toString("base64")}\n`,
    ).toString("base64");

  return [
    {
      what: "a key id read back from its own key",
      wrapped: wrap("0123456789abcdef"),
      expect: "0123456789abcdef",
    },
    {
      what: "a different key",
      wrapped: wrap("fedcba9876543210"),
      expect: "fedcba9876543210",
    },
    {
      what: "something that is not a key",
      wrapped: "bm90IGEga2V5",
      expect: null,
    },
  ];
}

if (SELF_TEST) {
  const shapeWrong = networkShapeSelfTest().filter(
    (probe) =>
      networkShapeFindings(probe.binary, probe.symbols, probe.libraries)
        .length >
        0 !==
      probe.red,
  );
  const keyWrong = updaterKeySelfTest().filter(
    (probe) => minisignKeyId(probe.wrapped) !== probe.expect,
  );
  if (shapeWrong.length > 0 || keyWrong.length > 0) {
    console.error(
      "binary-audit --self-test: the network inversion did not hold\n" +
        shapeWrong
          .map(
            (probe) =>
              `  ${probe.red ? "stayed green on" : "went red on"}: ${probe.what}`,
          )
          .concat(keyWrong.map((probe) => `  misread: ${probe.what}`))
          .join("\n"),
    );
    process.exit(1);
  }

  const scratch = mkdtempSync(join(tmpdir(), "binary-audit-self-test-"));
  const bundle = join(scratch, "Probe.app");
  try {
    mkdirSync(join(bundle, "Contents/MacOS"), { recursive: true });
    copyFileSync(
      join(MACOS_DIR, "longclaw"),
      join(bundle, "Contents/MacOS/Probe"),
    );
    writeFileSync(join(bundle, "Contents/Info.plist"), INFO_PLIST);

    const signed = probe("codesign", ["--force", "--sign", "-", bundle]);
    if (signed.status !== 0) {
      console.error(
        `binary-audit --self-test: could not ad-hoc sign the probe bundle, so the inversion never ran: ${signed.out.trim()}`,
      );
      process.exit(1);
    }

    const tags = new Set(
      signingFindings({
        path: bundle,
        label: "the self-test bundle",
        seals: true,
        hardened: true,
        assess: ["--type", "execute"],
      }).map(({ tag }) => tag),
    );

    const blind = MUST_FIRE.filter((tag) => !tags.has(tag));
    const overshot = MUST_NOT_FIRE.filter((tag) => tags.has(tag));
    if (blind.length > 0 || overshot.length > 0) {
      console.error(
        "binary-audit --self-test: the inversion did not hold\n" +
          (blind.length > 0
            ? `  an ad-hoc bundle still passes: ${blind.join(", ")} — the guard is blind there\n`
            : "") +
          (overshot.length > 0
            ? `  a correctly sealed bundle was faulted for: ${overshot.join(", ")} — the probe is failing for the wrong reason, so a green run proves nothing\n`
            : ""),
      );
      process.exit(1);
    }
    console.log(
      `binary-audit --self-test: the network sets accept ${networkShapeSelfTest().filter((probe) => !probe.red).length} sanctioned shapes and reject ${networkShapeSelfTest().filter((probe) => probe.red).length} broad ones; an ad-hoc bundle is caught on ${MUST_FIRE.join(", ")}, and is not faulted for ${MUST_NOT_FIRE.join(" or ")}`,
    );
    process.exit(0);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

if (existsSync(APP_BUNDLE)) {
  for (const artefact of artefacts()) {
    for (const { message } of signingFindings(artefact)) fail(message);
  }
  for (const { message } of updaterKeyFindings()) fail(message);
} else {
  fail(
    `no app bundle at ${APP_BUNDLE} to check the signature of — run npm run build:app first`,
  );
}

report({
  name: "binary-audit",
  findings,
  checked: importedSymbols,
  noun: `imported symbols and ${linkedLibraries} linked libraries across ${BINARIES.length} bundled binaries`,
  remedy:
    "finding(s) in the shipped binaries — the v0 boundary is docs/acceptance/release-candidate.md:",
  clean:
    "no telemetry in either shipped binary, exactly the socket API and network frameworks ADR 0014 sanctions and no others, no socket call at all from the CLI, the update path present in the window, the manifest signed by the key the bundle carries, the CLI beside the window on the same architecture, and both the bundle and the DMG verifying, sealing what they should, carrying a Developer ID chain and the Hardened Runtime flag, accepted by Gatekeeper and with a notarization ticket stapled (controls passed; the webview is out of scope and stays a manual pass)",
});
