/**
 * The command the install offer demonstrates, and what it prints (LC-249a).
 *
 * LC-233 shipped a pane that said what pressing the button writes to the
 * filesystem and never once said what the command is *for*. This is the
 * sentence that was missing: one real command, above the fold, before the
 * button is described.
 *
 * **It is a constant rather than copy in the component**, and it has its own
 * module rather than a place among the pane's strings, because the thing it
 * has to stay true to is not on this side of the IPC at all. It is a claim
 * about `cli.rs`, and `scripts/cli-demo-guard.mjs` is what holds it to one: the
 * verb here must be a verb the CLI's own `USAGE` lists, with no flag that
 * usage does not give it. A demo of the CLI that lives in the frontend goes
 * stale the first time the CLI changes, and without the guard nothing fails.
 *
 * **The output is an abbreviation, and the caption says so.** `ticket list`
 * prints pretty-printed JSON — on this repository, 251 objects of some fifteen
 * fields each — so there is no honest two-line rendering of it, and the block's
 * caption carries `example` rather than presenting these lines as a transcript.
 * Two truthful alternatives were considered and not taken: a `| jq -r` pipeline
 * that really does print exactly these two lines, which is a noisy thing to put
 * in a first-run modal, and a human-readable list mode on the CLI, which is a
 * feature and its own ticket. Either remains available later without changing
 * the shape of this block.
 */

/** The prompt's actor. An agent id rather than a shell username, because
 *  agents are who the command is for. Decorative and not a real value. */
export const DEMO_ACTOR = "claude-code";

/**
 * The command, exactly as it would be typed.
 *
 * `longclaw ticket list`, not the imported design's `longclaw list --status
 * todo`: that verb does not exist, and `ticket list` takes no `--status`. A
 * block whose whole job is to be believed cannot open on a line that answers
 * `unknown command`.
 */
export const DEMO_COMMAND = "longclaw ticket list";

/** Two lines standing in for what the command answers with. */
export const DEMO_OUTPUT = [
  "LC-131  Sign release build with hardened runtime",
  "LC-134  Empty state for a project with no .longclaw folder",
];
