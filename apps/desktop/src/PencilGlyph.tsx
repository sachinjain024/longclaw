/**
 * The pencil the prototype pairs with `Edit` in the Description header, and the
 * one a checklist row's own edit button wears (LC-215). Purely decorative: the
 * control it sits in is named, and a glyph that repeated the name would say it
 * twice (`accessibility.md`).
 */
export function PencilGlyph() {
  return (
    <svg
      className="pencil-glyph"
      width="12"
      height="12"
      viewBox="0 0 14 14"
      aria-hidden="true"
    >
      <path
        d="M2.2 11.8 L2.8 9.2 L9.8 2.2 Q10.4 1.6 11 2.2 L11.8 3 Q12.4 3.6 11.8 4.2 L4.8 11.2 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}
