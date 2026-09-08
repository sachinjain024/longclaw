/**
 * Defining a label: the name field, the key that falls out of it, and the two
 * surfaces that ask for one.
 *
 * LC-236e put a define row in the labels popover, which is the first time a
 * label can be defined from anywhere but project settings. The two places have
 * different shapes — a form inside a popover, and a row in a four-column grid —
 * so what is shared here is the part that must not differ: the derivation, the
 * four states a typed name can be in, and the words each one draws.
 *
 * The key is **read-only**, in both. One thing is typed and the key is what
 * falls out of it, which is the only version of this row that can promise the
 * key on screen is always the key the name will produce. The cost is a name
 * with no Latin in it at all — `日本語` derives nothing and there is no way past
 * that from either surface. LC-236e's review weighed that against the two
 * alternatives, a key field in settings only (which puts the two surfaces back
 * into disagreement, the thing the ticket exists to stop) and a generated
 * fallback key (`backend-2` on a card, which it argues against by name), and
 * accepted it: a project whose vocabulary is not Latin defines its labels by
 * editing `longclaw.yaml` or through `longclaw label add --slug`.
 */

import { useState } from "react";
import type { Label } from "./types";
import {
  defineState,
  labelKeyLine,
  labelKeyNote,
  nextLabelColor,
} from "./labels";
import type { LabelDefineState } from "./labels";

/**
 * The key line, and the collision under it.
 *
 * `aria-live="polite"` because this is the one thing that changes as the name
 * is typed: a sighted person watches it update, and without this nobody else
 * would learn that it had. Polite rather than assertive — it follows typing, so
 * interrupting the typist with it would be reading their own keystrokes back.
 */
export function DerivedKey(props: { state: LabelDefineState }) {
  const line = labelKeyLine(props.state);
  const note = labelKeyNote(props.state);
  return (
    <>
      <span className="derived-key" aria-live="polite">
        {/* No control, at any point. The key is text, and the only way to
            change it is to change the name above it. */}
        <span className={`derived-key-line ${line.tone}`}>{line.text}</span>
      </span>
      {note && <p className="derived-key-note">{note}</p>}
    </>
  );
}

/**
 * The name, the colour and the state they imply, held for whichever surface is
 * drawing them.
 *
 * A hook rather than a component because the two surfaces lay the same three
 * things out differently — the popover stacks them, the settings row puts the
 * colour in its own grid column — and a component that could do both would be
 * two components wearing a flag.
 */
export function useLabelDefinition(definitions: Record<string, Label>) {
  const [name, setName] = useState("");
  /**
   * `undefined` until it is picked, so the default follows the project: a hue
   * chosen when the row was first mounted would go stale the moment a label is
   * defined, and defining several in a row is exactly what an empty project is
   * about to do.
   */
  const [picked, setPicked] = useState<string>();
  const color = picked ?? nextLabelColor(definitions);
  const state = defineState(name, definitions);
  return {
    name,
    setName,
    color,
    setColor: setPicked,
    state,
    /** After a definition lands: the row stays open for the next one. */
    reset: () => {
      setName("");
      setPicked(undefined);
    },
  };
}
