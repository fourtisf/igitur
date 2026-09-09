import { httpGet } from "./http";
import type { Bar, MarketProvider, Quote } from "./types";

/**
 * Financial Modeling Prep.
 *
 * Chosen from the three vendors HANDOFF.md §5 names because it batches: the
 * whole universe arrives in a handful of requests, which is what makes a free
 * tier viable for a site that renders 163 tickers on one page.
 *
 * Configure with:
 *   MARKET_PROVIDER=fmp
 *   MARKET_API_KEY=...
 *
 * ── What is verified, and what is not (checked 2026-09-08) ──────────────────
 *
 * This targets FMP's `/stable` API, not the older `/api/v3`. That matters: v3
 * is legacy, no longer in the public documentation, and reachable only by
 * accounts that already had it — a key created today would have got 401 or 403
 * from every v3 call, and the site would have silently stayed synthetic.
 *
 * The endpoint paths and the parameter names below come from FMP's current
 * documentation. The exact JSON field names could not be confirmed against a
 * live response, because no key was available and the vendor's domain is not
 * reachable from the machine this was written on. So the parser accepts both
 * spellings wherever the two API generations disagree — `changePercentage`
 * (stable) and `changesPercentage` (v3), a bare array and `{historical: []}` —
 * and every field is read defensively. A field that is missing or malformed
 * falls back to the synthetic figure for that one ticker rather than putting a
 * zero on the page as though it were a price.
 *
 * If the vendor is configured and the site still reports synthetic data,
 * /status names the reason; the likely one is a plan that excludes batch
 * quotes.
 */

const BASE = "https://financialmodelingprep.com/stable";

/** Batch size. FMP documents no cap; stay well under whatever it is. */
const BATCH = 50;

/** A vendor call that hangs must not hold a page render open. */
const TIMEOUT_MS = 8_000;

interface FmpQuote {
  symbol?: string;
  price?: number;
  /** `/stable` spelling. */
  changePercentage?: number;
  /** `/api/v3` spelling, kept so a legacy-shaped response still parses. */
  changesPercentage?: number;
  marketCap?: number;
  previousClose?: number;
  open?: number;
  timestamp?: number;
}

interface FmpBar {
  date?: string;
  close?: number;
}

/** `/stable` returns a bare array; `/api/v3` wrapped it in `historical`. */
type FmpHistory = FmpBar[] | { historical?: FmpBar[] };

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * The last vendor failure, so a misconfiguration is discoverable instead of
 * mysterious. Read by /status. Never contains the key.
 */
let lastError: string | null = null;
export function fmpLastError(): string | null {
  return lastError;
}

/**
 * The key travels in the query string, because that is the only way FMP
 * accepts it. So anything derived from a failed request — and error messages
 * from fetch and from Next both quote the whole URL — has to be scrubbed
 * before it can go anywhere a person might read it. /status prints this.
 */
function scrub(text: string, apiKey: string): string {
  return text
    .split(apiKey)
    .join("***")
    .replace(/apikey=[^&\s]*/gi, "apikey=***")
    // A whole URL in a user-facing message is noise at best and a second
    // chance to leak at worst.
    .replace(/https?:\/\/\S+/g, "the vendor endpoint")
    .slice(0, 200);
}

async function getJson<T>(url: string, apiKey: string): Promise<T | null> {
  let res;
  try {
    res = await httpGet(url, { headers: { Accept: "application/json" }, timeoutMs: TIMEOUT_MS });
  } catch (e) {
    // httpGet is written not to reject. If that ever stops being true, the
    // message still must not reach a page carrying the key.
    lastError = scrub(e instanceof Error ? e.message : "request failed", apiKey);
    return null;
  }
  if (res.status !== 200) {
    // 401/403: key rejected. 402: endpoint needs a paid plan. 429: quota.
    // 0: the request never completed, and `error` says why.
    const why = res.error ? ` (${scrub(res.error, apiKey)})` : "";
    lastError = `HTTP ${res.status} from ${path(url)}${why}`;
    return null;
  }
  try {
    const parsed = JSON.parse(res.body) as T;
    lastError = null;
    return parsed;
  } catch {
    lastError = `unreadable response from ${path(url)}`;
    return null;
  }
}

/** The endpoint being named, never the query string the key travels in. */
function path(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return "the vendor endpoint";
  }
}

export function fmpProvider(apiKey: string): MarketProvider {
  const key = encodeURIComponent(apiKey);

  return {
    name: "fmp",
    live: true,

    async quotes(tickers) {
      const out = new Map<string, Quote>();
      const asOfDefault = new Date().toISOString();

      for (let i = 0; i < tickers.length; i += BATCH) {
        const slice = tickers.slice(i, i + BATCH);
        const url = `${BASE}/batch-quote?symbols=${slice.map(encodeURIComponent).join(",")}&apikey=${key}`;
        const rows = await getJson<FmpQuote[]>(url, apiKey);
        if (!Array.isArray(rows)) continue;

        for (const row of rows) {
          const ticker = typeof row.symbol === "string" ? row.symbol.toUpperCase() : null;
          const price = num(row.price);
          // Without a price there is no quote. Leaving it out lets the caller
          // fall back for this ticker alone.
          if (!ticker || price === null || price <= 0) continue;

          const changePct = num(row.changePercentage) ?? num(row.changesPercentage) ?? 0;
          const previousClose =
            num(row.previousClose) ?? Math.round((price / (1 + changePct / 100)) * 100) / 100;

          out.set(ticker, {
            ticker,
            price,
            changePct: Math.round(changePct * 100) / 100,
            // FMP reports market cap in units; the site works in billions.
            marketCap: (num(row.marketCap) ?? 0) / 1e9,
            previousClose,
            open: num(row.open) ?? previousClose,
            asOf: row.timestamp ? new Date(row.timestamp * 1000).toISOString() : asOfDefault,
            synthetic: false,
          });
        }
      }
      return out;
    },

    async history(ticker, from) {
      const url =
        `${BASE}/historical-price-eod/full?symbol=${encodeURIComponent(ticker)}` +
        `&from=${encodeURIComponent(from)}&apikey=${key}`;
      const body = await getJson<FmpHistory>(url, apiKey);
      const rows = Array.isArray(body) ? body : body?.historical;
      if (!Array.isArray(rows)) return [];

      const bars: Bar[] = [];
      for (const r of rows) {
        const close = num(r.close);
        if (typeof r.date !== "string" || close === null || close <= 0) continue;
        bars.push({ date: r.date, close });
      }
      // FMP returns newest first; the chart reads oldest first.
      bars.sort((a, b) => a.date.localeCompare(b.date));
      return bars;
    },
  };
}
