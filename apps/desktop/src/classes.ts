/**
 * One class list from a base class and the modifiers that happen to be true.
 *
 * A row's state is a handful of independent booleans — selected, acknowledged,
 * being
 * dragged — and every surface was otherwise writing the same
 * `.filter(Boolean).join(" ")` around a ternary per modifier. The falsy cases
 * drop out, so a modifier reads as the condition that turns it on.
 */

export function classes(
  base: string,
  ...modifiers: (string | false | undefined)[]
): string {
  return [base, ...modifiers].filter(Boolean).join(" ");
}
