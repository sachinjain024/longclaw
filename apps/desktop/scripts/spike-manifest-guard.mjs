import { existsSync } from "node:fs";
import { relative, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "../../..");
const forbidden = [
  "spikes/tauri-v2-architecture/package.json",
  "spikes/tauri-v2-architecture/package-lock.json",
  "spikes/tauri-v2-architecture/src-tauri/Cargo.toml",
  "spikes/tauri-v2-architecture/src-tauri/Cargo.lock",
];

const present = forbidden.filter((path) => existsSync(resolve(repoRoot, path)));

if (present.length > 0) {
  console.error(
    [
      "Archived spikes must not expose package-manager manifests.",
      "They are non-shipping evidence and would be scanned as live dependency surfaces:",
      ...present.map(
        (path) => `- ${relative(repoRoot, resolve(repoRoot, path))}`,
      ),
    ].join("\n"),
  );
  process.exit(1);
}

console.log(
  "spike-manifest-guard: archived spikes expose no dependency manifests",
);
