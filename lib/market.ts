/**
 * MARKET DATA — synthetic, deterministic, NOT rigged.
 *
 * ⚠ REPLACE THIS. HANDOFF.md §5. Every number in here is generated from the
 * ticker string. It never changes and reflects nothing. The site says so on
 * /method and /status, and it must keep saying so until this module is wired
 * to a real vendor (Polygon.io, Financial Modeling Prep, Twelve Data — all 164
 * tickers fit comfortably in a free or cheap tier).
 *
 * The functions below are the seam. Swap their bodies for vendor calls and
 * nothing else in the app has to change:
 *
 *   priceOf   → real last close
 *   mcapOf    → real market cap
 *   moveFor   → real session change
 *   sparkPath → real intraday series
 *   series    → real total return since the stated date
 *
 * CRITICAL — the benchmark must stay fair. An earlier build gave the book a
 * higher drift (0.055) than the index (0.032), which meant every book beat the
 * market. That was a marketing claim baked into the code. The drift now draws
 * from the premise seed and is centred on the index, so roughly half of all
 * books lose. Never reintroduce an asymmetry.
 */

import { fnv, rng } from "./hash";

/** True while the figures above are synthetic. The UI reads this to decide
 *  whether to show the "prototype figures" warning. Flip it when the vendor
 *  is wired in — and not before. */
export const SYNTHETIC = true;

const DAY_SEED = 20260907;

/** Annualised drift of the benchmark. Every book is centred on this. */
export const SPY_DRIFT = 0.034;

export function priceOf(t: string): number {
  const r = rng(fnv(t + ":px"));
  r();
  const band = r();
  const base =
    band < 0.12
      ? 3 + r() * 22
      : band < 0.55
        ? 30 + r() * 140
        : band < 0.88
          ? 160 + r() * 380
          : 500 + r() * 900;
  return Math.round(base * 100) / 100;
}

/** Market cap in billions. */
export function mcapOf(t: string): number {
  const r = rng(fnv(t + ":mc"));
  r();
  r();
  const v = r();
  return v < 0.2 ? 0.6 + r() * 7 : v < 0.55 ? 9 + r() * 70 : v < 0.85 ? 80 + r() * 420 : 500 + r() * 2600;
}

export function fmtMcap(b: number): string {
  return b >= 1000 ? "$" + (b / 1000).toFixed(2) + "T" : "$" + b.toFixed(0) + "B";
}

/** Session change, in percent. Fat-tailed, so the trending page is not uniform. */
export function moveFor(t: string): number {
  const r = rng(fnv(t + ":" + DAY_SEED));
  r();
  r();
  const u = r();
  const v = r();
  const base = (u - 0.5) * 2;
  const fat = Math.pow(Math.abs(base), 0.62) * (base < 0 ? -1 : 1);
  const vol = v > 0.86 ? 3.1 : v > 0.6 ? 1.7 : 1;
  return Math.round(fat * 6.4 * vol * 100) / 100;
}

/** An SVG path for a sparkline, `w` x `h`. Ends consistent with moveFor(). */
export function sparkPath(t: string, w: number, h: number): string {
  const r = rng(fnv(t + ":spark:" + DAY_SEED));
  const pts: number[] = [];
  let v = 0.5;
  for (let i = 0; i < 26; i++) {
    v += (r() - 0.48) * 0.13;
    v = Math.max(0.08, Math.min(0.92, v));
    pts.push(v);
  }
  // SVG y grows downward, so a positive move must end near the top.
  pts[pts.length - 1] = moveFor(t) > 0 ? 0.14 : 0.86;
  return pts
    .map((p, i) => (i ? "L" : "M") + ((i / (pts.length - 1)) * w).toFixed(1) + " " + (p * h).toFixed(1))
    .join(" ");
}

/** A cumulative return series. */
export function series(seed: number, n: number, drift: number, vol: number): number[] {
  const r = rng(seed);
  const out: number[] = [];
  let v = 0;
  for (let i = 0; i < n; i++) {
    v += drift + (r() - 0.5) * vol;
    out.push(v);
  }
  return out;
}

/**
 * The book's drift, centred on the index. Roughly half of all books lose.
 * This symmetry is load-bearing — see the note at the top of this file.
 */
export function bookDrift(seed: number): number {
  const r = rng((seed ^ 0x9e3779b9) >>> 0);
  r();
  r();
  return SPY_DRIFT + (r() - 0.5) * 0.13;
}
