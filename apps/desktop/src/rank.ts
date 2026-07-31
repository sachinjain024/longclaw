/**
 * Where a manually ordered card sits, as a string that sorts.
 *
 * ADR 0003 puts the Manual order in the per-ticket `rank` field, so two cards'
 * relative position has to survive as text in two separate files with nothing
 * between them. That rules out an integer index — inserting one card would
 * renumber every card below it, which is a write to every file in the column —
 * and leaves a key that can always be split: given two neighbours, produce a
 * third string that sorts strictly between them, touching nothing else.
 *
 * This is fractional indexing, and the implementation is the one David
 * Greenspan's write-up describes (`rocicorp/fractional-indexing`, MIT), written
 * out here rather than added as a dependency: it is a hundred lines, the
 * allocation is a v0 format commitment (`file_format.md:131`), and a transitive
 * dependency in this repository has a cost the Dependabot triage already
 * measured (`docs/plans/completed/08-dependabot-triage.md`).
 *
 * A key is a base-62 fraction in ASCII order — `0-9`, then `A-Z`, then `a-z` —
 * so plain `<` on the string is the order, with no parsing at read time. It
 * carries an integer part whose first character says how long that part is:
 * `a`+1 digit, `b`+2, and `Z`+1, `Y`+2 going negative. That header is the whole
 * point of the scheme. Without it, appending at the tail would lengthen the key
 * every few cards; with it, the tail increments an integer and the head
 * decrements one, so the two common drops — to the bottom, to the top — cost a
 * constant-length key however many times they happen.
 *
 * `file_format.md:66`'s example is `rank: "a0V"`, which is exactly what this
 * allocates for a card dropped in the first gap it is ever asked about.
 *
 * **A rank this app did not write is preserved, never repaired.** The format
 * contract says agents preserve ranks and do not invent them, and the app owes
 * a value it did not generate the same courtesy. Such a string still orders —
 * `<` compares anything — but it cannot be a bound, because the arithmetic
 * below is only defined over this alphabet.
 */

/** Base 62 in ASCII order, so string comparison is digit comparison. */
const DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BASE = DIGITS.length;
const LAST_DIGIT = DIGITS[BASE - 1];

/** The key for the first manually placed card in a column: integer zero. */
const FIRST_RANK = "a0";

/** `A` + 26 digits: nothing may sort below it, so it is never allocated. */
const SMALLEST_INTEGER = `A${"0".repeat(26)}`;

/**
 * How long the integer part is, header included. `a`…`z` count up from one
 * digit; `Z`…`A` count up from one digit going the other way.
 */
function integerLength(head: string): number | undefined {
  if (head >= "a" && head <= "z") return head.charCodeAt(0) - 97 + 2;
  if (head >= "A" && head <= "Z") return 90 - head.charCodeAt(0) + 2;
  return undefined;
}

/** The integer part of a key, or undefined when the key is not one of ours. */
function integerPart(key: string): string | undefined {
  const length = integerLength(key[0] ?? "");
  if (length === undefined || length > key.length) return undefined;
  const integer = key.slice(0, length);
  return [...integer.slice(1)].every((digit) => DIGITS.includes(digit))
    ? integer
    : undefined;
}

/**
 * Whether this is a key this build allocated, and therefore one it may do
 * arithmetic with. A trailing `0` on the fraction is rejected because it is a
 * second spelling of the same position, and splitting a gap relies on there
 * being exactly one.
 */
export function isAppRank(value: string): boolean {
  if (value === SMALLEST_INTEGER) return false;
  const integer = integerPart(value);
  if (integer === undefined) return false;
  const fraction = value.slice(integer.length);
  if (fraction.endsWith("0")) return false;
  return [...fraction].every((digit) => DIGITS.includes(digit));
}

/** The next integer up, or undefined past the largest one the scheme has. */
function incrementInteger(integer: string): string | undefined {
  const head = integer[0];
  const digits = [...integer.slice(1)];
  let carry = true;
  for (let index = digits.length - 1; carry && index >= 0; index -= 1) {
    const next = DIGITS.indexOf(digits[index]) + 1;
    if (next === BASE) digits[index] = "0";
    else {
      digits[index] = DIGITS[next];
      carry = false;
    }
  }
  if (!carry) return head + digits.join("");
  if (head === "Z") return FIRST_RANK;
  if (head === "z") return undefined;
  const next = String.fromCharCode(head.charCodeAt(0) + 1);
  // Positive integers grow a digit as they roll over; negative ones shrink one,
  // because they are counting back towards zero.
  if (next > "a") digits.push("0");
  else digits.pop();
  return next + digits.join("");
}

