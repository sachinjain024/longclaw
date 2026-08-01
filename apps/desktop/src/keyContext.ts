/** Single-key shortcuts are inactive while the user is editing a control. */
export function singleKeyShortcutAllowed(target: EventTarget | null): boolean {
  return !(
    target instanceof HTMLElement &&
    target.closest("input, textarea, select, [contenteditable=true]")
  );
}

export function isChord(event: KeyboardEvent, key: string): boolean {
  return (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === key;
}
