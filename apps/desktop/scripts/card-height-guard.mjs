#!/usr/bin/env node
/**
 * The board card's height guard (LC-166): the number a column places cards from
 * is the *sum* of the rows the stylesheet draws, and this is the only place the
 * two halves of that sum can be read together.
 *
 * `boardGeometry.ts` does not measure a card. It cannot afford to — a 5,000-
 * ticket board is 71ms a frame with every card in the document and 21ms with
 * only the visible ones, and windowing means knowing every card's offset before
 * any of them exist. So `CARD_HEIGHT` is an arithmetic claim about the
 * stylesheet: 16 + 6 for the key row, the title box, 20 for the foot, inside a
 * 10px padding and a 1px border. Nothing enforced it. The tokens agree with the
 * constants (`boardGeometry.test.ts`) whichever number they hold, vitest loads
 * no stylesheet, and jsdom would not lay one out if it did — so a term that
 * moved without the total moving is a board that places every card a little
 * further wrong the further down it scrolls, green everywhere.
 *
 * That is not hypothetical: it is LC-165 one level down. The board region's
 * reserve went stale exactly this way, still paying for a header row that had
 * been collapsed, and the fix was to write the number as its addition so the
 * next edit to a term fails a check instead of shipping.
 *
 * LC-166 is what made it worth a guard. The card's title used to be one line,
 * ellipsized, which is a term with nowhere to go; it now clamps at *two*, and a
 * line count is the most movable number on the card — the next person who wants
 * a third line will change the clamp, see the card grow in the app, and have no
 * reason to think a TypeScript constant is watching. So the clamp is checked
 * against the title's stated height as well: the box has to reserve every line
 * the clamp allows, because it is the pinning, not the clamping, that keeps the
 * foot of every card level with its neighbours'.
 *
 * What it does not check is whether WebKit agrees that these boxes measure what
 * they say. Nothing here lays anything out. The rendered answer is `probe:drag`,
 * which reads back where a dragged ticket actually lands — a column placing
 * cards from a stale stride is one of the ways it goes red.
 *
 * Usage: node scripts/card-height-guard.mjs   (exits non-zero on any finding)
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { cssRules, declarationsOf, report } from "./guard.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "../src");

const rules = cssRules(readFileSync(resolve(src, "styles.css"), "utf8"));
const tokens = JSON.parse(
  readFileSync(resolve(src, "tokens/design-tokens.json"), "utf8"),
);

const findings = [];

/**
 * One declaration a selector makes, as the stylesheet spells it. Everything
 * below reads its term through here, so a term that has gone missing is one
 * finding named once rather than each caller's own way of saying `undefined`.
 */
function declaration(selector, property) {
  const body = declarationsOf(rules, selector);
  const hit = new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`).exec(body);
  if (!hit) {
    findings.push(`\`${selector}\` states no ${property}`);
    return null;
  }
  return hit[1].trim();
}

/**
 * A term as the number it starts with. `border-top: 1px solid …` is a width
 * followed by things this guard has no opinion about, so it reads the leading
 * length and stops.
 */
function leadingLength(selector, property) {
  const value = declaration(selector, property);
  if (value === null) return Number.NaN;
  const number = Number.parseFloat(value);
  if (Number.isNaN(number))
    findings.push(
      `\`${selector}\`'s ${property} is \`${value}\`, which is not a length this guard can add up`,
    );
  return number;
}

/**
 * A term the card takes from the scale rather than spelling out, as the number
 * the scale holds. Checked as the reference it must be, in both directions: a
 * literal would lay out identically today and silently stop tracking the token,
 * and a *different* token would track the wrong number — and either way this
 * guard would go on adding up a value the card had stopped drawing.
 */
function tokenLength(selector, property, token) {
  const value = declaration(selector, property);
  if (value === null) return Number.NaN;
  if (value !== `var(--lc-size-${token})`)
    findings.push(
      `\`${selector}\`'s ${property} is \`${value}\` rather than \`var(--lc-size-${token})\`, so the number the board places cards from is no longer the one it draws`,
    );
  return tokens.size[token];
}

