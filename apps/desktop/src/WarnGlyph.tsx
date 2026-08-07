/**
 * The warn triangle (`prototype.js:108`), at whatever size the surface asks for.
 *
 * `states.md:80-86` draws the unreachable state with one at 30px above the
 * title. It replaced an `UNREACHABLE` eyebrow, which said the state in a word
 * the product uses nowhere else and left the title to the project's own name —
 * so the screen never said what had happened (LC-143).
 *
 * Decorative. Every surface that shows it says the same thing in words beside
 * it, and a glyph that repeated them would say it twice (`accessibility.md`).
 */
export function WarnGlyph(props: { size?: number }) {
  const size = props.size ?? 13;
  return (
    <svg
      className="warn-glyph"
      width={size}
      height={size}
      viewBox="0 0 14 14"
      aria-hidden="true"
    >
      <path
        d="M7 1.5 L13 12 L1 12 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <rect
        x="6.35"
        y="5.2"
        width="1.3"
        height="3.4"
        rx="0.65"
        fill="currentColor"
      />
      <rect
        x="6.35"
        y="9.6"
        width="1.3"
        height="1.3"
        rx="0.65"
        fill="currentColor"
      />
    </svg>
  );
}
