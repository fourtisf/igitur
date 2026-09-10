import { chainProviders } from "./fallback";
import { fmpLastError, fmpProvider } from "./fmp";
import { yahooLastError, yahooProvider } from "./yahoo";
import { remember, rememberedEntry } from "./store";
import { forgetHistoryStore, rememberBars, rememberedBars } from "./history-store";
import { stooqLastError, stooqProvider } from "./stooq";
import { twelveDataLastError, twelveDataProvider } from "./twelvedata";
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
/** Only the two variables that decide this, so a test can pass them plainly. */
export interface MarketEnv {
  /** Twelve Data. The one source verified reachable from the deployment server. */
  TWELVEDATA_API_KEY?: string | undefined;
  /** Set by the deploy scripts so a build never spends a vendor's allowance. */
  MARKET_OFFLINE?: string | undefined;
  /** Next's own build-phase flag, as a second signal. */
  NEXT_PHASE?: string | undefined;
  MARKET_API_KEY?: string | undefined;
  MARKET_PROVIDER?: string | undefined;
  [key: string]: string | undefined;
}

/**
 * A key as .env actually holds it, rather than as it was meant to be written.
 *
 * `MARKET_API_KEY="abc"` is the ordinary way to write a shell variable and the
 * quotes are part of the value here, so the vendor sees `"abc"` and answers
 * 401 — indistinguishable, from the site, from a key that is simply wrong.
 * Same for a stray carriage return out of a Windows editor.
 */
