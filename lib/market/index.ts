import { fmpProvider } from "./fmp";
import { syntheticProvider, syntheticQuote } from "./synthetic";
import type { Bar, MarketProvider, Quote } from "./types";

export type { Bar, Quote } from "./types";
export { bookDrift, series, SPY_DRIFT } from "./synthetic";

/**
 * Where market data comes from.
 *
 * With no key configured the site runs on the synthetic provider and says so on
 * every page carrying a number — which is what it did for the whole prototype.
 * Set MARKET_API_KEY and the same pages quietly stop warning, because the
 * warning is derived from the data rather than hand-written beside it.
 *
 *   MARKET_PROVIDER=fmp
 *   MARKET_API_KEY=your-key
 */
function pick(): MarketProvider {
  const key = process.env.MARKET_API_KEY?.trim();
  if (!key) return syntheticProvider;

  switch ((process.env.MARKET_PROVIDER ?? "fmp").toLowerCase()) {
    case "fmp":
      return fmpProvider(key);
    default:
      // An unrecognised provider name is a configuration mistake. Falling back
      // is safer than guessing, and the site will say its data is synthetic.
      return syntheticProvider;
  }
}

let provider: MarketProvider | null = null;
function get(): MarketProvider {
  provider ??= pick();
  return provider;
}

/** True when a real vendor is configured. Read by the UI to drop the warnings. */
export function isLive(): boolean {
  return get().live;
}

export function providerName(): string {
  return get().name;
}

// ── Caching ──────────────────────────────────────────────────────────────────
// A page renders 163 quotes; a reader refreshing must not cost 163 more.
const QUOTE_TTL = 60_000;
const HISTORY_TTL = 6 * 60 * 60_000;

const quoteCache = new Map<string, { at: number; quote: Quote }>();
const historyCache = new Map<string, { at: number; bars: Bar[] }>();

/**
 * Quotes for a set of tickers.
 *
 * Never rejects and never returns a partial map: anything the vendor does not
 * cover falls back to its synthetic figure, flagged as such, so a page always
 * has something to render and always tells the truth about what it is.
 */
export async function getQuotes(tickers: readonly string[]): Promise<Map<string, Quote>> {
  const now = Date.now();
  const out = new Map<string, Quote>();
  const missing: string[] = [];

  for (const t of tickers) {
    const hit = quoteCache.get(t);
    if (hit && now - hit.at < QUOTE_TTL) out.set(t, hit.quote);
    else missing.push(t);
  }

  if (missing.length) {
    let fetched = new Map<string, Quote>();
    try {
      fetched = await get().quotes(missing);
    } catch {
      // Degrade, never fail: the page is more useful with honest synthetic
      // figures than with an error.
      fetched = new Map();
    }
    for (const t of missing) {
      const q = fetched.get(t) ?? syntheticQuote(t);
      quoteCache.set(t, { at: now, quote: q });
      out.set(t, q);
    }
  }

  return out;
}

export async function getQuote(ticker: string): Promise<Quote> {
  return (await getQuotes([ticker])).get(ticker) ?? syntheticQuote(ticker);
}

/**
 * Daily closes since `from`. Empty when no real history is available — callers
 * must treat that as "cannot answer" rather than substituting a shape.
 */
export async function getHistory(ticker: string, from: string): Promise<Bar[]> {
  const key = `${ticker}|${from}`;
  const now = Date.now();
  const hit = historyCache.get(key);
  if (hit && now - hit.at < HISTORY_TTL) return hit.bars;

  let bars: Bar[] = [];
  try {
    bars = await get().history(ticker, from);
  } catch {
    bars = [];
  }
  historyCache.set(key, { at: now, bars });
  return bars;
}

// ── Formatting ───────────────────────────────────────────────────────────────

export function fmtMcap(b: number): string {
  if (!Number.isFinite(b) || b <= 0) return "—";
  return b >= 1000 ? "$" + (b / 1000).toFixed(2) + "T" : "$" + b.toFixed(0) + "B";
}

export function fmtPrice(p: number): string {
  if (!Number.isFinite(p) || p <= 0) return "—";
  return "$" + p.toFixed(2);
}

/**
 * A sparkline path from a quote.
 *
 * Three real points — previous close, open, last — rather than the twenty-six
 * invented ones the prototype drew. It is coarse, but every vertex is a number
 * the vendor actually reported, and drawing a plausible intraday wiggle beside
 * real prices would be the same lie in a smaller font.
 */
export function sparkPath(q: Quote, w: number, h: number): string {
  const pts = [q.previousClose, q.open || q.previousClose, q.price].filter(
    (v) => Number.isFinite(v) && v > 0
  );
  if (pts.length < 2) return `M0 ${(h / 2).toFixed(1)} L${w} ${(h / 2).toFixed(1)}`;

  const lo = Math.min(...pts);
  const hi = Math.max(...pts);
  const span = hi - lo || 1;
  const pad = h * 0.14;
  return pts
    .map((v, i) => {
      const x = (i / (pts.length - 1)) * w;
      // SVG y grows downward, so a rise must move up the box.
      const y = pad + (1 - (v - lo) / span) * (h - pad * 2);
      return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}
