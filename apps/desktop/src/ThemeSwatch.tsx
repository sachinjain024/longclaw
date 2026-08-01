/**
 * The preset pair swatch: left ⅔ human accent, right ⅓ agent accent
 * (`components.md:264-271`, `screen-specs.md:92-98`). The palette's theme rows
 * carry the miniature of it (`screen-specs.md:235`).
 *
 * It draws no colour of its own. The theme accents are published on compound
 * `[data-appearance][data-theme]` blocks (`tokens/design-tokens.css:294+`), so
 * a swatch showing a theme that is *not* the one in force has to carry both
 * attributes itself — that is the whole trick, and it is why nothing here names
 * a hue. The appearance is read from the root, which `App` already resolves
 * from the preference and the system setting.
 */

/** What `App` wrote on `<html>`, or light when nothing has written it yet. */
function resolvedAppearance(): string {
  return document.documentElement.dataset.appearance ?? "light";
}

export function ThemeSwatch(props: { theme: string }) {
  return (
    <span
      className="theme-swatch"
      data-theme={props.theme}
      data-appearance={resolvedAppearance()}
      // The row's own label names the preset; the swatch repeats it in colour.
      aria-hidden="true"
    >
      <span className="swatch-human" />
      <span className="swatch-agent" />
    </span>
  );
}
