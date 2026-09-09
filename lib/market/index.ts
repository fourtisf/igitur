import { fmpLastError, fmpProvider } from "./fmp";
import { yahooLastError, yahooProvider } from "./yahoo";
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
  const named = process.env.MARKET_PROVIDER?.trim().toLowerCase();

  // Named explicitly, so honour it — including asking for generated figures.
  if (named === "synthetic") return syntheticProvider;
  if (named === "yahoo") return yahooProvider();
  if (named === "fmp") {
    // Asking for FMP without a key is a configuration mistake, not a request
    // for made-up numbers. Say so by falling back to the keyless source rather
    // than silently serving figures generated from the ticker text.
    return key ? fmpProvider(key) : yahooProvider();
  }

  // Nothing named. A key means FMP was intended; otherwise the keyless source,
  // because real prices with no configuration beat generated ones with none.
  return key ? fmpProvider(key) : yahooProvider();
}

let provider: MarketProvider | null = null;
function get(): MarketProvider {
  provider ??= pick();
  return provider;
}

/**
 * True when a real vendor is *configured* — not that it answers. A key can be
 * set and rejected, so pages decide their warnings from `quote.synthetic`
 * instead; this only says which provider was selected.
 */
export function isLive(): boolean {
  return get().live;
}

export function providerName(): string {
  return get().name;
}

/**
 * Whether the site is actually serving real figures right now.
 *
 * Not the same question as isLive(), and the difference is the whole point: a
 * key can be set and rejected, in which case every number is still generated.
 * Asking the vendor for one quote is the only answer that cannot be wrong, and
 * it costs nothing — the quote is cached for the next sixty seconds anyway.
 *
 * Every page that describes the data to a reader decides from this, so the
 * description and the data can never drift apart.
 */
export async function marketIsReal(): Promise<boolean> {
  if (!isLive()) return false;
  return !(await getQuote("SPY")).synthetic;
}

/**
 * Why the vendor last failed, or null. Shown on /status so a rejected key is
 * diagnosable from the site itself rather than only from the server logs.
 * Never contains the key.
 */
export function vendorError(): string | null {
  const n = get().name;
  if (n === "fmp") return fmpLastError();
  if (n === "yahoo") return yahooLastError();
  return null;
}

// ── Caching ──────────────────────────────────────────────────────────────────
//
// A page renders 163 quotes; a reader refreshing must not cost 163 more. But
// the TTL is set by the vendor's daily allowance, not by taste.
//
// One full refresh of the universe costs 4 requests — 163 tickers, batched 50
// at a time. FMP's free tier allows 250 requests a day, so:
//
//   60s   → 5,760/day   23× over. The key dies within the hour.
//   5min  → 1,152/day    5× over.
//   30min →   192/day    fits.
//   1h    →    96/day    fits, with room for /track and the record.
//
// An hour is also honest for what this is. These are not trading prices; a
// research tool that says a holding moved 2.4% today does not become wrong
// because the figure is fifty minutes old, and the page prints the timestamp.
//
// MARKET_TTL_S overrides it for a paid plan, where a minute is affordable.
const QUOTE_TTL = Math.max(60, Number(process.env.MARKET_TTL_S) || 3600) * 1000;

// Daily closes change once a day. Six hours meant four identical fetches for
// every holding on every tracked claim, against the same allowance.
const HISTORY_TTL = 24 * 60 * 60_000;

/**
 * A vendor that fails must be retried sooner than one that succeeds.
 *
 * The first version cached a failure for the same hour it cached a price, so a
 * single bad minute — a throttled burst during a deploy, say — left the whole
 * site on generated figures until the hour was up, with no way to recover but
 * another deploy, which would earn the same throttle again. That is how a
 * source answering `curl` perfectly well can look, from the site, permanently
 * dead.
 *
 * So failures back off instead: a minute, then two, four, eight, up to the
 * ordinary TTL. Recovery costs one request a minute at worst, and a source
 * that is genuinely gone is not hammered.
 */
const FIRST_RETRY_MS = 60_000;
const MAX_BACKOFF_STEPS = 6;
let failStreak = 0;

function retryDelay(): number {
  return Math.min(QUOTE_TTL, FIRST_RETRY_MS * 2 ** Math.max(0, failStreak - 1));
}

const quoteCache = new Map<string, { at: number; ttl: number; quote: Quote }>();
const historyCache = new Map<string, { at: number; ttl: number; bars: Bar[] }>();

/** Exported for tests: the caches outlive a single case otherwise. */
export function resetMarketCache(): void {
  quoteCache.clear();
  historyCache.clear();
  failStreak = 0;
}

/** Exported for tests: how long a failure would be held before retrying. */
export function nextRetryDelayMs(): number {
  return retryDelay();
}

/** Exported for tests: how long the entry for `ticker` may be reused, if any. */
export function cachedTtlMs(ticker: string): number | null {
  return quoteCache.get(ticker)?.ttl ?? null;
}

/** The ordinary TTL, so a test can say "shorter than this" and mean it. */
export const QUOTE_TTL_MS = QUOTE_TTL;

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
    if (hit && now - hit.at < hit.ttl) out.set(t, hit.quote);
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

    // Nothing at all came back, so this is the source failing rather than the
    // source not covering these names. Only that earns a short retry — a
    // vendor that priced 158 of 163 is answering, and asking again in a minute
    // for the five it does not carry would be a request storm for no gain.
    const sourceFailed = fetched.size === 0;
    failStreak = sourceFailed ? Math.min(failStreak + 1, MAX_BACKOFF_STEPS) : 0;
    const ttl = sourceFailed ? retryDelay() : QUOTE_TTL;

    for (const t of missing) {
      const q = fetched.get(t) ?? syntheticQuote(t);
      quoteCache.set(t, { at: now, ttl, quote: q });
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
  if (hit && now - hit.at < hit.ttl) return hit.bars;

  let bars: Bar[] = [];
  try {
    bars = await get().history(ticker, from);
  } catch {
    bars = [];
  }
  // An empty series is a question the vendor did not answer, not an answer.
  // Holding it for a day would keep a tracked claim blank long after the
  // source came back.
  historyCache.set(key, { at: now, ttl: bars.length ? HISTORY_TTL : retryDelay(), bars });
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
