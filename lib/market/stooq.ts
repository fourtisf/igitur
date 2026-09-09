import { httpGet } from "./http";
import type { Bar, MarketProvider, Quote } from "./types";

/**
 * Stooq, through the CSV endpoints its own pages use.
 *
 * ── Why a third source ───────────────────────────────────────────────────────
 *
 * Yahoo returned 429 to this deployment for hours: cookies fine, every API
 * host refusing. Data-centre address ranges are throttled as a matter of
 * policy, and no amount of politeness on our side changes that — the earlier
 * fix stopped the site provoking it, which is not the same as making it work.
 * The paid vendor was answering 401 with a key that had never been valid.
 *
 * Two sources that fail together are one source. This is a different company,
 * a different network and a different rate limit, and it needs no key, no
 * account and no signup — the obstacle that started all of this.
 *
 * ── What it cannot supply ────────────────────────────────────────────────────
 *
 * No market capitalisation: reported as 0, which the formatter renders as an
 * em dash rather than "$0B".
 *
 * No previous close, so the session move is unknown rather than zero. It is
 * reported as null and rendered as an em dash. This corrects itself: once a
 * real quote from an earlier session is stored on disk, that price *is* the
 * previous close, and lib/market fills the move in without asking anyone.
 */

const QUOTES = "https://stooq.com/q/l/";
const HISTORY = "https://stooq.com/q/d/l/";

const TIMEOUT_MS = 8_000;

/** One request for fifty names. The whole universe is four. */
const BATCH = 50;

const HEADERS: Record<string, string> = {
  Accept: "text/csv,text/plain,*/*",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
};

let lastError: string | null = null;
export function stooqLastError(): string | null {
  return lastError;
}

/**
 * Stooq names US listings `nvda.us`, and writes a class suffix with a hyphen
 * where the ticker uses a dot.
 */
export function stooqSymbol(ticker: string): string {
  return `${ticker.toLowerCase().replace(/\./g, "-")}.us`;
}

function num(v: string | undefined): number | null {
  if (!v) return null;
  // Stooq writes N/D for a name it does not carry. Number("N/D") is NaN, but
  // Number("") is 0 — which would land on the page as a price.
  const n = Number(v.trim());
  return Number.isFinite(n) && v.trim() !== "" ? n : null;
}

/** Header row to column index, so a reordered response does not shift fields. */
export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const head = lines[0].split(",").map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    const row: Record<string, string> = {};
    head.forEach((h, i) => (row[h] = (cells[i] ?? "").trim()));
    return row;
  });
}

async function csv(url: string): Promise<Record<string, string>[] | null> {
  const res = await httpGet(url, { headers: HEADERS, timeoutMs: TIMEOUT_MS });
  if (res.status !== 200) {
    lastError = `HTTP ${res.status}${res.error ? ` (${res.error})` : ""}`;
    return null;
  }
  // A bot check answers 200 with HTML. That is not a refusal to retry, it is
  // a refusal to serve, and parsing it as CSV would yield confident nonsense.
  if (/^\s*</.test(res.body)) {
    lastError = "answered with a page, not CSV";
    return null;
  }
  const rows = parseCsv(res.body);
  if (!rows.length) {
    lastError = "empty response";
    return null;
  }
  return rows;
}

export function stooqProvider(): MarketProvider {
  return {
    name: "stooq",
    live: true,

    async quotes(tickers) {
      const out = new Map<string, Quote>();

      for (let i = 0; i < tickers.length; i += BATCH) {
        const slice = tickers.slice(i, i + BATCH);
        // Stooq separates symbols with a space, which a query string writes
        // as a plus. Encoding it as %2B asks for a literal plus and returns
        // nothing.
        const symbols = slice.map(stooqSymbol).join("+");
        const rows = await csv(`${QUOTES}?s=${symbols}&f=sd2t2ohlcv&h&e=csv`);
        if (!rows) return out;

        for (const row of rows) {
          const raw = row.symbol ?? "";
          const price = num(row.close);
          if (!raw || price === null || price <= 0) continue;

          const ticker = raw.replace(/\.us$/i, "").replace(/-/g, ".").toUpperCase();
          const open = num(row.open);
          const stamp = row.date && row.time ? `${row.date}T${row.time}Z` : null;
          const asOf = stamp && !Number.isNaN(Date.parse(stamp)) ? new Date(stamp).toISOString() : new Date().toISOString();

          out.set(ticker, {
            ticker,
            price,
            // Unknown, not zero. lib/market fills this in from the previous
            // session once one has been stored.
            changePct: null,
            marketCap: 0,
            previousClose: 0,
            open: open ?? 0,
            asOf,
            synthetic: false,
          });
        }
        lastError = null;
      }
      return out;
    },

    async history(ticker, from) {
      const d1 = from.replace(/-/g, "");
      const d2 = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const rows = await csv(
        `${HISTORY}?s=${stooqSymbol(ticker)}&d1=${d1}&d2=${d2}&i=d`
      );
      if (!rows) return [];

      const bars: Bar[] = [];
      for (const row of rows) {
        const close = num(row.close);
        if (!row.date || close === null || close <= 0) continue;
        bars.push({ date: row.date, close });
      }
      bars.sort((a, b) => a.date.localeCompare(b.date));
      return bars;
    },
  };
}

/** One live, uncached request, for /api/market-probe. */
export async function stooqProbe(): Promise<{ status: number; ok: boolean; detail: string }> {
  const res = await httpGet(`${QUOTES}?s=spy.us&f=sd2t2ohlcv&h&e=csv`, {
    headers: HEADERS,
    timeoutMs: TIMEOUT_MS,
  });
  if (res.status !== 200) {
    return { status: res.status, ok: false, detail: res.error ?? "refused" };
  }
  if (/^\s*</.test(res.body)) {
    return { status: 200, ok: false, detail: "answered with a page, not CSV" };
  }
  const close = parseCsv(res.body)[0]?.close;
  const price = Number(close);
  return Number.isFinite(price) && close?.trim()
    ? { status: 200, ok: true, detail: `SPY ${price}` }
    : { status: 200, ok: false, detail: res.body.slice(0, 80) };
}