export function cleanKey(raw: string | undefined): string | undefined {
  const k = raw?.trim().replace(/^["']|["']$/g, "").trim();
  return k ? k : undefined;
}

/**
 * True while `next build` is prerendering.
 *
 * A build renders 184 pages across three worker processes, each with its own
 * in-process cache, so every deploy fired the whole universe at the vendor
 * several times over in a few seconds. Against Yahoo that earned a throttle;
 * against Twelve Data, whose free tier allows eight requests a minute and 800
 * credits a day, it earned an instant 429 and spent most of a day's allowance
 * before a single reader arrived.
 *
 * So the build renders generated figures, flagged as generated, and the first
 * revalidation after the server starts fetches real ones — once, at runtime,
 * where the rate is one refresh per TTL rather than a burst per deploy.
 *
 * Two signals, because the phase variable is Next's and could change: the
 * deploy scripts set MARKET_OFFLINE themselves, which is not a guess.
 */
export function buildingOffline(env: MarketEnv = process.env): boolean {
  return env.MARKET_OFFLINE === "1" || env.NEXT_PHASE === "phase-production-build";
}

export function pickProvider(env: MarketEnv = process.env): MarketProvider {
  // Generated figures during a build are not a lie: the pages say so, and the
  // first revalidation replaces them with real ones.
  if (buildingOffline(env)) return syntheticProvider;

  const twelve = cleanKey(env.TWELVEDATA_API_KEY);
  const key = cleanKey(env.MARKET_API_KEY);
  const named = env.MARKET_PROVIDER?.trim().toLowerCase();

  // Named explicitly, so honour it — including asking for generated figures.
  if (named === "synthetic") return syntheticProvider;
  if (named === "yahoo") return chainProviders([yahooProvider(), stooqProvider()]);
  if (named === "stooq") return stooqProvider();

  // A key is a preference, never a promise that the key works. This site served
  // generated figures behind `HTTP 401 from /stable/batch-quote` with keyless
  // sources configured and never asked, because the selection treated a key
  // being *present* as the decision.
  //
  // The order is what the deployment server actually proved, not a ranking of
  // vendors: Twelve Data answered with clean JSON, FMP answered 401, Yahoo
  // answered 429 to every API host, and Stooq answered "this site requires
  // JavaScript to verify your browser" — which a server cannot do. The last two
  // stay in the chain because they cost nothing while a working source is
  // ahead of them, and because a blocked address is not blocked for ever.
  const chain: MarketProvider[] = [];
  if (twelve) chain.push(twelveDataProvider(twelve));
  if (key) chain.push(fmpProvider(key));
  chain.push(yahooProvider(), stooqProvider());
  return chainProviders(chain);
}

let provider: MarketProvider | null = null;
function get(): MarketProvider {
  provider ??= pickProvider();
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
  // Both, not whichever matches the provider's name: with a fallback in place
  // the interesting failure is usually the one the site routed *around*. A
  // rejected key that nothing reports is a rejected key nobody fixes.
  const parts: string[] = [];
  const f = fmpLastError();
  if (f) parts.push(`fmp: ${f}`);
  const y = yahooLastError();
  if (y) parts.push(`yahoo: ${y}`);
  const td = twelveDataLastError();
  if (td) parts.push(`twelvedata: ${td}`);
  const st = stooqLastError();
  if (st) parts.push(`stooq: ${st}`);
  return parts.length ? parts.join(" · ") : null;
}

// ── Caching ──────────────────────────────────────────────────────────────────
//
// A page renders 163 quotes; a reader refreshing must not cost 163 more. But
// the TTL is set by the vendor's daily allowance, not by taste.
//
// The arithmetic differs by vendor, so the default does too. Guessing one TTL
// for all of them is how the FMP key would have died before lunch — spent
// allowance and rejected key look identical from the page.
//
//   FMP          163 tickers batched 50 at a time = 4 requests a refresh,
//                against 250 a day. One hour is 96 a day, comfortably inside.
//
//   Twelve Data  a batch spends one credit PER SYMBOL, so a refresh costs 163
//                against 800 a day. Quotes are not the whole bill, though —
//                see below.
//
// ── The bill the first version of this arithmetic left out ───────────────────
//
// /ledger measures every committed claim against the index, and that needs a
// price series per holding. Those are cached for a day, so it is one sweep of
// every distinct ticker the record touches — and once Igitur's own 26 theses
// were committed, that sweep is 144 names. It was zero when the six-hour TTL
// was chosen, because the record was empty.
//
//   quotes at 6h   4 × 163 = 652
//   ledger history           144
//   total                    796   against 800
//
// Four credits of headroom. One reader opening /track, one deploy verifying
// /ledger, one cache miss, and the key is spent — which is exactly what
// happened: 1175 credits used against a limit of 800, every vendor refusing,
// and the site quietly serving yesterday's closes off the disk store.
//
//   quotes at 8h   3 × 163 = 489
//   ledger history           144
//   total                    633   against 800
//
// Eight hours is honest for what this is. These are not trading prices, the
// page prints the timestamp, and between refreshes the disk store serves the
// last real close — which is a stock's price until the next session opens.
// tests/market-budget.test.ts holds the whole sum under the quota, so growing
// the universe or shortening this cannot quietly kill the key again.
//
// MARKET_TTL_S overrides both, for a paid plan where a minute is affordable.
export const TWELVEDATA_TTL_S = 8 * 3600;
const DEFAULT_TTL_S = cleanKey(process.env.TWELVEDATA_API_KEY) ? TWELVEDATA_TTL_S : 3600;
const QUOTE_TTL = Math.max(60, Number(process.env.MARKET_TTL_S) || DEFAULT_TTL_S) * 1000;

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

/**
 * Fills in a session move the source could not supply, using the last real
 * quote from an earlier day. Returns the quote untouched when the move is
 * already known, or when nothing older is on record.
 */
function withPreviousClose(ticker: string, q: Quote): Quote {
  if (q.changePct !== null || q.previousClose > 0) return q;
  const prev = rememberedEntry(ticker)?.quote;
  if (!prev || prev.price <= 0) return q;
  // Same session, so it is not a previous close — it is this one, again.
  if (prev.asOf.slice(0, 10) >= q.asOf.slice(0, 10)) return q;

  return {
    ...q,
    previousClose: prev.price,
    changePct: Math.round(((q.price - prev.price) / prev.price) * 10_000) / 100,
  };
}

const quoteCache = new Map<string, { at: number; ttl: number; quote: Quote }>();
const historyCache = new Map<string, { at: number; ttl: number; bars: Bar[] }>();

/**
 * Exported for tests: the caches outlive a single case otherwise, and so does
 * the chain — a source set aside after three empty rounds in one test would
 * still be set aside in the next.
 */
export function resetMarketCache(): void {
  quoteCache.clear();
  historyCache.clear();
  // The disk store keeps its own map, so clearing only the two above would
  // leave a test reading bars a previous case wrote — passing for the wrong
  // reason, which is worse than failing.
  forgetHistoryStore();
  failStreak = 0;
  provider = null;
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
    if (hit && now - hit.at < hit.ttl) {
      out.set(t, hit.quote);
      continue;
    }

    // A restart empties the in-process cache, and every deploy restarts the
    // server — so without this each deploy bought the whole universe again. On
    // a free tier metered per symbol that is most of a day's allowance spent on
    // nobody. A stored quote inside its own TTL is as good as one just fetched:
    // it is the same figure, from the same session, with its own timestamp.
    const disk = rememberedEntry(t);
    if (disk && now - disk.at < QUOTE_TTL) {
      quoteCache.set(t, { at: disk.at, ttl: QUOTE_TTL, quote: disk.quote });
      out.set(t, disk.quote);
      continue;
    }

    missing.push(t);
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

    // A source that prices a name without supplying the previous close leaves
    // the session move unknown. But a real quote stored on an earlier date is
    // exactly that previous close — so the move becomes knowable the day after
    // the first successful fetch, with no extra request to anyone. Read before
    // remembering, or the new quote overwrites the one being read.
    const filled = new Map<string, Quote>();
    for (const [t, q] of fetched) filled.set(t, withPreviousClose(t, q));

    // What did come back is worth keeping across a restart. Every deploy
    // restarts the server, and without this a vendor outage would put the site
    // back on generated figures however recently the last good fetch was.
    remember(filled.values());

    for (const t of missing) {
      // A price that was real forty minutes ago is still a real price — a
      // stock's last close is its price until the next session opens. Serving
      // that, with the timestamp it actually carries, beats inventing one.
      // Only when nothing real is known does a generated figure appear, and it
      // says so.
      const q = filled.get(t) ?? rememberedEntry(t)?.quote ?? syntheticQuote(t);
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

  // Disk before vendor. The in-process map dies with the process, and every
  // deploy restarts it — so without this each deploy re-fetched a series for
  // all 144 names /ledger tracks, paid for by the same daily allowance the
  // quotes come out of. Eight deploys in an evening spent 1299 credits of 800.
  const stored = rememberedBars(key);
  if (stored && now - stored.at < HISTORY_TTL) {
    historyCache.set(key, { at: stored.at, ttl: HISTORY_TTL, bars: stored.bars });
    return stored.bars;
  }

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
  // Only a real series is written; rememberBars ignores an empty one.
  rememberBars(key, bars);

  // A vendor that has stopped answering leaves the last good series on disk,
  // and a series from this morning is a better answer than none — the same
  // trade the quote store makes, and /status still says the source is down.
  if (!bars.length && stored) return stored.bars;
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
