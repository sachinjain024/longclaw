import { useResolvedAppearance } from "./appearance";

/**
 * The preset pair swatch: left ⅔ human accent, right ⅓ agent accent
 * (`components.md:264-271`, `screen-specs.md:112-118`). The palette's theme rows
 * carry the miniature of it (`screen-specs.md:313`); the theme picker wears it
 * at 44×28.
 *
 * It draws no colour of its own: it carries both axes of the token contract and
 * lets the generated CSS resolve them — see `appearance.ts` for why both are
 * needed and why the appearance is subscribed to rather than read once.
 */
export function ThemeSwatch(props: { theme: string }) {
  const appearance = useResolvedAppearance();
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

/**
 * The project's own theme, as a 6px dot beside its name in the side panel
 * (`components.md:251`, `screen-specs.md:57`) — the only place another
 * project's theme reaches this window. Same trick as the swatch, and the same
 * trap: with `data-theme` alone every dot silently wears the *active* project's
 * accent, which is indistinguishable from working until two projects differ.
 */
export function ThemeDot(props: { theme: string }) {
  const appearance = useResolvedAppearance();
  return (
    <span
      className="theme-dot"
      data-theme={props.theme}
      data-appearance={appearance}
      aria-hidden="true"
    />
  );
}
