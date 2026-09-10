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

/**
 * Both fronts for the same data. The .com host answered this deployment with
 * 404 — not a bot check, which returns a page, but a plain "no such thing" —
 * so the .pl one is tried after it rather than assuming the first is the only
 * address the service has.
 */
const HOSTS = ["https://stooq.com", "https://stooq.pl"] as const;
const QUOTES = "/q/l/";
const HISTORY = "/q/d/l/";

const TIMEOUT_MS = 8_000;

/** One request for fifty names. The whole universe is four. */
const BATCH = 50;

const HEADERS: Record<string, string> = {
  // A browser downloading this file sends */*; a narrower Accept is one more
  // way to look like a script to something that would rather serve people.
  Accept: "*/*",
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

/**
 * Fetches a CSV, trying each host in turn.
 *
 * Returns the rows and the status that produced them, so /api/market-probe can
 * report what actually came back instead of a bare failure — the difference
 * between 404, a throttle and a bot check is the whole diagnosis, and guessing
 * at it has already cost this deployment several rounds.
 */
async function csv(
  path: string
): Promise<{ rows: Record<string, string>[] | null; status: number; why: string }> {
  let last = { rows: null as Record<string, string>[] | null, status: 0, why: "no attempt" };

  for (const host of HOSTS) {
    const res = await httpGet(`${host}${path}`, { headers: HEADERS, timeoutMs: TIMEOUT_MS });
    if (res.status !== 200) {
      last = { rows: null, status: res.status, why: res.error ?? `HTTP ${res.status}` };
      continue;
    }
    // A bot check answers 200 with HTML. That is not a refusal to retry, it is
    // a refusal to serve, and parsing it as CSV would yield confident nonsense.
    if (/^\s*</.test(res.body)) {
      last = { rows: null, status: 200, why: "answered with a page, not CSV" };
      continue;
    }
    const rows = parseCsv(res.body);
    if (!rows.length) {
      last = { rows: null, status: 200, why: "empty response" };
      continue;
    }
    lastError = null;
    return { rows, status: 200, why: "" };
  }

  lastError = last.why;
  return last;
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
        const { rows } = await csv(`${QUOTES}?s=${symbols}&f=sd2t2ohlcv&h&e=csv`);
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
      const { rows } = await csv(`${HISTORY}?s=${stooqSymbol(ticker)}&d1=${d1}&d2=${d2}&i=d`);
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
  const { rows, status, why } = await csv(`${QUOTES}?s=spy.us&f=sd2t2ohlcv&h&e=csv`);
  const close = rows?.[0]?.close;
  const price = Number(close);
  if (rows && close?.trim() && Number.isFinite(price)) {
    return { status, ok: true, detail: `SPY ${price}` };
  }
  // Both hosts, named, because "it failed" has already cost several rounds of
  // guessing at which part failed.
  return { status, ok: false, detail: `${why} (tried ${HOSTS.length} hosts)` };
}
