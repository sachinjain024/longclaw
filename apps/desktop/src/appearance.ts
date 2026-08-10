import { useSyncExternalStore } from "react";

/**
 * The appearance in force, read from the root and *subscribed to* rather than
 * captured.
 *
 * Theme accents are published on compound `[data-theme][data-lc-theme]`
 * blocks (`tokens/design-tokens.css:294+`), so anything drawing a theme that is
 * not the one in force — a preset swatch, a project's theme dot — has to carry
 * **both** attributes itself. One alone matches no block and silently inherits
 * the active project's accent, which looks exactly like working.
 *
 * `App` restamps `data-theme` on the root when the preference or the
 * system setting changes, and a live macOS appearance switch restamps it
 * without a React render. Anything that read it once would show yesterday's
 * appearance until something unrelated re-rendered it, so this observes the
 * attribute instead.
 */

/** What `App` wrote on `<html>`, or light when nothing has written it yet. */
function resolvedAppearance(): string {
  return document.documentElement.dataset.theme ?? "light";
}

/** Re-render whenever any writer restamps `data-theme` on the root. */
function subscribeToAppearance(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}

export function useResolvedAppearance(): string {
  return useSyncExternalStore(subscribeToAppearance, resolvedAppearance);
}
