/**
 * The checkbox at the head of a checklist's add-row: drawn, never offered.
 *
 * It is what makes the field beside it read as the list's next row rather than
 * as a form underneath the list (`cc_screens_diff.md` D-3E). Shared by the
 * ticket panel and the create surface because both add-rows are the same
 * object — the prototype gives each one (`prototype.js:740`, `:896`), and a
 * box drawn twice is a box that can come to differ from itself.
 *
 * A real checkbox rather than a glyph, so it is exactly the shape, size and
 * baseline of the boxes above it in every appearance without a second set of
 * geometry to keep in step. Disabled, so it is neither a Tab stop nor
 * something a click can tick, and hidden from assistive technology, which has
 * the field's own name to go on and nothing to gain from an unlabelled control
 * it cannot operate.
 */

export function GhostBox() {
  return (
    <input
      type="checkbox"
      className="ghost-box"
      checked={false}
      disabled
      readOnly
      aria-hidden="true"
      tabIndex={-1}
    />
  );
}
