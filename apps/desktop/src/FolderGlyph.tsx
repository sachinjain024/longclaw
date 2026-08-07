/**
 * The folder mark that precedes a path, wherever one is shown as a chip: the
 * project path in the content header (D-06) and the ticket file in the panel
 * header (D-39).
 *
 * Decorative. The chip's own text is the path, and a glyph that repeated it
 * would say it twice (`accessibility.md`).
 */
export function FolderGlyph() {
  return (
    <svg
      className="folder-glyph"
      width="13"
      height="13"
      viewBox="0 0 14 14"
      aria-hidden="true"
    >
      <path
        d="M1.5 3.5 Q1.5 2.5 2.5 2.5 L5 2.5 L6.2 4 L11.5 4 Q12.5 4 12.5 5 L12.5 10.5 Q12.5 11.5 11.5 11.5 L2.5 11.5 Q1.5 11.5 1.5 10.5 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
      />
    </svg>
  );
}