/** The next integer down, or undefined below the smallest one the scheme has. */
function decrementInteger(integer: string): string | undefined {
  const head = integer[0];
  const digits = [...integer.slice(1)];
  let borrow = true;
  for (let index = digits.length - 1; borrow && index >= 0; index -= 1) {
    const next = DIGITS.indexOf(digits[index]) - 1;
    if (next === -1) digits[index] = LAST_DIGIT;
    else {
      digits[index] = DIGITS[next];
      borrow = false;
    }
  }
  if (!borrow) return head + digits.join("");
  if (head === "a") return `Z${LAST_DIGIT}`;
  if (head === "A") return undefined;
  const previous = String.fromCharCode(head.charCodeAt(0) - 1);
  if (previous < "Z") digits.push(LAST_DIGIT);
  else digits.pop();
  return previous + digits.join("");
}

/**
 * A base-62 fraction strictly between two fractions, where `""` is zero and an
 * absent upper bound is one. Never ends in `0`, which is what keeps every
 * position spelled exactly one way.
 */
function midpoint(lower: string, upper: string | undefined): string {
  if (upper !== undefined) {
    // Everything the two share is carried through untouched; the split happens
    // at the first digit where they differ.
    let shared = 0;
    while ((lower[shared] ?? "0") === upper[shared]) shared += 1;
    if (shared > 0) {
      return (
        upper.slice(0, shared) +
        midpoint(lower.slice(shared), upper.slice(shared))
      );
    }
  }

  const low = lower ? DIGITS.indexOf(lower[0]) : 0;
  const high = upper === undefined ? BASE : DIGITS.indexOf(upper[0]);
  if (high - low > 1) return DIGITS[Math.round((low + high) / 2)];
  // The two digits are adjacent, so the gap is inside the upper one's tail if
  // it has one, and otherwise inside the lower one's.
  if (upper !== undefined && upper.length > 1) return upper.slice(0, 1);
  return DIGITS[low] + midpoint(lower.slice(1), undefined);
}

/**
 * The rank for a card dropped between two neighbours. Either side may be
 * absent — that is the head of the column, the tail, or a column with no ranks
 * in it at all.
 *
 * A bound this build did not write is dropped rather than parsed, and so is an
 * upper bound that does not sit above the lower one: two tickets that somehow
 * share a rank cannot be split, so the card lands just after the pair rather
 * than the drop failing. Both are ordinary enough on disk to be answered rather
 * than thrown at.
 */
export function rankBetween(
  before: string | undefined,
  after: string | undefined,
): string {
  const lower = before !== undefined && isAppRank(before) ? before : undefined;
  let upper = after !== undefined && isAppRank(after) ? after : undefined;
  if (lower !== undefined && upper !== undefined && lower >= upper) {
    upper = undefined;
  }

  if (lower === undefined) {
    if (upper === undefined) return FIRST_RANK;
    const integer = integerPart(upper) as string;
    const fraction = upper.slice(integer.length);
    if (integer === SMALLEST_INTEGER) return integer + midpoint("", fraction);
    // A key with a fraction already has room below it at its own integer.
    if (fraction.length > 0) return integer;
    const below = decrementInteger(integer);
    if (below === undefined) return integer + midpoint("", fraction);
    return below;
  }

  const lowerInteger = integerPart(lower) as string;
  const lowerFraction = lower.slice(lowerInteger.length);

  if (upper === undefined) {
    const above = incrementInteger(lowerInteger);
    return above ?? lowerInteger + midpoint(lowerFraction, undefined);
  }

  const upperInteger = integerPart(upper) as string;
  const upperFraction = upper.slice(upperInteger.length);
  if (lowerInteger === upperInteger) {
    return lowerInteger + midpoint(lowerFraction, upperFraction);
  }
  const above = incrementInteger(lowerInteger);
  if (above !== undefined && above < upper) return above;
  return lowerInteger + midpoint(lowerFraction, undefined);
}
