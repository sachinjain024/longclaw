/**
 * Everything inside a container that Tab can land on, in document order.
 *
 * One walk, because three surfaces trap Tab against it — the settings panel,
 * the command palette and the raw file view — and each had written its own.
 * Two of them were wrong in the same two ways, and a selector list gets neither
 * right:
 *
 * `tabindex="-1"` has to lose to the element's own type. A `<button>` in a
 * roving group is *not* a tab stop, and a four-clause selector whose first
 * clause is `button` counts every one of them — the settings nav's six rows
 * rather than the one holding the group's stop, and every option row the
 * palette is currently showing (they are `tabIndex={-1}` by design, because the
 * input keeps focus and publishes the active row through
 * `aria-activedescendant`).
 *
 * And the order has to be the document's. A selector list is evaluated clause
 * by clause and concatenated by jsdom's engine, which puts every button before
 * every input regardless of where they sit — so a trap built on it wraps to
 * whatever happened to be first in the first clause rather than to the first
 * thing on screen. `"*"` is one selector, so the order is the tree's.
 *
 * `disabled` is dropped because focusing a disabled control is a no-op that
 * leaves focus on `<body>` behind the scrim — the one thing a trap exists to
 * prevent. The palette's `Retry parse` and its unavailable rows are both that
 * case.
 */
export function tabStops(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>("*")).filter(
    (element) => {
      if (element.getAttribute("tabindex") === "-1") return false;
      if (element.matches("button, input, select, textarea, [href]"))
        return !element.matches(":disabled");
      return element.hasAttribute("tabindex");
    },
  );
}
