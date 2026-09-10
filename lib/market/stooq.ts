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
 * Two sources that fail together are one source, so this was added as a third:
 * a different company, a different network, a different rate limit, and no key
 * at all — the obstacle that started all of this.
 *
 * ── What it actually answered ────────────────────────────────────────────────
 *
 * "This site requires JavaScript to verify your browser. Please enable
 * JavaScript and reload." Read from the deployment server itself, which settles
 * it: a server does not run JavaScript, so this door does not open, and no
 * change to headers or addresses on this side will change that. The 404 from
 * the light-quote path was a wrong address on top of a wall.
 *
 * It stays in the chain because it costs nothing behind a working source — the
 * circuit breaker in ./fallback.ts sets it aside after three empty rounds — and
 * because a wall is not permanent by nature. But nothing here should be relied
 * on to serve this deployment, and the honest source is ./twelvedata.ts.
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

/**
 * Two shapes for the same answer, because the first one is the guess.
 *
 * The light-quote path returned 404 from this deployment — not a bot check,
 * which answers 200 with a page, but a plain "no such thing", meaning the
 * address was wrong. The daily download at /q/d/l/ is the one this file is
 * confident about: it is the endpoint long-standing tools read Stooq through,
 * and its shape has not moved in years.
 *
 * It costs a request per ticker instead of one per fifty, which is why it is
 * the fallback rather than the first choice. It also answers a question the
 * light path cannot: two rows of daily closes give a real previous close, so
 * the session move is a figure rather than a dash.
 */
const CANARY_ONLY_ON_REFUSAL = true;

/** Enough rows to hold a previous close across a long weekend. */
const DAILY_LOOKBACK_DAYS = 12;

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

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

/**
 * A quote from the daily download: the last row is today, the row before it is
 * the previous close. Both are real closes, so unlike the light-quote path this
 * yields a session move rather than an unknown.
 */
async function dailyQuote(ticker: string): Promise<Quote | null> {
  const to = new Date();
  const from = new Date(to.getTime() - DAILY_LOOKBACK_DAYS * 86_400_000);
  const { rows } = await csv(
    `${HISTORY}?s=${stooqSymbol(ticker)}&d1=${ymd(from)}&d2=${ymd(to)}&i=d`
  );
  if (!rows) return null;

  const bars = rows
    .map((r) => ({ date: r.date ?? "", close: num(r.close), open: num(r.open) }))
    .filter((b) => b.date && b.close !== null && b.close > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!bars.length) return null;

  const last = bars[bars.length - 1];
  const prev = bars.length > 1 ? bars[bars.length - 2].close : null;
  const price = last.close!;

  return {
    ticker: ticker.toUpperCase(),
    price,
    // A real move when there are two real closes, and unknown otherwise —
    // never a calm zero standing in for a figure nobody has.
    changePct: prev ? Math.round(((price - prev) / prev) * 10_000) / 100 : null,
    marketCap: 0,
    previousClose: prev ?? 0,
    open: last.open ?? 0,
    asOf: new Date(last.date + "T00:00:00Z").toISOString(),
    synthetic: false,
  };
}

export function stooqProvider(): MarketProvider {
  return {
    name: "stooq",
    live: true,

    async quotes(tickers) {
      const out = new Map<string, Quote>();

      // The cheap shape first: fifty names in one request, when it answers.
      for (let i = 0; i < tickers.length; i += BATCH) {
        const slice = tickers.slice(i, i + BATCH);
        // Stooq separates symbols with a space, which a query string writes as
        // a plus. Encoding it as %2B asks for a literal plus and returns
        // nothing.
        const symbols = slice.map(stooqSymbol).join("+");
        const { rows } = await csv(`${QUOTES}?s=${symbols}&f=sd2t2ohlcv&h&e=csv`);
        if (!rows) break;

        for (const row of rows) {
          const raw = row.symbol ?? "";
          const price = num(row.close);
          if (!raw || price === null || price <= 0) continue;

          const ticker = raw.replace(/\.us$/i, "").replace(/-/g, ".").toUpperCase();
          const stamp = row.date && row.time ? `${row.date}T${row.time}Z` : null;
          out.set(ticker, {
            ticker,
            price,
            // Unknown, not zero. lib/market fills this in from the previous
            // session once one has been stored.
            changePct: null,
            marketCap: 0,
            previousClose: 0,
            open: num(row.open) ?? 0,
            asOf:
              stamp && !Number.isNaN(Date.parse(stamp))
                ? new Date(stamp).toISOString()
                : new Date().toISOString(),
            synthetic: false,
          });
        }
      }

      const missing = tickers.filter((t) => !out.has(t.toUpperCase()));
      if (!missing.length) return out;

      // One name first. If the daily path refuses that, 162 more requests will
      // not change its mind — the lesson Yahoo taught this deployment at the
      // cost of a day.
      const [canary, ...rest] = missing;
      const first = await dailyQuote(canary);
      if (!first) return out;
      out.set(first.ticker, first);

      if (CANARY_ONLY_ON_REFUSAL && rest.length) {
        const results = await pool(rest, (t) => dailyQuote(t));
        for (const q of results) if (q) out.set(q.ticker, q);
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

/** Run `work` over `items`, a few at a time. Stooq has no published limit. */
async function pool<T, R>(items: T[], work: (t: T) => Promise<R>): Promise<R[]> {
  const CONCURRENCY = 4;
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

/**
 * Both shapes, live and uncached, for /api/market-probe.
 *
 * Reported separately because they fail for different reasons and the
 * difference is the diagnosis: the light path returning 404 while the daily
 * path answers means the address was wrong, not that Stooq refuses this server.
 */
export async function stooqProbe(): Promise<
  { step: string; status: number; ok: boolean; detail: string }[]
> {
  const light = await csv(`${QUOTES}?s=spy.us&f=sd2t2ohlcv&h&e=csv`);
  const lightClose = Number(light.rows?.[0]?.close);
  const steps = [
    {
      step: "stooq quote",
      status: light.status,
      ok: Boolean(light.rows && Number.isFinite(lightClose) && lightClose > 0),
      detail:
        light.rows && Number.isFinite(lightClose) ? `SPY ${lightClose}` : light.why || "no rows",
    },
  ];

  const daily = await dailyQuote("SPY");
  steps.push({
    step: "stooq daily",
    status: daily ? 200 : 0,
    ok: Boolean(daily),
    detail: daily ? `SPY ${daily.price}` : lastError || "no rows",
  });

  return steps;
}
