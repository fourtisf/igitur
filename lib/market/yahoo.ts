import type { Bar, MarketProvider, Quote } from "./types";

/**
 * Yahoo Finance, through the public chart endpoint.
 *
 * Chosen because it needs no key, no account and no signup — which for this
 * deployment was the entire obstacle. Reachability was confirmed from the
 * server before this was written: three Stooq endpoints returned "page does not
 * exist" or a bot check, and this one returned real JSON for NVDA.
 *
 * ── What is honest about this choice ─────────────────────────────────────────
 *
 * This is not a documented, supported API. It is the endpoint Yahoo's own
 * charts call, it is public and unauthenticated, and a great deal of software
 * reads it — but Yahoo can change or restrict it without notice, and no
 * agreement obliges them not to. FMP is the sturdier path if this site ever
 * needs a supplier it can hold to something. Configure MARKET_API_KEY and the
 * FMP provider takes over.
 *
 * The failure mode is the same either way: any ticker this cannot price falls
 * back to its generated figure, flagged as generated, and /status names the
 * reason.
 *
 * ── What it cannot supply ────────────────────────────────────────────────────
 *
 * Market capitalisation is not in this response. It is reported as 0, which the
 * formatter renders as an em dash rather than "$0B" — an absent figure shown as
 * absent, not as a number.
 *
 * ⚠ Written from a verified endpoint but unverified field names: the response
 * was seen truncated at 260 characters, before the price fields. Every field is
 * therefore read through a list of the names Yahoo has used, and a miss costs
 * that one ticker rather than the page.
 */

const BASE = "https://query1.finance.yahoo.com/v8/finance/chart";

/** A vendor call that hangs must not hold a page render open. */
const TIMEOUT_MS = 8_000;

/** How long Next may reuse a response. Mirrors ./index.ts. */
const QUOTE_TTL_S = Math.max(60, Number(process.env.MARKET_TTL_S) || 3600);
const HISTORY_TTL_S = 24 * 60 * 60;

/**
 * One request per ticker, so 163 of them must not arrive at once. Yahoo has no
 * published limit and every reason to throttle a burst; six at a time crosses
 * the universe in under a minute and looks like a browser rather than a script.
 */
const CONCURRENCY = 6;

/** Yahoo answers a bare fetch with 403. */
const HEADERS = {
  Accept: "application/json",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
};

interface Meta {
  regularMarketPrice?: number;
  chartPreviousClose?: number;
  previousClose?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketTime?: number;
  currency?: string;
}
interface Result {
  meta?: Meta;
  timestamp?: number[];
  indicators?: { quote?: { open?: (number | null)[]; close?: (number | null)[] }[] };
}
interface ChartBody {
  chart?: { result?: Result[]; error?: { description?: string } | null };
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

let lastError: string | null = null;
export function yahooLastError(): string | null {
  return lastError;
}

async function chart(symbol: string, query: string, ttl: number): Promise<Result | null> {
  const url = `${BASE}/${encodeURIComponent(symbol)}?${query}`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: ttl },
      headers: HEADERS,
    });
    if (!res.ok) {
      // 404: no such symbol. 429: throttled. 403: the endpoint is refusing us.
      lastError = `HTTP ${res.status} for ${symbol}`;
      return null;
    }
    const body = (await res.json()) as ChartBody;
    const r = body.chart?.result?.[0];
    if (!r) {
      lastError = body.chart?.error?.description ?? `no data for ${symbol}`;
      return null;
    }
    lastError = null;
    return r;
  } catch (e) {
    // A vendor outage must degrade to synthetic, never take the page down.
    lastError = e instanceof Error ? e.message.slice(0, 160) : "request failed";
    return null;
  }
}

/** Run `work` over `items`, at most `CONCURRENCY` in flight. */
async function pool<T, R>(items: T[], work: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      for (;;) {
        const i = next++;
        if (i >= items.length) return;
        out[i] = await work(items[i]);
      }
    })
  );
  return out;
}

export function yahooProvider(): MarketProvider {
  return {
    name: "yahoo",
    live: true,

    async quotes(tickers) {
      const out = new Map<string, Quote>();
      const results = await pool(tickers, (t) => chart(t, "range=5d&interval=1d", QUOTE_TTL_S));

      results.forEach((r, i) => {
        const ticker = tickers[i].toUpperCase();
        const m = r?.meta;
        if (!m) return;

        const price = num(m.regularMarketPrice);
        // Without a price there is no quote. Leaving it out lets the caller
        // fall back for this ticker alone.
        if (price === null || price <= 0) return;

        // Yahoo has used both names across versions of this response.
        const prev = num(m.chartPreviousClose) ?? num(m.previousClose) ?? price;
        // The open is not in meta; take it from the last daily bar.
        const opens = r.indicators?.quote?.[0]?.open ?? [];
        const open = num(opens[opens.length - 1]) ?? prev;

        out.set(ticker, {
          ticker,
          price,
          changePct: prev ? Math.round(((price - prev) / prev) * 10_000) / 100 : 0,
          // Not in this response. Zero renders as an em dash, which is an
          // absent figure shown as absent rather than as $0B.
          marketCap: 0,
          previousClose: prev,
          open,
          asOf: m.regularMarketTime
            ? new Date(m.regularMarketTime * 1000).toISOString()
            : new Date().toISOString(),
          synthetic: false,
        });
      });
      return out;
    },

    async history(ticker, from) {
      const p1 = Math.floor(Date.parse(from + "T00:00:00Z") / 1000);
      if (!Number.isFinite(p1)) return [];
      const p2 = Math.floor(Date.now() / 1000);
      const r = await chart(
        ticker,
        `period1=${p1}&period2=${p2}&interval=1d`,
        HISTORY_TTL_S
      );

      const stamps = r?.timestamp ?? [];
      const closes = r?.indicators?.quote?.[0]?.close ?? [];
      const bars: Bar[] = [];
      for (let i = 0; i < stamps.length; i++) {
        const c = num(closes[i]);
        // Yahoo leaves nulls in the series for halted sessions; a gap is not a
        // price and must not be charted as one.
        if (c === null || c <= 0) continue;
        bars.push({ date: new Date(stamps[i] * 1000).toISOString().slice(0, 10), close: c });
      }
      // Already oldest first, but the chart depends on it — do not assume.
      bars.sort((a, b) => a.date.localeCompare(b.date));
      return bars;
    },
  };
}
