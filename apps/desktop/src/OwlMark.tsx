/**
 * The LongClaw mark — variant A "talon", the Step 1 deliverable at
 * `docs/design/foundations/assets/owl-mark.svg` (decisions.md D13).
 *
 * Single-color by construction: every path fills with `currentColor`, so the
 * mark sits on any surface and takes whatever ink the chrome around it is set
 * in. The duotone pupil variant is reserved for marketing and never appears in
 * app chrome, which is why there is no accent prop here.
 *
 * Kept as a component rather than an imported asset because it is drawn at two
 * sizes on two surfaces (22px in the side panel, 52px on welcome) and the size
 * is the only thing that varies.
 */
export function OwlMark({ size }: { size: number }) {
  return (
    <svg
      className="owl-mark"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role="img"
      aria-label="LongClaw"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M9 7 L32 16 L55 7 L55 40 L32 59 L9 40 Z
           M22.5 22 a7.5 7.5 0 1 0 0 15 a7.5 7.5 0 1 0 0 -15 Z
           M41.5 22 a7.5 7.5 0 1 0 0 15 a7.5 7.5 0 1 0 0 -15 Z
           M32 39.5 L36 45 L32 51.5 L28 45 Z"
      />
      <circle cx="22.5" cy="29.5" r="3" fill="currentColor" />
      <circle cx="41.5" cy="29.5" r="3" fill="currentColor" />
    </svg>
  );
}
