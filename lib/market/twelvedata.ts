import { httpGet } from "./http";
import type { Bar, MarketProvider, Quote } from "./types";

/**
 * Twelve Data.
 *
 * ── Why this one ─────────────────────────────────────────────────────────────
 *
 * The other three were each ruled out by the server itself, not by taste:
 *
 *   Yahoo   429 to every API host. Data-centre ranges are throttled as policy.
 *   Stooq   "This site requires JavaScript to verify your browser." A server
 *           does not run JavaScript, so that door does not open.
 *   FMP     401. Reachable, answering, holding a key that was never valid.
 *
 * This one answered the deployment server with a clean JSON 401 — the endpoint
 * exists, the address is right, the network path works, and the only missing
 * piece was a key. That is a verified fact about this server rather than a
 * hopeful reading of documentation, which is the standard the previous three
 * failed to meet.
 *
 * It also batches, which matters here more than anywhere: /universe renders 163
 * names, and a vendor priced one symbol at a time would make that page wait
 * minutes on a cold cache.
 *
 * ── The free tier's arithmetic ───────────────────────────────────────────────
 *
 * 800 credits a day, and a batch spends one credit per symbol — so one full
 * refresh of the universe costs 163 and the allowance carries about four a day.
 * lib/market therefore defaults to a six-hour TTL when this provider is in use.
 * At one hour the key would be spent before lunch and the site would look
 * broken for reasons nothing on the page could explain, which is exactly how
 * the FMP key failed.
 *
 * Between refreshes the disk store serves the last real close with the
 * timestamp it actually carries. A stock's last close is its price until the
 * next session opens.
 *
 *   MARKET_PROVIDER=twelvedata     (optional; a key alone is enough)
 *   TWELVEDATA_API_KEY=...
 */

const BASE = "https://api.twelvedata.com";

const TIMEOUT_MS = 10_000;

/** Symbols per request. The credit cost is per symbol either way. */
const BATCH = 50;

/**
 * Values arrive as strings — "671.23", not 671.23 — which is the single most
 * common way to parse this API wrong. A number is accepted too, in case that
 * ever changes.
 */
