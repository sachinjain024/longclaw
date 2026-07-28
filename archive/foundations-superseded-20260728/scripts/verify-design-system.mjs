import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const foundationDirectory = resolve(scriptDirectory, "..");

const [sourceText, css, proof, gallery, glyphs] = await Promise.all([
  readFile(
    resolve(foundationDirectory, "tokens", "design-tokens.json"),
    "utf8",
  ),
  readFile(
    resolve(foundationDirectory, "tokens", "design-tokens.css"),
    "utf8",
  ),
  readFile(
    resolve(foundationDirectory, "proof", "board-theme-proof.html"),
    "utf8",
  ),
  readFile(
    resolve(foundationDirectory, "proof", "component-gallery.html"),
    "utf8",
  ),
  readFile(resolve(foundationDirectory, "assets", "glyphs.svg"), "utf8"),
]);

const source = JSON.parse(sourceText);
const failures = [];
const assertions = [];
const contrastResults = [];
const colorVisionResults = [];

function assert(condition, description) {
  assertions.push({ condition, description });
  if (!condition) failures.push(description);
}

function rgb(hex) {
  const match = /^#([0-9A-F]{6})$/i.exec(hex);
  if (!match) throw new Error(`Expected six-digit hex color, received ${hex}`);
  return [0, 2, 4].map(
    (offset) => Number.parseInt(match[1].slice(offset, offset + 2), 16) / 255,
  );
}

