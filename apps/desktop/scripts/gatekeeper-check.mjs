#!/usr/bin/env node
/**
 * Does a downloaded release open on a machine that has never seen it (LC-47)?
 *
 * A locally built artefact has never been downloaded, so it carries no
 * `com.apple.quarantine` attribute, so Gatekeeper never runs on it — which is
 * why every check before `82dac6b` was green on a bundle macOS would have
 * called *"damaged"*. This gives the DMG the attribute Safari would write, and
 * then follows the path a person actually takes: mount it, drag the app out,
 * and ask Gatekeeper about the copy rather than about the image.
 *
 * **The copy is the subject.** The app inside the DMG and the app in
 * `/Applications` are different files, and only the second one is ever
 * launched. A ticket stapled to the image alone leaves that copy needing a
 * round trip to Apple on first launch, which is exactly what a tool that claims
 * to need no network should not ask for. So the staple is asserted on the copy.
 *
 * **`--phase offline` is the case that matters, and it is why this is a script
 * rather than something an agent runs.** Driving it from a Claude Code session
 * is impossible by construction: the session needs the network that the test
 * requires be absent. So it runs alone, writes its own transcript, and is read
 * afterwards.
 *
 * A claimed phase that does not match the machine is refused rather than
 * recorded. An "offline pass" produced on a connected machine is worse than no
 * run at all — it is the same failure as a quarantine check on an artefact that
 * was never quarantined, one level up, and it is the whole reason this file
 * exists.
 *
 * Gatekeeper caches its verdicts per quarantine UUID, so each run works on a
 * fresh copy with a fresh UUID. Re-running against the same file would be
 * reading back an answer given earlier, possibly online.
 *
 * Usage:
 *   npm run release:gatekeeper-check -- --phase online
 *   npm run release:gatekeeper-check -- --phase offline   (with the network off)
 */

import { spawnSync } from "node:child_process";
import { connect } from "node:net";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DMG_DIR = join(appRoot, "src-tauri/target/release/bundle/dmg");
const RECORD_DIR = "/Users/Shared/longclaw-acceptance";

const phaseArg = process.argv.indexOf("--phase");
const phase = phaseArg === -1 ? null : process.argv[phaseArg + 1];
if (phase !== "online" && phase !== "offline") {
  console.error(
    "gatekeeper-check: --phase online|offline is required — the run is only\n" +
      "meaningful as a claim about one of them, and the claim is checked.",
  );
  process.exit(1);
}

const lines = [];
const say = (line) => {
  console.log(line);
  lines.push(line);
};
const findings = [];

const run = (command, args) => {
  const result = spawnSync(command, args, { encoding: "utf8" });
  return {
    status: result.status ?? 1,
    out: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim(),
  };
};

/** Can we open a TCP connection to `host:443` within a second and a half? */
const reachable = (host) =>
  new Promise((done) => {
    const socket = connect({ host, port: 443, timeout: 1500 });
    const answer = (value) => {
      socket.destroy();
      done(value);
    };
    socket.on("connect", () => answer(true));
    socket.on("error", () => answer(false));
    socket.on("timeout", () => answer(false));
  });

/* The two hosts Gatekeeper itself would reach for: CloudKit serves the
   notarization lookup, and OCSP answers certificate revocation. If either is
   reachable the machine is not offline, whatever the flag says. */
const APPLE_HOSTS = ["api.apple-cloudkit.com", "ocsp.apple.com"];

