import { getHistory, isLive, series, SPY_DRIFT, bookDrift } from "./market";
import type { Bar } from "./market";
import type { Book } from "./types";

/**
 * Performance since the premise was stated.
 *
 * With a vendor configured this is arithmetic on real closes: the book's
 * weights are frozen at the stated date and applied to each holding's actual
 * return, against SPY over the same window. The "benchmark is not rigged"
 * invariant (HANDOFF.md §5, §13) stops being something the code has to enforce
 * and becomes simply what happened.
 *
 * Without a vendor it falls back to the synthetic series, which is centred on
 * the index so roughly half of all books lose — and the page says so.
 */

const BENCHMARK = "SPY";
const SESSIONS_PER_YEAR = 252;
const DEFAULT_N = 180;
const MIN_N = 20;
const MAX_N = 1260;

export interface TrackResult {
  /** Cumulative percent return of the book, per session. */
  book: number[];
  /** The same for the benchmark. */
  index: number[];
  bookEnd: number;
  indexEnd: number;
  win: boolean;
  /** Sessions charted. */
  n: number;
  /** True when every point came from real closes. */
  live: boolean;
  /** Holdings the vendor could not cover, so the reader knows what is missing. */
  missing: string[];
  /** True when the window ended at a settlement date rather than at today. */
  settled: boolean;
}

export function sessionsFor(days: number | null): number {
  if (days === null) return DEFAULT_N;
  const n = Math.round((days / 365) * SESSIONS_PER_YEAR);
  return Math.min(MAX_N, Math.max(MIN_N, n));
}

/** Cumulative percent return from a close series, starting at zero. */
function toReturns(closes: number[]): number[] {
  if (!closes.length) return [];
  const base = closes[0];
  if (!base) return [];
  return closes.map((c) => ((c - base) / base) * 100);
}

function syntheticTrack(b: Book, days: number | null): TrackResult {
  const n = sessionsFor(days);
  const book = series(b.seed, n, bookDrift(b.seed), 1.05);
  const index = series(2166136261, n, SPY_DRIFT, 0.55);
  return {
    book,
    index,
    bookEnd: book[n - 1],
    indexEnd: index[n - 1],
    win: book[n - 1] >= index[n - 1],
    n,
    live: false,
    missing: [],
    settled: false,
  };
}

/**
 * @param stated ISO date the premise was made, or null for a link that
 *               predates the field — in which case there is no real window to
 *               measure and the synthetic series is used.
 * @param until  ISO date the claim settles on. Once it has passed, the window
 *               ends there and never moves again: a settled claim that kept
 *               accruing return would be a verdict that changes after it was
 *               delivered, which is not a verdict.
 */
export async function trackBook(
  b: Book,
  stated: string | null,
  days: number | null,
  until: string | null = null
): Promise<TrackResult> {
  if (!isLive() || !stated) {
    const t = syntheticTrack(b, days);
    return { ...t, settled: Boolean(until) };
  }

  // Ballast is part of the book and must be measured with it, or the return
  // flatters the thesis by leaving out the sleeve that is there to drag.
  const holdings = b.holdings;
  const histories = await Promise.all(
    [...holdings.map((h) => h.t), BENCHMARK].map((t) => getHistory(t, stated))
  );
  // A settled claim is measured to its settlement date and no further.
  const cut = until ? (bars: Bar[]) => bars.filter((x) => x.date <= until) : (bars: Bar[]) => bars;
  const benchmark = cut(histories[histories.length - 1]);
  const perHolding = histories.slice(0, -1).map(cut);

  const missing = holdings.filter((_, i) => perHolding[i].length < 2).map((h) => h.t);
  const usable = holdings.filter((_, i) => perHolding[i].length >= 2);
  if (!usable.length || benchmark.length < 2) {
    const t = syntheticTrack(b, days);
    return { ...t, settled: Boolean(until) };
  }

  // Align on the shortest series so every session compares like with like.
  const lengths = perHolding.filter((h) => h.length >= 2).map((h) => h.length);
  const n = Math.min(...lengths, benchmark.length);

  const weightTotal = usable.reduce((s, h) => s + h.pct, 0);
  const book: number[] = [];
  for (let i = 0; i < n; i++) {
    let acc = 0;
    let k = 0;
    for (let j = 0; j < holdings.length; j++) {
      const bars = perHolding[j];
      if (bars.length < 2) continue;
      const closes = bars.slice(bars.length - n);
      const base = closes[0].close;
      const ret = base ? ((closes[i].close - base) / base) * 100 : 0;
      // Renormalise across what is covered, so a missing name does not read as
      // a holding that returned zero.
      acc += ret * (holdings[j].pct / weightTotal);
      k++;
    }
    book.push(k ? acc : 0);
  }

  const index = toReturns(benchmark.slice(benchmark.length - n).map((x) => x.close));

  return {
    book,
    index,
    bookEnd: book[book.length - 1] ?? 0,
    indexEnd: index[index.length - 1] ?? 0,
    win: (book[book.length - 1] ?? 0) >= (index[index.length - 1] ?? 0),
    n,
    live: true,
    missing,
    settled: Boolean(until),
  };
}