function num(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string" || !v.trim()) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

let lastError: string | null = null;
export function twelveDataLastError(): string | null {
  return lastError;
}

/** The vendor names itself in error text; the key never appears in it. */
function scrub(text: string, apiKey: string): string {
  return text
    .split(apiKey)
    .join("***")
    .replace(/apikey=[^&\s]*/gi, "apikey=***")
    .slice(0, 200);
}

interface Row {
  symbol?: string;
  open?: unknown;
  close?: unknown;
  previous_close?: unknown;
  percent_change?: unknown;
  datetime?: string;
  timestamp?: number;
  /** Present only on a failure, per symbol or for the whole request. */
  status?: string;
  code?: number;
  message?: string;
}

export function quoteFromRow(row: Row): Quote | null {
  if (row.status === "error") return null;
  const ticker = typeof row.symbol === "string" ? row.symbol.toUpperCase() : null;
  const price = num(row.close);
  // Without a price there is no quote. Leaving it out lets the caller fall back
  // for this one ticker rather than putting a zero on the page.
  if (!ticker || price === null || price <= 0) return null;

  const prev = num(row.previous_close);
  const pct = num(row.percent_change);

  return {
    ticker,
    price,
    // The vendor's own figure when it sent one, derived from two real closes
    // when it did not, and unknown rather than a calm zero when neither holds.
    changePct:
      pct !== null
        ? Math.round(pct * 100) / 100
        : prev && prev > 0
          ? Math.round(((price - prev) / prev) * 10_000) / 100
          : null,
    // Not in this response. Zero renders as an em dash — an absent figure shown
    // as absent, rather than as $0B.
    marketCap: 0,
    previousClose: prev ?? 0,
    open: num(row.open) ?? prev ?? 0,
    asOf: row.timestamp
      ? new Date(row.timestamp * 1000).toISOString()
      : row.datetime && !Number.isNaN(Date.parse(row.datetime))
        ? new Date(row.datetime + (row.datetime.length === 10 ? "T00:00:00Z" : "")).toISOString()
        : new Date().toISOString(),
    synthetic: false,
  };
}

/**
 * One symbol comes back as the row itself; several come back keyed by symbol.
 * Both shapes are read, because relying on the one this file happened to be
 * written against is how the last three providers went wrong.
 */
export function rowsFrom(body: unknown): Row[] {
  if (!body || typeof body !== "object") return [];
  const obj = body as Record<string, unknown> & Row;
  if (obj.status === "error") return [];
  if (typeof obj.symbol === "string") return [obj];

  const out: Row[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (!value || typeof value !== "object") continue;
    const row = value as Row;
    // A batch labels each row by the symbol asked for; the row itself does not
    // always repeat it.
    out.push({ ...row, symbol: row.symbol ?? key });
  }
  return out;
}

async function getJson(url: string, apiKey: string): Promise<unknown | null> {
  const res = await httpGet(url, {
    headers: { Accept: "application/json" },
    timeoutMs: TIMEOUT_MS,
  });
  if (res.status !== 200) {
    lastError = `HTTP ${res.status}${res.error ? ` (${scrub(res.error, apiKey)})` : ""}`;
    return null;
  }
  let body: unknown;
  try {
    body = JSON.parse(res.body);
  } catch {
    lastError = "unreadable response";
    return null;
  }
  // This vendor reports failure inside a 200: a spent allowance and a rejected
  // key both arrive as ordinary JSON, and treating either as data would put
  // nothing on the page while the site claimed the vendor was answering.
  const err = body as { status?: string; message?: string; code?: number };
  if (err?.status === "error") {
    lastError = scrub(`${err.code ?? ""} ${err.message ?? "rejected"}`.trim(), apiKey);
    return null;
  }
  lastError = null;
  return body;
}

export function twelveDataProvider(apiKey: string): MarketProvider {
  const key = encodeURIComponent(apiKey);

  return {
    name: "twelvedata",
    live: true,

    async quotes(tickers) {
      const out = new Map<string, Quote>();

      for (let i = 0; i < tickers.length; i += BATCH) {
        const slice = tickers.slice(i, i + BATCH);
        const body = await getJson(
          `${BASE}/quote?symbol=${slice.map(encodeURIComponent).join(",")}&apikey=${key}`,
          apiKey
        );
        if (!body) break;
        for (const row of rowsFrom(body)) {
          const q = quoteFromRow(row);
          if (q) out.set(q.ticker, q);
        }
      }
      return out;
    },

    async history(ticker, from) {
      const body = await getJson(
        `${BASE}/time_series?symbol=${encodeURIComponent(ticker)}` +
          `&interval=1day&start_date=${encodeURIComponent(from)}&outputsize=5000&apikey=${key}`,
        apiKey
      );
      const values = (body as { values?: { datetime?: string; close?: unknown }[] })?.values;
      if (!Array.isArray(values)) return [];

      const bars: Bar[] = [];
      for (const v of values) {
        const close = num(v.close);
        if (typeof v.datetime !== "string" || close === null || close <= 0) continue;
        bars.push({ date: v.datetime.slice(0, 10), close });
      }
      // Newest first from the vendor; the chart reads oldest first.
      bars.sort((a, b) => a.date.localeCompare(b.date));
      return bars;
    },
  };
}

/** One live, uncached request, for /api/market-probe. */
export async function twelveDataProbe(
  apiKey: string
): Promise<{ status: number; ok: boolean; detail: string }> {
  const res = await httpGet(`${BASE}/quote?symbol=SPY&apikey=${encodeURIComponent(apiKey)}`, {
    headers: { Accept: "application/json" },
    timeoutMs: TIMEOUT_MS,
  });
  if (res.status !== 200) {
    return { status: res.status, ok: false, detail: scrub(res.error ?? "refused", apiKey) };
  }
  let body: unknown;
  try {
    body = JSON.parse(res.body);
  } catch {
    return { status: 200, ok: false, detail: "unreadable response" };
  }
  const err = body as { status?: string; message?: string; code?: number };
  if (err?.status === "error") {
    return {
      status: 200,
      ok: false,
      detail: scrub(`${err.code ?? ""} ${err.message ?? "rejected"}`.trim(), apiKey),
    };
  }
  const q = quoteFromRow(rowsFrom(body)[0] ?? {});
  return q
    ? { status: 200, ok: true, detail: `SPY ${q.price}` }
    : { status: 200, ok: false, detail: "answered, but with no price" };
}
