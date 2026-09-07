import type { Book, Holding } from "./types";

/**
 * Reader-set weights.
 *
 * Removing a holding was only half of "remove and reweight": the product is
 * about weights, and a reader who thought the lead was too big could only
 * delete it outright. This pins chosen holdings to chosen weights and
 * redistributes the rest proportionally.
 *
 * The pins travel in the URL, so an adjusted book is still a shareable address
 * that rebuilds byte for byte — the same guarantee the generator gives.
 *
 * The generator's own invariants still hold: nothing drops below 5% or above
 * 27%, the ballast sleeve keeps the share its risk level sets, and the total is
 * exactly 100.0. One thing deliberately changes: the largest holding may now be
 * one the reader chose rather than one the primary theme supplied, so the book
 * is marked as edited.
 */

export const MIN_PCT = 5;
export const MAX_PCT = 27;

export type Pins = Map<string, number>;

/** Parse `w=NVDA:12,TSM:8`. Unknown tickers and bad numbers are dropped. */
export function parsePins(v: string | string[] | undefined, known: Set<string>): Pins {
  const raw = (Array.isArray(v) ? v[0] : v) ?? "";
  const pins: Pins = new Map();
  if (!raw) return pins;
  for (const part of raw.split(",")) {
    const [t, n] = part.split(":");
    const ticker = (t ?? "").trim().toUpperCase();
    const pct = Number(n);
    if (!known.has(ticker) || !Number.isFinite(pct)) continue;
    pins.set(ticker, Math.min(MAX_PCT, Math.max(MIN_PCT, Math.round(pct * 10) / 10)));
  }
  return pins;
}

export function formatPins(pins: Pins): string {
  return [...pins.entries()].map(([t, p]) => `${t}:${p}`).join(",");
}

/**
 * Apply pins to a generated book.
 *
 * Ballast is never pinned: its share is a function of the theme's risk level,
 * and letting a reader move it would quietly change what the book claims about
 * its own risk.
 */
export function applyPins(book: Book, pins: Pins): Book {
  if (!pins.size) return book;

  const ballast = book.holdings.filter((h) => h.ballast);
  const risky = book.holdings.filter((h) => !h.ballast);
  const budget = risky.reduce((s, h) => s + h.pct, 0);

  const pinned = risky.filter((h) => pins.has(h.t));
  const free = risky.filter((h) => !pins.has(h.t));
  if (!pinned.length) return book;

  // Every unpinned holding must still clear the floor, so the pins can only
  // ever claim what is left after that.
  const reserved = free.length * MIN_PCT;
  let pinnedTotal = pinned.reduce((s, h) => s + (pins.get(h.t) ?? h.pct), 0);
  const ceiling = budget - reserved;

  const scale = pinnedTotal > ceiling && pinnedTotal > 0 ? ceiling / pinnedTotal : 1;
  const next = new Map<string, number>();
  for (const h of pinned) {
    const want = (pins.get(h.t) ?? h.pct) * scale;
    next.set(h.t, Math.min(MAX_PCT, Math.max(MIN_PCT, want)));
  }
  pinnedTotal = [...next.values()].reduce((s, v) => s + v, 0);

  // What is left goes to the unpinned, in the proportions they already had.
  const remainder = Math.max(0, budget - pinnedTotal);
  const freeTotal = free.reduce((s, h) => s + h.pct, 0);
  for (const h of free) {
    const share = freeTotal > 0 ? h.pct / freeTotal : 1 / free.length;
    next.set(h.t, Math.min(MAX_PCT, Math.max(MIN_PCT, remainder * share)));
  }

  const holdings: Holding[] = risky.map((h) => ({
    ...h,
    pct: Math.round((next.get(h.t) ?? h.pct) * 10) / 10,
    lead: false,
  }));

  // Force the total back to exactly 100 on the largest risky holding, the same
  // correction the generator makes.
  const ballastTotal = ballast.reduce((s, h) => s + h.pct, 0);
  const total = holdings.reduce((s, h) => s + h.pct, 0) + ballastTotal;
  holdings.sort((a, b) => b.pct - a.pct);
  holdings[0].pct = Math.round((holdings[0].pct + (100 - total)) * 10) / 10;
  holdings.sort((a, b) => b.pct - a.pct);
  holdings[0].lead = true;

  return { ...book, holdings: [...holdings, ...ballast], edited: true };
}