function linearize(channel) {
  return channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const [red, green, blue] = rgb(hex).map(linearize);
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function contrast(foreground, background) {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function assertContrast({
  name,
  foreground,
  background,
  minimum = 4.5,
}) {
  const ratio = contrast(foreground, background);
  contrastResults.push({ name, foreground, background, ratio, minimum });
  assert(
    ratio >= minimum,
    `${name}: ${ratio.toFixed(2)}:1 is below ${minimum}:1`,
  );
}

const cvdMatrices = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

function simulate(hex, matrix) {
  const channels = rgb(hex).map(linearize);
  return matrix.map((row) =>
    Math.max(
      0,
      Math.min(
        1,
        row.reduce(
          (sum, coefficient, index) =>
            sum + coefficient * channels[index],
          0,
        ),
      ),
    ),
  );
}

function oklab([red, green, blue]) {
  let l = 0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue;
  let m = 0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue;
  let s = 0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue;

  l = Math.cbrt(l);
  m = Math.cbrt(m);
  s = Math.cbrt(s);

  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabDistance(a, b, matrix) {
  const first = oklab(matrix ? simulate(a, matrix) : rgb(a).map(linearize));
  const second = oklab(matrix ? simulate(b, matrix) : rgb(b).map(linearize));
  return Math.hypot(...first.map((value, index) => value - second[index]));
}

assert(source.version === "1.0.0", "Token version must be 1.0.0");
assert(
  JSON.stringify(Object.keys(source.themes)) ===
    JSON.stringify(["indigo", "clay", "azure", "orchid"]),
  "The fixed theme set must be Indigo, Clay, Azure, and Orchid in that order",
);
assert(
  JSON.stringify(Object.keys(source.appearances)) ===
    JSON.stringify(["light", "dark"]),
  "The appearance set must be light and dark",
);

for (const [name, value] of Object.entries(source.system)) {
  assert(
    css.includes(`--lc-${name}: ${value};`),
    `Generated CSS is missing system token ${name}`,
  );
}

for (const [appearance, tokens] of Object.entries(source.appearances)) {
  for (const [name, value] of Object.entries(tokens)) {
    assert(
      css.includes(`--lc-${name}: ${value};`),
      `Generated CSS is missing ${appearance} token ${name}`,
    );
  }
}

for (const [themeName, theme] of Object.entries(source.themes)) {
  for (const appearance of ["light", "dark"]) {
    for (const [name, value] of Object.entries(theme[appearance])) {
      assert(
        css.includes(`--lc-${name}: ${value};`),
        `Generated CSS is missing ${themeName}/${appearance} token ${name}`,
      );
    }
  }
}

for (const appearance of ["light", "dark"]) {
  const tokens = source.appearances[appearance];
  const surfaces = {
    surface: tokens["color-surface"],
    canvas: tokens["color-canvas"],
  };

  for (const [surfaceName, background] of Object.entries(surfaces)) {
    for (const textToken of [
      "color-text",
      "color-text-secondary",
      "color-text-muted",
    ]) {
      assertContrast({
        name: `${appearance}/${textToken} on ${surfaceName}`,
        foreground: tokens[textToken],
        background,
      });
    }

    for (const feedbackToken of [
      "color-warning",
      "color-danger",
      "color-info",
    ]) {
      assertContrast({
        name: `${appearance}/${feedbackToken} on ${surfaceName}`,
        foreground: tokens[feedbackToken],
        background,
      });
    }

    for (const status of [
      "backlog",
      "todo",
      "in-progress",
      "in-review",
      "done",
      "canceled",
    ]) {
      assertContrast({
        name: `${appearance}/status-${status} on ${surfaceName}`,
        foreground: tokens[`color-status-${status}`],
        background,
      });
    }
  }

  assertContrast({
    name: `${appearance}/strong control border`,
    foreground: tokens["color-border-strong"],
    background: tokens["color-surface"],
    minimum: 3,
  });

  for (const feedback of ["warning", "danger", "info"]) {
    assertContrast({
      name: `${appearance}/${feedback} on soft feedback surface`,
      foreground: tokens[`color-${feedback}`],
      background: tokens[`color-${feedback}-soft`],
    });
  }

  for (const label of [
    "slate",
    "blue",
    "cyan",
    "violet",
    "magenta",
    "rose",
    "orange",
    "gold",
  ]) {
    assertContrast({
      name: `${appearance}/label-${label}`,
      foreground: tokens[`color-label-${label}-fg`],
      background: tokens[`color-label-${label}-bg`],
    });
  }

  const expectedAgentTokens = Object.fromEntries(
    Object.entries(source.themes.indigo[appearance]).filter(([name]) =>
      name.startsWith("accent-agent"),
    ),
  );

  for (const [themeName, theme] of Object.entries(source.themes)) {
    const accents = theme[appearance];
    const actualAgentTokens = Object.fromEntries(
      Object.entries(accents).filter(([name]) =>
        name.startsWith("accent-agent"),
      ),
    );

    assert(
      JSON.stringify(actualAgentTokens) ===
        JSON.stringify(expectedAgentTokens),
      `${themeName}/${appearance} must retain the invariant agent family`,
    );

    for (const actor of ["human", "agent"]) {
      const base = accents[`accent-${actor}`];
      const onSolid = accents[`accent-${actor}-on-solid`];

      for (const surfaceName of ["surface", "canvas"]) {
        assertContrast({
          name: `${themeName}/${appearance}/${actor} on ${surfaceName}`,
          foreground: base,
          background: surfaces[surfaceName],
        });
      }

      for (const state of ["", "-hover", "-active"]) {
        assertContrast({
          name: `${themeName}/${appearance}/${actor} on solid${state || "-rest"}`,
          foreground: onSolid,
          background: accents[`accent-${actor}${state}`],
        });
      }

      for (const state of ["soft", "soft-hover"]) {
        assertContrast({
          name: `${themeName}/${appearance}/${actor} on ${state}`,
          foreground: base,
          background: accents[`accent-${actor}-${state}`],
        });
      }
    }

    const human = accents["accent-human"];
    const agent = accents["accent-agent"];
    const distances = {
      normal: oklabDistance(human, agent),
      ...Object.fromEntries(
        Object.entries(cvdMatrices).map(([name, matrix]) => [
          name,
          oklabDistance(human, agent, matrix),
        ]),
      ),
    };
    colorVisionResults.push({
      theme: themeName,
      appearance,
      human,
      agent,
      distances,
    });
    for (const [simulation, distance] of Object.entries(distances)) {
      assert(
        distance >= 0.08,
        `${themeName}/${appearance} ${simulation} actor-accent distance ${distance.toFixed(3)} is below the internal 0.080 advisory floor`,
      );
    }
  }
}

const styleBlocks = [proof, gallery].flatMap((document) =>
  [...document.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(
    (match) => match[1],
  ),
);
const proofStyles = styleBlocks.join("\n");

assert(
  !/(?:#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|oklab\(|oklch\()/i.test(
    proofStyles,
  ),
  "Board component CSS must not contain literal colors",
);
assert(
  !/\[data-theme/i.test(proofStyles),
  "Board component CSS must not contain theme-specific selectors",
);
assert(
  !/(?:#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|oklab\(|oklch\()/i.test(glyphs),
  "Glyph source must use currentColor instead of literal colors",
);

for (const combination of [
  ["indigo", "light"],
  ["indigo", "dark"],
  ["clay", "light"],
  ["clay", "dark"],
]) {
  const [theme, appearance] = combination;
  const pattern = new RegExp(
    `data-theme="${theme}"[\\s\\S]{0,80}data-appearance="${appearance}"`,
  );
  assert(
    pattern.test(proof),
    `Board proof is missing ${theme}/${appearance}`,
  );
}

for (const cue of [
  'class="avatar"',
  'class="agent-tile"',
  'class="ticket-card fresh"',
  "updated by agent",
  "Assignee,",
]) {
  assert(
    proof.includes(cue),
    `Board proof is missing required non-color actor cue: ${cue}`,
  );
}

for (const componentId of [
  "type",
  "color",
  "buttons",
  "fields",
  "navigation",
  "taxonomy",
  "identity",
  "cards",
  "checklist",
  "timeline",
  "feedback",
  "states",
  "overlays",
  "data",
]) {
  assert(
    gallery.includes(`id="${componentId}"`),
    `Component gallery is missing the ${componentId} section`,
  );
}

for (const galleryContract of [
  'id="theme-control"',
  '<option value="indigo">Indigo</option>',
  '<option value="clay">Clay</option>',
  'id="appearance-control"',
  'role="switch"',
  'id="modal-example"',
  "<dialog",
  'id="open-modal"',
  'id="show-toast"',
  "root.dataset.theme",
  "root.dataset.appearance",
]) {
  assert(
    gallery.includes(galleryContract),
    `Component gallery is missing required contract: ${galleryContract}`,
  );
}

console.log(
  `Design system verification: ${assertions.length - failures.length}/${assertions.length} assertions passed`,
);
console.log(`Contrast checks: ${contrastResults.length}`);

const minimumContrast = contrastResults.reduce(
  (minimum, result) => (result.ratio < minimum.ratio ? result : minimum),
  contrastResults[0],
);
const textContrastResults = contrastResults.filter(
  (result) => result.minimum === 4.5,
);
const minimumTextContrast = textContrastResults.reduce(
  (minimum, result) => (result.ratio < minimum.ratio ? result : minimum),
  textContrastResults[0],
);
console.log(
  `Minimum checked contrast: ${minimumContrast.ratio.toFixed(2)}:1 (${minimumContrast.name})`,
);
console.log(
  `Minimum text contrast: ${minimumTextContrast.ratio.toFixed(2)}:1 (${minimumTextContrast.name})`,
);

console.log("\nActor accent OKLab distances (informational; shape and text are mandatory):");
for (const result of colorVisionResults) {
  const distances = Object.entries(result.distances)
    .map(([name, value]) => `${name} ${value.toFixed(3)}`)
    .join(", ");
  console.log(`- ${result.theme}/${result.appearance}: ${distances}`);
}

if (failures.length > 0) {
  console.error("\nFailures:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
}
