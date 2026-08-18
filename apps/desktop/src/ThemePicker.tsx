import { useId } from "react";
import { ThemeSwatch } from "./ThemeSwatch";

/** A preset the picker (and any theme menu) offers: id is the token axis value. */
export type ThemeOption = { id: string; label: string };

/**
 * The theme picker `screen-specs.md:112-118` specifies for creation, settings,
 * and the palette's theme rows: 44×28px pair swatches, the preset name in
 * micro type below, selected = `accent-human` border + focus ring. Four
 * presets, no custom-color affordance — the options are the props and nothing
 * here can mint one.
 *
 * Native radios in a fieldset, so the group label, the arrow-key behavior,
 * and the roving tab stop are the platform's rather than re-implemented.
 */
export function ThemePicker(props: {
  themes: ThemeOption[];
  value: string;
  onPick: (theme: string) => void;
}) {
  const name = useId();
  return (
    <fieldset className="theme-picker">
      <legend>Theme</legend>
      <div className="theme-picker-options">
        {props.themes.map((theme) => (
          <label
            key={theme.id}
            className={
              theme.id === props.value
                ? "theme-option selected"
                : "theme-option"
            }
          >
            <input
              type="radio"
              name={name}
              value={theme.id}
              checked={theme.id === props.value}
              onChange={() => props.onPick(theme.id)}
            />
            <ThemeSwatch theme={theme.id} />
            <span className="theme-option-name">{theme.label}</span>
            {theme.id === props.value && (
              <span className="theme-option-check" aria-hidden="true">
                ✓
              </span>
            )}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
