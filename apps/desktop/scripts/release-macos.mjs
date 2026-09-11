#!/usr/bin/env node
/**
 * The signed, notarized macOS release (LC-47), as a script rather than as a
 * paragraph someone re-derives a year later.
 *
 * `npm run build:app` is the *unsigned* build, and it stays that way: the
 * committed `bundle.macOS.signingIdentity` is `"-"`, CI runs that build on
 * every pull request holding no certificate, and it must keep producing an
 * openable ad-hoc bundle. This script is the other branch. It sets
 * `APPLE_SIGNING_IDENTITY`, which the bundler prefers over the configured
 * value, so nothing in the repository has to name an identity that only one
 * machine holds.
 *
 * **Why notarization is not Tauri's.** Tauri will notarize during `tauri build`,
 * but only from `APPLE_API_KEY` + `APPLE_API_ISSUER` + `APPLE_API_KEY_PATH` or
 * an Apple ID and app-specific password — it has no notion of a `notarytool`
 * keychain profile. Both of those want a credential sitting in a file or an
 * environment variable at build time; the profile keeps it in the keychain,
 * which is why the `.p8` could be destroyed after it was stored. So the build
 * signs and this script notarizes.
 *
 * **Why the DMG is rebuilt.** Notarization produces a ticket per artefact, and
 * stapling is what lets a first launch happen with no network — the case that
 * matters most for a tool that claims to need none. The `.app` inside the DMG
 * is a different copy from the one on disk, so stapling the one on disk leaves
 * the one a user actually drags out unstapled. Re-running `tauri build` would
 * re-sign the app and invalidate the ticket it just earned, so the DMG is
 * opened read-write, the app inside it is stapled in place, and it is sealed
 * back up. Tauri's own window layout and background survive that; a DMG built
 * from scratch here would not have them.
 *
 * **It can be run again.** Apple's notary service takes minutes, and the first
 * submission from a new Team ID took long enough that it read as a hang and was
 * killed — which cancels nothing, because the submission is Apple's and carries
 * on without the local `--wait`. Starting over from the build would then re-sign
 * the app into a different CDHash and abandon a ticket that was about to exist.
 * So each artefact's work is skipped when `stapler` says it is already done, and
 * `--no-build` keeps a rebuild from re-signing away a ticket already earned.
 * Re-running after any interruption is the correct move, and costs only what is
 * genuinely still missing.
 *
 * Usage: npm run release:macos [-- --no-build]
 *   APPLE_SIGNING_IDENTITY   required, e.g. "Developer ID Application: … (TEAMID)"
 *   LONGCLAW_NOTARY_PROFILE  optional, defaults to longclaw-notary
 *   --no-build               notarize the artefacts already in target/, rather
 *                            than building fresh ones
 *
 * Afterwards: `npm run release:binary-audit`, which fails on every state this
 * script exists to leave behind.
 */

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  renameSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BUNDLE_DIR = join(appRoot, "src-tauri/target/release/bundle");
const APP_BUNDLE = join(BUNDLE_DIR, "macos/LongClaw.app");
const DMG_DIR = join(BUNDLE_DIR, "dmg");

const identity = process.env.APPLE_SIGNING_IDENTITY;
const profile = process.env.LONGCLAW_NOTARY_PROFILE ?? "longclaw-notary";
const rebuild = !process.argv.includes("--no-build");

/** Does this artefact already carry a stapled notarization ticket? */
const stapled = (path) =>
  spawnSync("xcrun", ["stapler", "validate", path], { encoding: "utf8" })
    .status === 0;

/**
 * Try to staple, and say whether it worked.
 *
 * `stapler staple` asks Apple for the ticket matching this artefact's CDHash,
 * so a success means "Apple has already notarized exactly this code" and a
 * failure means "it has not" — which is the question worth asking before
 * spending fifteen minutes of the notary queue on a resubmission. Asking
 * instead whether a staple is *currently attached* gets this wrong in the one
 * case that matters: a rebuild re-signs the bundle and strips the staple, and
 * if the code did not change the CDHash is identical and the old ticket still
 * applies. That happened here, and re-uploading would have been the cost of
 * asking the easier question.
 */
const tryStaple = (path) =>
  spawnSync("xcrun", ["stapler", "staple", path], { stdio: "inherit" })
    .status === 0;

const die = (message) => {
  console.error(`release-macos: ${message}`);
  process.exit(1);
};

if (!identity) {
  die(
    "APPLE_SIGNING_IDENTITY is not set. It is the certificate's full name —\n" +
      "  security find-identity -v -p codesigning\n" +
      "names it. Without it this would build the same ad-hoc bundle as npm run build:app.",
  );
}

