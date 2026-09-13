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

import { execFileSync, spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
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
    setsTheArchitecture: false,
  },
];

const findings = [];
const fail = (message) => findings.push(message);

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

  for (const marker of [
    "reqwest",
    "hyper_util",
    "rustls",
    "native_tls",
    "h2::",
    "sentry",
  ]) {
    if (symbols.includes(marker)) {
      fail(`${label}: network or telemetry symbols linked in: ${marker}`);
    }
  }

  // The Rust side reaches the network through libSystem or not at all. These are
  // the imports it would need; none of them is used by local file work.
  for (const stub of ["_connect", "_socket", "_sendto", "_getaddrinfo"]) {
    if (undefined_.some((symbol) => symbol === stub)) {
      fail(`${label}: the binary imports the socket API: ${stub}`);
    }
  }

  for (const framework of [
    "CFNetwork",
    "Network.framework",
    "Security.framework",
  ]) {
    if (libraries.some((library) => library.includes(framework))) {
      fail(
        `${label}: a network-capable system framework is linked: ${framework}`,
      );
    }
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

if (SELF_TEST) {
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
      `binary-audit --self-test: an ad-hoc bundle is caught on ${MUST_FIRE.join(", ")}, and is not faulted for ${MUST_NOT_FIRE.join(" or ")}`,
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
    "no HTTP client, telemetry, socket import, or network framework in either shipped binary, the CLI ships beside the window on the same architecture, and both the bundle and the DMG verify, seal what they should, carry a Developer ID chain and the Hardened Runtime flag, are accepted by Gatekeeper and have a notarization ticket stapled (controls passed; the webview is out of scope and stays a manual pass)",
});
