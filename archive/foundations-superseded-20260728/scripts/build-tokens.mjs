import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const foundationDirectory = resolve(scriptDirectory, "..");
const sourcePath = resolve(
  foundationDirectory,
  "tokens",
  "design-tokens.json",
);
const outputPath = resolve(
  foundationDirectory,
  "tokens",
  "design-tokens.css",
);

const source = JSON.parse(await readFile(sourcePath, "utf8"));

const declarations = (tokens) =>
  Object.entries(tokens)
    .map(([name, value]) => `  --lc-${name}: ${value};`)
    .join("\n");

const blocks = [
  `/* Generated from design-tokens.json v${source.version}. Do not edit by hand. */`,
  "",
  ":root {",
  declarations(source.system),
  "}",
];

for (const [appearance, tokens] of Object.entries(source.appearances)) {
  blocks.push(
    "",
    `:root[data-appearance="${appearance}"],`,
    `[data-appearance="${appearance}"] {`,
    declarations(tokens),
    "}",
  );
}

for (const [theme, definition] of Object.entries(source.themes)) {
  for (const appearance of ["light", "dark"]) {
    blocks.push(
      "",
      `:root[data-theme="${theme}"][data-appearance="${appearance}"],`,
      `[data-theme="${theme}"][data-appearance="${appearance}"] {`,
      declarations(definition[appearance]),
      "}",
    );
  }
}

blocks.push(
  "",
  "@media (prefers-reduced-motion: reduce) {",
  "  :root {",
  "    --lc-motion-duration-hover: 0ms;",
  "    --lc-motion-duration-state: 0ms;",
  "    --lc-motion-duration-panel: 0ms;",
  "    --lc-motion-duration-agent-pulse: 0ms;",
  "    --lc-motion-agent-pulse-iterations: 1;",
  "  }",
  "}",
  "",
);

await writeFile(outputPath, blocks.join("\n"));
console.log(`Wrote ${outputPath}`);
