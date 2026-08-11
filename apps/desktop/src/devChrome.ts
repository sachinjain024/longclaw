/**
 * Whether the debug affordances render. What is left is the manual Rebuild
 * index button: it surfaces the storage engine's state while developing
 * against it, and it is not part of the designed UI (`screen-specs.md` § App
 * shell) — so a release build drops it, and a dev build keeps it.
 *
 * The FOLDER → .longclaw → tickets trace strip and its generation stamp were
 * here too until LC-207 removed them; they read as a second header rather than
 * as harness chrome.
 */
export const DEV_CHROME = import.meta.env.DEV;
