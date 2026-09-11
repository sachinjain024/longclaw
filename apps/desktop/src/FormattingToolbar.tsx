/**
 * The six formatting buttons, wherever Markdown is typed.
 *
 * Two fields take Markdown now — the description editor and the comment
 * composer (LC-211) — and the toolbar over them is one object: the same six
 * actions in the order `screen-specs.md:234-235` lists them, the same roving
 * tabindex so the group costs its surface one Tab stop rather than six
 * (`keyboard-focus-map.md:62`), and the same accessible names, because an icon
 * alone is not a name.
 *
 * What it does *not* own is the text. `markdownToolbar.ts` is what turns an
 * action and a selection into a new string, and the field it acts on belongs to
 * the surface — which is why the only thing passed down here is which button was
 * pressed. A toolbar that reached for a textarea would have to know which of the
 * two it was standing over.
 */

import { useRef, useState, type KeyboardEvent } from "react";
import { FormattingIcon } from "./FormattingIcon";
import { TOOLBAR_ACTIONS, type ToolbarAction } from "./markdownToolbar";

export function FormattingToolbar(props: {
  onFormat: (action: ToolbarAction) => void;
  /** A toolbar over a read-only projection has nothing to act on. */
  disabled?: boolean;
  className?: string;
}) {
  const [active, setActive] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step =
      event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const count = TOOLBAR_ACTIONS.length;
    const next = (active + step + count) % count;
    setActive(next);
    buttons.current[next]?.focus();
  }

  return (
    <div
      className={props.className ?? "editor-toolbar"}
      role="toolbar"
      aria-label="Formatting"
      onKeyDown={onKeyDown}
    >
      {TOOLBAR_ACTIONS.map((action, index) => (
        <button
          key={action.id}
          type="button"
          aria-label={action.label}
          disabled={props.disabled}
          tabIndex={index === active ? 0 : -1}
          ref={(element) => {
            buttons.current[index] = element;
          }}
          onFocus={() => setActive(index)}
          onClick={() => props.onFormat(action.id)}
        >
          <FormattingIcon action={action.id} />
        </button>
      ))}
    </div>
  );
}
