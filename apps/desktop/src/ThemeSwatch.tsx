import { useSyncExternalStore } from "react";

/**
 * The preset pair swatch: left ⅔ human accent, right ⅓ agent accent
 * (`components.md:264-271`, `screen-specs.md:92-98`). The palette's theme rows
 * carry the miniature of it (`screen-specs.md:235`); the theme picker wears it
 * at 44×28.
 *
 * It draws no colour of its own. The theme accents are published on compound
 * `[data-appearance][data-theme]` blocks (`tokens/design-tokens.css:294+`), so
 * a swatch showing a theme that is *not* the one in force has to carry both
 * attributes itself — that is the whole trick, and it is why nothing here names
 * a hue. The appearance is read from the root, which `App` resolves from the
 * preference and the system setting — and it is *subscribed to*, not captured:
 * a live macOS appearance switch restamps only the root attribute, without a
 * React render, and a swatch that read it once would show yesterday's
 * appearance until something else happened to re-render it.
 */

/** What `App` wrote on `<html>`, or light when nothing has written it yet. */
function resolvedAppearance(): string {
  return document.documentElement.dataset.appearance ?? "light";
}

/** Re-render whenever any writer restamps `data-appearance` on the root. */
function subscribeToAppearance(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-appearance"],
  });
  return () => observer.disconnect();
}

export function ThemeSwatch(props: { theme: string }) {
  const appearance = useSyncExternalStore(
    subscribeToAppearance,
    resolvedAppearance,
  );
  return (
    <span
      className="theme-swatch"
      data-theme={props.theme}
      data-appearance={appearance}
      // The row's own label names the preset; the swatch repeats it in colour.
      aria-hidden="true"
    >
      <span className="swatch-human" />
      <span className="swatch-agent" />
    </span>
  );
}