const check = (label, ok, detail) => {
  say(`  ${ok ? "pass" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) findings.push(label);
};

const reachability = await Promise.all(APPLE_HOSTS.map(reachable));
const online = reachability.some(Boolean);
say(`gatekeeper-check --phase ${phase}   ${new Date().toISOString()}`);
say(
  `network: ${APPLE_HOSTS.map((host, at) => `${host} ${reachability[at] ? "reachable" : "unreachable"}`).join(", ")}`,
);
if (phase === "offline" && online) {
  console.error(
    "\ngatekeeper-check: --phase offline, but Apple is reachable. Refusing to record an\n" +
      "offline pass from a connected machine — turn the network off and run it again.",
  );
  process.exit(1);
}
if (phase === "online" && !online) {
  console.error(
    "\ngatekeeper-check: --phase online, but Apple is not reachable. The run would prove\n" +
      "nothing about the online path.",
  );
  process.exit(1);
}

const dmgs = existsSync(DMG_DIR)
  ? readdirSync(DMG_DIR).filter((name) => name.endsWith(".dmg"))
  : [];
if (dmgs.length !== 1) {
  console.error(
    `gatekeeper-check: expected one DMG in ${DMG_DIR}, found ${dmgs.length}`,
  );
  process.exit(1);
}
const source = join(DMG_DIR, dmgs[0]);

const scratch = mkdtempSync(join(tmpdir(), "gatekeeper-check-"));
const dmg = join(scratch, dmgs[0]);
const mount = join(scratch, "mnt");
const dragged = join(scratch, "LongClaw.app");

try {
  say(`\nartefact: ${source}`);
  run("cp", [source, dmg]);

  /* The value a browser writes: flags, a timestamp, the agent, and a UUID that
     is the key Gatekeeper caches its verdict under. Fresh every run. */
  const uuid = run("uuidgen").out;
  const stamp = Math.floor(Date.now() / 1000).toString(16);
  run("xattr", [
    "-w",
    "com.apple.quarantine",
    `0081;${stamp};Safari;${uuid}`,
    dmg,
  ]);
  say(`quarantine: ${run("xattr", ["-p", "com.apple.quarantine", dmg]).out}`);

  say("\nthe downloaded disk image");
  const dmgAssess = run("spctl", [
    "--assess",
    "--type",
    "open",
    "--context",
    "context:primary-signature",
    "-vv",
    dmg,
  ]);
  check(
    "Gatekeeper accepts the DMG",
    dmgAssess.status === 0 &&
      /source=Notarized Developer ID/.test(dmgAssess.out),
    dmgAssess.out.split("\n").join(" / "),
  );
  check(
    "the DMG carries a stapled ticket",
    run("xcrun", ["stapler", "validate", dmg]).status === 0,
  );

  const mounted = run("hdiutil", [
    "attach",
    dmg,
    "-mountpoint",
    mount,
    "-nobrowse",
    "-readonly",
  ]);
  if (mounted.status !== 0) {
    console.error(`gatekeeper-check: could not mount the DMG: ${mounted.out}`);
    process.exit(1);
  }
  try {
    const inside = readdirSync(mount).filter((name) => name.endsWith(".app"));
    if (inside.length !== 1) {
      console.error(`gatekeeper-check: expected one .app in the DMG`);
      process.exit(1);
    }
    run("cp", ["-R", join(mount, inside[0]), dragged]);
  } finally {
    run("hdiutil", ["detach", mount]);
  }

  say("\nthe app a person drags out of it");
  const inherited = run("xattr", ["-p", "com.apple.quarantine", dragged]);
  check(
    "the copy is quarantined, so Gatekeeper runs on it at all",
    inherited.status === 0,
    inherited.out,
  );
  check(
    "the copy carries the stapled ticket, which is what makes an offline launch possible",
    run("xcrun", ["stapler", "validate", dragged]).status === 0,
  );
  const appAssess = run("spctl", [
    "--assess",
    "--type",
    "execute",
    "-vv",
    dragged,
  ]);
  check(
    "Gatekeeper accepts the copy",
    appAssess.status === 0 &&
      /source=Notarized Developer ID/.test(appAssess.out),
    appAssess.out.split("\n").join(" / "),
  );

  /* The last assertion is a person's, and it cannot be made about a file that
     has been deleted: `spctl` answers the same question Gatekeeper does, but
     "no dialog appeared" is only observable by someone watching the screen. So
     the dragged copy outlives the run. `ditto` rather than `cp`, because the
     quarantine attribute is the whole point of it and a copy that loses it is
     a copy Gatekeeper will not even look at. */
  mkdirSync(RECORD_DIR, { recursive: true });
  const kept = join(RECORD_DIR, `LongClaw-${phase}.app`);
  rmSync(kept, { recursive: true, force: true });
  run("ditto", [dragged, kept]);
  const keptQuarantine = run("xattr", ["-p", "com.apple.quarantine", kept]);
  check(
    "the kept copy is still quarantined, so double-clicking it is a real first launch",
    keptQuarantine.status === 0,
    keptQuarantine.out,
  );

  say(
    `\n${findings.length === 0 ? "PASS" : `FAIL (${findings.length})`} — ${phase}`,
  );
  if (findings.length === 0) {
    say(
      `The last step is yours: double-click ${kept}\n` +
        "It should simply open — no dialog at all, and in the offline phase no network.",
    );
  }
} finally {
  mkdirSync(RECORD_DIR, { recursive: true });
  const record = join(RECORD_DIR, `gatekeeper-${phase}.txt`);
  appendFileSync(record, `${lines.join("\n")}\n\n`);
  console.log(`\nrecorded in ${record}`);
  rmSync(scratch, { recursive: true, force: true });
}

process.exit(findings.length === 0 ? 0 : 1);
