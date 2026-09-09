/**
 * The property half of a create surface's draft.
 *
 * `PropertyControl` was extracted so three surfaces cannot come to disagree
 * about what a type is edited with (LC-227); this is the other half of the same
 * rule. Both create surfaces held an identical `useState` and an identical
 * setter, and a create surface that decided differently what "cleared" means
 * would be the kind of divergence nothing on screen reports.
 */

import { useState } from "react";
import type { NewTicketProperties, TicketProperty } from "./types";

export interface PropertyDraft {
  /** What the ticket will carry, as against the project's configuration. */
  properties: NewTicketProperties;
  /**
   * One property of the draft. A clear takes the key out rather than sending
   * `null`: absent and cleared are the same thing where no file exists yet.
   * That distinction is `TicketEdit`'s, and it exists only where bytes are
   * already on disk.
   */
  setProperty: (property: TicketProperty, value: string | undefined) => void;
}

export function usePropertyDraft(
  initial: NewTicketProperties | undefined,
): PropertyDraft {
  const [properties, setProperties] = useState<NewTicketProperties>(
    initial ?? {},
  );

  function setProperty(property: TicketProperty, value: string | undefined) {
    setProperties((current) => {
      const next = { ...current };
      if (value === undefined) delete next[property];
      else next[property] = value;
      return next;
    });
  }

  return { properties, setProperty };
}
