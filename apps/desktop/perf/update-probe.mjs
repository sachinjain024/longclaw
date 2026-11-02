/**
 * `npm run probe:update` — the bundle replacement against a real built bundle
 * (LC-267r, spec seam 4). The cases live in `src-tauri/tests/update_probe.rs`;
 * this finds what they run against and says how to read the result.
 *
 *   --bundle <path>    the built LongClaw.app (default: the one `build:app` made)
 *   --archive <path>   a release archive to put through the unpack (default:
 *                      the newest `*.app.tar.gz` the bundler left in bundle/dmg)
 *   --allow-skip       accept a case that could not be driven, and say so
 *   --self-test        drive the plugin's delete-first order through the same
 *                      failure; passes only if the probe sees the app lost
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tauriRoot = join(appRoot, "src-tauri");
const args = process.argv.slice(2);
const option = (name) => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};

const bundle = resolve(
  option("--bundle") ??
    join(tauriRoot, "target/release/bundle/macos/LongClaw.app"),
);
if (!existsSync(bundle)) {
  console.error(
    `probe:update: no built bundle at ${bundle}. Run \`npm run build:app\` first, or pass --bundle.`,
  );
  process.exit(1);
}

function newestReleaseArchive() {
  const dir = join(tauriRoot, "target/release/bundle/dmg");
  if (!existsSync(dir)) return undefined;
  return readdirSync(dir)
    .filter((name) => name.endsWith(".app.tar.gz"))
    .map((name) => join(dir, name))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
}
const archive = option("--archive") ?? newestReleaseArchive();

const env = { ...process.env, LONGCLAW_PROBE_BUNDLE: bundle };
if (archive) env.LONGCLAW_PROBE_RELEASE_ARCHIVE = resolve(archive);
if (args.includes("--allow-skip")) env.LONGCLAW_PROBE_ALLOW_SKIP = "1";
if (args.includes("--self-test")) env.LONGCLAW_PROBE_SELF_TEST = "1";

const run = spawnSync(
  "cargo",
  [
    "test",
    "--manifest-path",
    join(tauriRoot, "Cargo.toml"),
    "--features",
    "update-probe",
    "--test",
    "update_probe",
    "--",
    "--ignored",
    "--nocapture",
    "--test-threads=1",
  ],
  { env, stdio: "inherit" },
);
process.exit(run.status ?? 1);
