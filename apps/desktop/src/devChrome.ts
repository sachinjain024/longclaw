/**
 * Whether the debug affordances render: the FOLDER → .longclaw → tickets trace
 * strip, the generation stamp, and the manual Rebuild index button. They
 * surface the storage engine's state while developing against it, and they are
 * not part of the designed UI (`screen-specs.md` § App shell) — so a release
 * build drops them, and a dev build keeps them.
 */
export const DEV_CHROME = import.meta.env.DEV;
