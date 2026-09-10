/**
 * How long a claim stands before it is judged.
 *
 * ── Why a claim needs an end ─────────────────────────────────────────────────
 *
 * Every entry on the record used to be open for ever. That sounds generous and
 * is in fact the opposite: a belief with no deadline can never be wrong, only
 * early. Anyone whose book is behind can say "give it time", and the site's own
 * position — that roughly half of all books lose to the index — has no moment
 * at which it can be checked.
 *
 * A horizon closes that. On the settlement date the record states what
 * happened over the period the author chose, and stops moving. The claim
 * becomes something that can be lost.
 *
 * ── What settlement does and does not say ────────────────────────────────────
 *
 * It settles the claim as stated: over this many months, this book beat the
 * index or it did not. It does not settle the underlying thesis. Most themes
 * here carry their own horizon of three to ten years, so a twelve-month
 * verdict is a checkpoint, not a judgement on whether compute is the binding
 * constraint on artificial intelligence. The pages say so beside the figure,
 * because a number without that sentence would be the site overclaiming in
 * exactly the way it warns others about.
 */

/** The horizons a claim may be made over, in months. */
export const HORIZONS = [3, 6, 12, 24, 60] as const;
export type Horizon = (typeof HORIZONS)[number];

/**
 * A year. Long enough that a lucky fortnight does not decide it, short enough
 * that someone stating a claim today can expect to see it settled.
 */
export const DEFAULT_HORIZON: Horizon = 12;

export function isHorizon(v: unknown): v is Horizon {
  return typeof v === "number" && (HORIZONS as readonly number[]).includes(v);
}

/** "3 months", "1 year", "5 years". */
export function horizonLabel(months: number): string {
  if (months < 12) return `${months} months`;
  const years = months / 12;
  return years === 1 ? "1 year" : `${years} years`;
}

/**
 * `statedAt` plus `months`, as YYYY-MM-DD.
 *
 * Month arithmetic overflows: 31 January plus one month is 3 March in every
 * naive implementation, which would put a settlement date in a month the
 * author did not choose. Overflow is pulled back to the last day of the
 * intended month instead.
 */
export function settlesOn(statedAt: string, months: number): string {
  const d = new Date(statedAt + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return statedAt;
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  if (d.getUTCDate() !== day) d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
}

/** Whole months between two dates, for reading a stored settlement back. */
export function monthsBetween(statedAt: string, settlesAt: string): number {
  const a = new Date(statedAt + "T00:00:00Z");
  const b = new Date(settlesAt + "T00:00:00Z");
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  // Whole calendar months. A settlement pulled back to the last day of its
  // month (31 January plus one) still lands in the month that was chosen, so
  // the month difference is the answer without adjusting for the day.
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
}

/** True once the settlement date has passed. Open-ended claims never settle. */
export function isSettled(settlesAt: string | null | undefined, now: number = Date.now()): boolean {
  if (!settlesAt) return false;
  const t = Date.parse(settlesAt + "T00:00:00Z");
  return !Number.isNaN(t) && now >= t;
}

/** Days until settlement. Negative once past, null when there is no date. */
export function daysUntil(settlesAt: string | null | undefined, now: number = Date.now()): number | null {
  if (!settlesAt) return null;
  const t = Date.parse(settlesAt + "T00:00:00Z");
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - now) / 86_400_000);
}