/** Run a command, showing its output, and stop the release if it fails. */
const step = (what, command, args, options = {}) => {
  console.log(`\n▸ ${what}\n  ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.status !== 0)
    die(`${what} failed (exit ${result.status ?? "signal"})`);
};

/* A mounted volume of the same name makes `bundle_dmg.sh` fail with nothing but
   "failed to run", which reads as a broken build and is not one. Acceptance
   testing mounts these by the handful, so say it plainly before the build eats
   twenty minutes. */
const mounted =
  rebuild && existsSync("/Volumes")
    ? readdirSync("/Volumes").filter(
        (name) => name.startsWith("LongClaw") || name.startsWith("dmg."),
      )
    : [];
if (mounted.length > 0) {
  die(
    `these volumes are mounted and will make the DMG step fail (a dmg.* one is a previous run's leftover):\n  ${mounted
      .map((name) => `/Volumes/${name}`)
      .join("\n  ")}\nEject them (hdiutil detach) and run this again.`,
  );
}

if (rebuild) {
  console.log(
    "\n⚠ `bundle_dmg.sh` mounts the image and drives a Finder window to lay it out.\n" +
      "  Leave it alone while it works — clicking in it, or dragging the app out of it,\n" +
      '  fails the DMG step with nothing but "failed to run".',
  );
  step("Building and signing", "npm", ["run", "build:app"], {
    cwd: appRoot,
    env: { ...process.env, APPLE_SIGNING_IDENTITY: identity },
  });
} else if (!existsSync(APP_BUNDLE)) {
  die(`--no-build, but there is no bundle at ${APP_BUNDLE} to notarize`);
}

const dmgs = readdirSync(DMG_DIR).filter((name) => name.endsWith(".dmg"));
if (dmgs.length !== 1)
  die(`expected one DMG in ${DMG_DIR}, found ${dmgs.length}`);
const dmg = join(DMG_DIR, dmgs[0]);

const scratch = mkdtempSync(join(tmpdir(), "longclaw-release-"));
const zipped = join(scratch, "LongClaw.zip");
const readWrite = join(scratch, "rw.dmg");
const repacked = join(scratch, "repacked.dmg");
const mountPoint = join(scratch, "mnt");

try {
  console.log("\n▸ Asking Apple whether this exact build is already notarized");
  if (tryStaple(APP_BUNDLE)) {
    console.log(
      "  it is — stapled from the existing ticket, with no resubmission",
    );
  } else {
    /* notarytool takes a zip, a DMG or a pkg — never a bare .app — and `ditto`
       is the one archiver that preserves the signature's symlinks and xattrs. */
    step("Archiving the app for submission", "ditto", [
      "-c",
      "-k",
      "--keepParent",
      APP_BUNDLE,
      zipped,
    ]);
    step("Notarizing the app (this uploads it to Apple)", "xcrun", [
      "notarytool",
      "submit",
      zipped,
      "--keychain-profile",
      profile,
      "--wait",
    ]);
    step("Stapling the app", "xcrun", ["stapler", "staple", APP_BUNDLE]);
  }
  if (!stapled(APP_BUNDLE)) die("the app still has no stapled ticket");

  /* `process.exit` here would skip the `finally` below and leak the scratch
     directory, so what follows is a branch rather than an early return. */
  if (stapled(dmg)) {
    console.log(
      "\n▸ The DMG already has a ticket stapled — nothing left to do",
    );
  } else {
    // The app inside the DMG is a second copy and has to be stapled where it
    // lies, which means opening the image read-write and sealing it again.
    step("Opening the DMG read-write", "hdiutil", [
      "convert",
      dmg,
      "-format",
      "UDRW",
      "-o",
      readWrite,
    ]);
    step("Mounting it", "hdiutil", [
      "attach",
      readWrite,
      "-mountpoint",
      mountPoint,
      "-nobrowse",
      "-noverify",
    ]);
    try {
      const inside = readdirSync(mountPoint).filter((name) =>
        name.endsWith(".app"),
      );
      if (inside.length !== 1)
        die(`expected one .app in the DMG, found ${inside.length}`);
      step("Stapling the app inside the DMG", "xcrun", [
        "stapler",
        "staple",
        join(mountPoint, inside[0]),
      ]);
    } finally {
      spawnSync("hdiutil", ["detach", mountPoint], { stdio: "inherit" });
    }
    step("Sealing the DMG back up", "hdiutil", [
      "convert",
      readWrite,
      "-format",
      "UDZO",
      "-o",
      repacked,
    ]);

    /* The image's bytes changed, so its signature and any ticket it carried are
     both stale: sign the new one, then notarize *that*. */
    rmSync(dmg);
    renameSync(repacked, dmg);
    step("Signing the DMG", "codesign", ["--force", "--sign", identity, dmg]);
    step("Notarizing the DMG (this uploads it to Apple)", "xcrun", [
      "notarytool",
      "submit",
      dmg,
      "--keychain-profile",
      profile,
      "--wait",
    ]);
    step("Stapling the DMG", "xcrun", ["stapler", "staple", dmg]);
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

console.log(
  `\nrelease-macos: signed as ${identity}, notarized through ${profile}, and stapled.\n` +
    `  ${APP_BUNDLE}\n  ${dmg}\n\nNow run: npm run release:binary-audit`,
);
