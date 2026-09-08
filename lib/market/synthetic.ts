import { fnv, rng } from "../hash";
import type { Bar, MarketProvider, Quote } from "./types";

/**
 * The fallback provider: deterministic figures generated from the ticker text.
 *
 * This is the original prototype behaviour, kept for one reason — the site has
 * to render when no vendor key is configured, and it has to render the same way
 * every time so the tests stay meaningful. Every quote it returns is flagged
 * `synthetic: true`, and the UI turns that into the visible warning.
 *
 * It is not a stand-in for real data and never was. HANDOFF.md §5.
 */

const DAY_SEED = 20260907;

/** Annualised drift of the benchmark. Every synthetic book is centred on it. */
export const SPY_DRIFT = 0.034;

export function syntheticPrice(t: string): number {
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
export function syntheticMcap(t: string): number {
  const r = rng(fnv(t + ":mc"));
  r();
  r();
  const v = r();
  return v < 0.2 ? 0.6 + r() * 7 : v < 0.55 ? 9 + r() * 70 : v < 0.85 ? 80 + r() * 420 : 500 + r() * 2600;
}

/** Session change in percent. Fat-tailed, so /trending is not uniform. */
export function syntheticMove(t: string): number {
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
 * A book's drift, centred on the index so roughly half of all books lose.
 *
 * This symmetry is load-bearing while the data is synthetic: an earlier build
 * gave the book a higher drift than the index, so every book beat the market —
 * a marketing claim baked into the code. With real history this function is not
 * used at all, because the answer comes from actual closes.
 */
export function bookDrift(seed: number): number {
  const r = rng((seed ^ 0x9e3779b9) >>> 0);
  r();
  r();
  return SPY_DRIFT + (r() - 0.5) * 0.13;
}

export function syntheticQuote(ticker: string): Quote {
  const price = syntheticPrice(ticker);
  const changePct = syntheticMove(ticker);
  // Derive the previous close from the change so the two never contradict.
  const previousClose = Math.round((price / (1 + changePct / 100)) * 100) / 100;
  return {
    ticker,
    price,
    changePct,
    marketCap: syntheticMcap(ticker),
    previousClose,
    open: previousClose,
    asOf: new Date(0).toISOString(),
    synthetic: true,
  };
}

export const syntheticProvider: MarketProvider = {
  name: "synthetic",
  live: false,
  async quotes(tickers) {
    return new Map(tickers.map((t) => [t, syntheticQuote(t)]));
  },
  async history() {
    // Deliberately empty. A synthetic history would let /track draw a
    // convincing performance chart out of nothing, which is the one thing
    // HANDOFF.md §5 is most emphatic about not doing.
    return [] as Bar[];
  },
};