/* ---------- the card, row by row ---------- */

const card = tokenLength(".ticket-row", "height", "board-card");
const acknowledged = tokenLength(
  ".ticket-row.acknowledged",
  "height",
  "board-card-acknowledged",
);

// The frame the rows sit inside. `padding` is the block token and the inline one
// in a single declaration, so it is checked whole and the block half taken from
// the scale — reading it out of the shorthand would be this guard holding its
// own copy of the number it is here to check.
const border = leadingLength(".ticket-row", "border") * 2;
const cardPadding = declaration(".ticket-row", "padding");
if (
  cardPadding !== null &&
  cardPadding !== "var(--lc-size-card-pad-y) var(--lc-size-card-pad-x)"
)
  findings.push(
    `\`.ticket-row\`'s padding is \`${cardPadding}\` rather than \`var(--lc-size-card-pad-y) var(--lc-size-card-pad-x)\`, so the block padding below is no longer the padding the card draws`,
  );
const padding = tokens.size["card-pad-y"] * 2;

const keyRow =
  leadingLength(".card-top", "height") +
  leadingLength(".card-top", "margin-bottom");
const titleHeight = leadingLength(".ticket-row strong", "height");
const titleRow =
  titleHeight + leadingLength(".ticket-row strong", "margin-bottom");
const foot = leadingLength(".ticket-meta", "height");

// The acknowledgement footer, which is the whole difference between the two
// heights: its margin, the rule above it, its padding and one line of mono.
const footer =
  leadingLength(".actor", "margin-top") +
  leadingLength(".actor", "border-top") +
  leadingLength(".actor", "padding-top") +
  leadingLength(".actor", "line-height");

/* ---------- what has to add up ---------- */

// LC-166's own invariant. The clamp guarantees the maximum number of lines; the
// stated height is what *spends* that room whether or not the second line is
// used. Clamp without the height and a one-line title lifts the foot of the
// card off the line its neighbours' sit on; height without the clamp and a long
// title overflows the number the column placed the next card from.
const lines = leadingLength(".ticket-row strong", "-webkit-line-clamp");
const lineHeight = leadingLength(".ticket-row strong", "line-height");

/**
 * A term this guard could not read has already been reported as missing. Adding
 * it up as well would name the same edit twice, the second time as arithmetic
 * over NaN, which reads as a broken guard rather than as a finding.
 */
const readable = (...terms) => terms.every(Number.isFinite);

if (
  readable(titleHeight, lines, lineHeight) &&
  titleHeight !== lines * lineHeight
)
  findings.push(
    `\`.ticket-row strong\` clamps at ${lines} lines of ${lineHeight}px but reserves ${titleHeight}px — the box has to reserve every line the clamp allows and no more, or the first title that uses them all moves the card's foot`,
  );

const drawn = border + padding + keyRow + titleRow + foot;
if (readable(card, drawn) && card !== drawn)
  findings.push(
    `\`--lc-size-board-card\` is ${card}px and the card draws ${drawn}px (${border} border + ${padding} padding + ${keyRow} key row + ${titleRow} title + ${foot} foot), so every column places its cards ${Math.abs(card - drawn)}px further wrong the further down it scrolls`,
  );

if (readable(acknowledged, card, footer) && acknowledged !== card + footer)
  findings.push(
    `\`--lc-size-board-card-acknowledged\` is ${acknowledged}px and an acknowledged card draws ${card + footer}px (${card} + ${footer} of footer), so a column misplaces the cards below every change that arrives from disk`,
  );

report({
  // Three, not two: the title's clamp is an assertion in its own right, and it
  // is the one LC-166 was filed for. A pass line that counted only the two
  // heights would stop naming the check most likely to be the one that broke.
  name: "card-height-guard",
  findings,
  checked: 3,
  noun: "board card invariants",
  remedy:
    "term(s) the board's pinned card heights no longer add up to — fix the sum in src/tokens/design-tokens.json and src/boardGeometry.ts together, or the column jitters:",
  clean:
    "the title reserves every line it clamps, and both card heights are the sum of the rows styles.css draws inside them",
});
