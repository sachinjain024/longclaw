/**
 * The LongClaw mark — chevron-and-ring, product-icon variant 4, the canonical
 * asset at `docs/design/foundations/assets/owl-mark.svg` (LC-62, selected
 * 2026-08-13; replaces variant A "talon" of decisions.md D13). The same mark
 * the OS shows: the app icon renders it white on the brand orange
 * (`assets/brand/app-icon/`).
 *
 * Single-color by construction: the fills and the ring stroke all take
 * `currentColor`, so the mark sits on any surface and takes whatever ink the
 * chrome around it is set in. The white/ochre PNG variants in
 * `assets/brand/app-icon/in-app/` are for surfaces outside app chrome
 * (marketing, splash) and never replace this component.
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
        d="M1 1 L32 18.8 L63 1 L61.5 12.2 L35.2 27.5 L32 34 L28.8 27.5 L2.5 12.2 Z"
      />
      <path fill="currentColor" d="M32 35.3 L35.6 40.6 L32 47.5 L28.4 40.6 Z" />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="7"
        d="M52.13 20.43 A24 24 0 1 1 11.87 20.43"
      />
    </svg>
  );
}
