/**
 * The GitHub star control's copy and its two small decisions (LC-257s).
 *
 * **The deck is the source, not a transcription of one.** It was settled on the
 * ticket, from the prototype, and the rule the prototype ran on carries over
 * here: `StatusBar.tsx` renders from this object and its test asserts against
 * this object, so a review reply saying `github.star.aria → …` names one place
 * to change. The ids are the ids the ticket's deck uses.
 *
 * **The control carries no visible words.** It sits in the status bar as a mark
 * and, once there is one, a number. That is the trade the settled placement
 * makes, and it is why `aria` below is not a restatement of a visible label —
 * it is the only place the offer is written down in words.
 */

/** The repository the control opens and the count belongs to. */
export const GITHUB_REPO = "sachinjain024/longclaw";

/**
 * The count is drawn at this many stars and above, and not below.
 *
 * This is a judgement rather than a measurement, and it is the one number here
 * worth arguing with. The case for paying an amended network contract is that
 * the number is social proof; below a floor it is the opposite, and a control
 * that talks a reader out of the thing it asks for is worse than the bare link
 * this ticket rejected. The floor costs nothing to build, because the no-count
 * state is required anyway — offline, a rate limit and first paint all produce
 * it. What it costs is a promise: until the floor is cleared, the expensive
 * half of this feature buys nothing a static link would not.
 *
 * It also holds up a plural. `aria.count` says `{n} stars`, which is always
 * right at or above 50. Lower the floor under 2 and that string needs a
 * singular form.
 */
export const STAR_FLOOR = 50;

/** How long a cached count is current for. The same slot the update check uses. */
export const STAR_INTERVAL_MS = 24 * 60 * 60 * 1000;

export const GITHUB_COPY = {
  /**
   * The count, as it is drawn. Under 1,000 the number is written out; at and
   * above it, one decimal and a `k`, because the bar has ~40px for it and a
   * five-digit count is a different width every week.
   */
  count: (stars: number) => countText(stars),
  /**
   * The control with no count known — offline, rate-limited, first paint, or
   * under the floor. It is the state this control is in most of the time.
   *
   * The second sentence is doing real work: in this placement the visible
   * control is a mark and nothing else, so this is the only thing that says
   * what the control is for, and the only warning that a press leaves the app.
   * A local-first app opening a browser is a surprise worth naming.
   */
  aria: "Star LongClaw on GitHub. Opens github.com in your browser.",
  /**
   * The same, with the count spoken. The full grouped number rather than the
   * abbreviated one: `1.3k` is a thing to read at a glance, not a thing to
   * hear.
   */
  ariaCount: (stars: number) =>
    `Star LongClaw on GitHub, ${stars.toLocaleString("en-US")} stars. Opens github.com in your browser.`,
  /**
   * On hover. A title rather than a visible sub-label, because where the press
   * goes is a thing to confirm rather than a thing to read every time.
   */
  title: `github.com/${GITHUB_REPO}`,
  /**
   * When the browser could not be opened. It claims nothing about why — the
   * same shape as the update path's three-into-one *couldn't check*, because a
   * person cannot act on the difference between "no handler" and "the open call
   * returned an error".
   */
  openFailed: "Couldn’t open GitHub.",
  /**
   * Settings › Updates, under the automatic-check note. ADR 0014 moved the
   * promise from *no connection* to *no information*; the price of a second
   * caller on that road is that it is stated in the same place as the first.
   * Two sentences about one mechanism, not two mechanisms.
   */
  settingsNote:
    "The star count is fetched the same way, at most once a day, and sends nothing about you or your projects.",
} as const;

/**
 * The count as the control draws it.
 *
 * Exported for its test; callers should reach it through `GITHUB_COPY.count`,
 * which is the row the deck names and the one a review reply can cite.
 */
export function countText(stars: number): string {
  if (stars < 1000) return String(stars);
  const thousands = Math.round(stars / 100) / 10;
  return `${thousands.toFixed(1).replace(/\.0$/, "")}k`;
}

/**
 * Whether a number is drawn at all.
 *
 * One function rather than a comparison at each call site, because the floor
 * and the missing count are one question — *is there a number to show* — and
 * two spellings of it is how one of them ends up answered differently.
 */
export function showsCount(stars: number | undefined): stars is number {
  return typeof stars === "number" && stars >= STAR_FLOOR;
}

/** The label the control reads out, count or no count. */
export function starAria(stars: number | undefined): string {
  return showsCount(stars) ? GITHUB_COPY.ariaCount(stars) : GITHUB_COPY.aria;
}
