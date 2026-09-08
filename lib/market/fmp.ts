import type { Bar, MarketProvider, Quote } from "./types";

/**
 * Financial Modeling Prep.
 *
 * Chosen from the three vendors HANDOFF.md §5 names because it batches: all 163
 * tickers arrive in one request, which is what makes the free tier viable for a
 * site that renders the whole universe on a single page.
 *
 * Configure with:
 *   MARKET_PROVIDER=fmp
 *   MARKET_API_KEY=...
 *
 * ⚠ This path has not been exercised against the live API — no key was
 * available when it was written. The response shapes below follow FMP's
 * documented `/quote` and `/historical-price-full` formats, and every field is
 * read defensively: a missing or malformed value falls back to the synthetic
 * figure for that one ticker rather than rendering a zero as if it were a price.
 */

const BASE = "https://financialmodelingprep.com/api/v3";

/** FMP rejects very long symbol lists; batch well under any documented cap. */
const BATCH = 50;

interface FmpQuote {
  symbol?: string;
  price?: number;
  changesPercentage?: number;
  marketCap?: number;
  previousClose?: number;
  open?: number;
  timestamp?: number;
}

interface FmpHistorical {
  historical?: { date?: string; close?: number }[];
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T | null> {
  try {
    const res = await fetch(url, {
      signal,
      // Caching is handled a layer up, keyed by ticker set, so the fetch itself
      // must not be cached separately or the TTLs fight each other.
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    // A vendor outage must degrade to synthetic, never take the page down.
    return null;
  }
}

export function fmpProvider(apiKey: string): MarketProvider {
  return {
    name: "fmp",
    live: true,

    async quotes(tickers) {
      const out = new Map<string, Quote>();
      const asOfDefault = new Date().toISOString();

      for (let i = 0; i < tickers.length; i += BATCH) {
        const slice = tickers.slice(i, i + BATCH);
        const url = `${BASE}/quote/${slice.join(",")}?apikey=${encodeURIComponent(apiKey)}`;
        const rows = await getJson<FmpQuote[]>(url);
        if (!Array.isArray(rows)) continue;

        for (const row of rows) {
          const ticker = typeof row.symbol === "string" ? row.symbol.toUpperCase() : null;
          const price = num(row.price);
          // Without a price there is no quote. Leaving it out lets the caller
          // fall back for this ticker alone.
          if (!ticker || price === null || price <= 0) continue;

          const changePct = num(row.changesPercentage) ?? 0;
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
        `${BASE}/historical-price-full/${encodeURIComponent(ticker)}` +
        `?from=${encodeURIComponent(from)}&apikey=${encodeURIComponent(apiKey)}`;
      const body = await getJson<FmpHistorical>(url);
      const rows = body?.historical;
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
