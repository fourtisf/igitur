import { cookieHeader, httpGet } from "./http";
import type { Bar, MarketProvider, Quote } from "./types";

/**
 * Yahoo Finance, through the endpoints its own site calls.
 *
 * Chosen because it needs no key, no account and no signup — which for this
 * deployment was the entire obstacle. It is not a documented, supported API:
 * Yahoo can change or restrict it without notice and no agreement obliges them
 * not to. FMP is the sturdier path if this site ever needs a supplier it can
 * hold to something; set MARKET_API_KEY and that provider takes over.
 *
 * The failure mode is the same either way: any ticker this cannot price falls
 * back to its generated figure, flagged as generated, and /status names the
 * reason.
 *
 * ── Two requests, not 163 ────────────────────────────────────────────────────
 *
 * The first version of this file asked the chart endpoint once per ticker. On
 * /universe that is 163 requests leaving together, and again on /trending, and
 * again for every prerender during `next build`. Yahoo throttled it, as any
 * vendor would, and the site sat on generated figures while `curl` from the
 * same server returned real JSON on the first try. Volume was the fault, not
 * the headers.
 *
 * So quotes now go through the batch endpoint, which prices fifty names in one
 * request. It costs a session — a cookie and a crumb, obtained once and reused
 * for half an hour — and it is worth it: the whole universe is four requests,
 * and the response carries market capitalisation, which the chart endpoint does
 * not. The per-ticker chart path is kept as the fallback for whatever the batch
 * misses, so a broken session degrades to slow rather than to fiction.
 */

const HOSTS = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"] as const;

const TIMEOUT_MS = 8_000;

/**
 * Yahoo answers a bare request with 403, so it gets a browser's headers —
 * minus the ones that would be a lie about the transport. The previous version
 * said that and then sent `Origin: https://finance.yahoo.com` anyway. There is
 * no origin: this is a server, not a page, and an Origin header with no
 * preflight behind it is one of the cheaper things a bot filter looks for.
 *
 * This is the shape that was confirmed working from the deployment server
 * before any of this was written: a browser User-Agent, and nothing claimed
 * about where the request came from.
 */
const HEADERS: Record<string, string> = {
  Accept: "application/json,text/plain,*/*",
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
};

/** The batch endpoint's limit is undocumented. Fifty is well inside it. */
const BATCH = 50;

/** Only the fallback path fans out, and then politely. */
const CONCURRENCY = 4;

/** A session outlives a page render but not a market session. */
const SESSION_TTL_MS = 30 * 60_000;

// ── Diagnosis ────────────────────────────────────────────────────────────────

let lastError: string | null = null;
export function yahooLastError(): string | null {
  return lastError;
}

// ── Believing a refusal ──────────────────────────────────────────────────────

/**
 * A 429 is the endpoint saying stop. Asking again immediately is how a short
 * throttle becomes a long one, and this deployment earned exactly that: the
 * first version asked once per ticker, so a single failed batch turned into
 * 163 more requests, on every prerender, on every deploy. `curl` from the same
 * server still worked; the site had simply made itself unwelcome.
 *
 * So a refusal is honoured for as long as it asks, or a quarter of an hour.
 */
const COOL_OFF_MS = 15 * 60_000;
let refuseUntil = 0;

export function yahooHoldingOff(): string | null {
  return Date.now() < refuseUntil ? new Date(refuseUntil).toISOString() : null;
}

/** Exported for tests, and for the probe, which must be able to look anyway. */
export function clearYahooCoolOff(): void {
  refuseUntil = 0;
}

/**
 * The probe is a diagnostic, capped at one run a minute, and its job is to
 * find out whether a refusal has lifted. If its own requests extended the
 * cool-off, every check would push recovery further away — a thermometer that
 * raises the temperature.
 */
let probing = false;

function noteRefusal(status: number, retryAfter: string | null): void {
  if (probing) return;
  if (status !== 429 && status !== 403) return;
  const secs = Number(retryAfter);
  const wait = Number.isFinite(secs) && secs > 0 ? Math.min(secs, 3600) * 1000 : COOL_OFF_MS;
  refuseUntil = Math.max(refuseUntil, Date.now() + wait);
}

// ── Session ──────────────────────────────────────────────────────────────────

interface Session {
  cookie: string;
  crumb: string;
  at: number;
}
let session: Session | null = null;
/** Exported for tests, and for the probe route, which must not read a cache. */
export function forgetYahooSession(): void {
  session = null;
}

async function openSession(): Promise<Session | null> {
  // Either host will hand out a cookie; the consent redirect is followed for us.
  for (const seed of ["https://fc.yahoo.com/", "https://finance.yahoo.com/"]) {
    const res = await httpGet(seed, { headers: HEADERS, timeoutMs: TIMEOUT_MS });
    const cookie = cookieHeader(res.cookies);
    // fc.yahoo.com answers 404 and sets the cookie anyway. The status is not
    // the thing being asked for.
    if (!cookie) continue;

    for (const host of HOSTS) {
      const crumbRes = await httpGet(`https://${host}/v1/test/getcrumb`, {
        headers: HEADERS,
        cookie,
        timeoutMs: TIMEOUT_MS,
      });
      const crumb = crumbRes.body.trim();
      // A crumb is a short opaque token. An HTML error page is not one.
      if (crumbRes.status === 200 && crumb && crumb.length < 40 && !crumb.includes("<")) {
        return { cookie, crumb, at: Date.now() };
      }
      lastError = `crumb: HTTP ${crumbRes.status}${crumbRes.error ? ` (${crumbRes.error})` : ""}`;
    }
  }
  return null;
}

async function getSession(): Promise<Session | null> {
  if (session && Date.now() - session.at < SESSION_TTL_MS) return session;
  session = await openSession();
  return session;
}

// ── Parsing ──────────────────────────────────────────────────────────────────

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

interface V7Row {
  symbol?: string;
  regularMarketPrice?: number;
  regularMarketChangePercent?: number;
  regularMarketPreviousClose?: number;
  regularMarketOpen?: number;
  regularMarketTime?: number;
  marketCap?: number;
}

interface Meta {
  regularMarketPrice?: number;
  chartPreviousClose?: number;
  previousClose?: number;
  regularMarketTime?: number;
}
interface ChartResult {
  meta?: Meta;
  timestamp?: number[];
  indicators?: { quote?: { open?: (number | null)[]; close?: (number | null)[] }[] };
}

function parseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/** Builds a quote from a batch row, or null when the row has no price. */
export function quoteFromV7(row: V7Row): Quote | null {
  const ticker = typeof row.symbol === "string" ? row.symbol.toUpperCase() : null;
  const price = num(row.regularMarketPrice);
  // Without a price there is no quote. Returning nothing lets the caller fall
  // back for this one ticker rather than putting a zero on the page.
  if (!ticker || price === null || price <= 0) return null;

  const prev = num(row.regularMarketPreviousClose) ?? price;
  const changePct =
    num(row.regularMarketChangePercent) ??
    (prev ? ((price - prev) / prev) * 100 : 0);

  return {
    ticker,
    price,
    changePct: Math.round(changePct * 100) / 100,
    // Yahoo reports market cap in units; the site works in billions.
    marketCap: (num(row.marketCap) ?? 0) / 1e9,
    previousClose: prev,
    open: num(row.regularMarketOpen) ?? prev,
    asOf: row.regularMarketTime
      ? new Date(row.regularMarketTime * 1000).toISOString()
      : new Date().toISOString(),
    synthetic: false,
  };
}

/** Builds a quote from a chart response. Market cap is not in it. */
export function quoteFromChart(ticker: string, r: ChartResult): Quote | null {
  const m = r.meta;
  const price = num(m?.regularMarketPrice);
  if (!m || price === null || price <= 0) return null;

  // Yahoo has used both names across versions of this response.
  const prev = num(m.chartPreviousClose) ?? num(m.previousClose) ?? price;
  // The open is not in meta; take it from the last daily bar.
  const opens = r.indicators?.quote?.[0]?.open ?? [];
  const open = num(opens[opens.length - 1]) ?? prev;

  return {
    ticker: ticker.toUpperCase(),
    price,
    changePct: prev ? Math.round(((price - prev) / prev) * 10_000) / 100 : 0,
    // Not in this response. Zero renders as an em dash — an absent figure shown
    // as absent, rather than as $0B.
    marketCap: 0,
    previousClose: prev,
    open,
    asOf: m.regularMarketTime
      ? new Date(m.regularMarketTime * 1000).toISOString()
      : new Date().toISOString(),
    synthetic: false,
  };
}

// ── Requests ─────────────────────────────────────────────────────────────────

/** Tries each host in turn; a host that refuses is not the endpoint failing. */
async function getAcrossHosts(
  path: string,
  cookie?: string
): Promise<{ status: number; body: string; error: string | null }> {
  let last = { status: 0, body: "", error: "no attempt" as string | null };
  for (const host of HOSTS) {
    const res = await httpGet(`https://${host}${path}`, {
      headers: HEADERS,
      cookie,
      timeoutMs: TIMEOUT_MS,
    });
    if (res.status === 200) return res;
    noteRefusal(res.status, res.retryAfter);
    last = { status: res.status, body: res.body, error: res.error };
    // 404 is an answer: the symbol does not exist. Asking the other host is
    // just another request for the same no. A refusal is an answer too, and
    // both hosts share the backend that issued it.
    if (res.status === 404 || res.status === 429 || res.status === 403) break;
  }
  return last;
}

async function chart(symbol: string, query: string): Promise<ChartResult | null> {
  const res = await getAcrossHosts(
    `/v8/finance/chart/${encodeURIComponent(symbol)}?${query}`
  );
  if (res.status !== 200) {
    // 403: refused. 429: throttled. 0: never completed.
    lastError = `chart ${symbol}: HTTP ${res.status}${res.error ? ` (${res.error})` : ""}`;
    return null;
  }
  const body = parseJson<{ chart?: { result?: ChartResult[]; error?: { description?: string } } }>(
    res.body
  );
  const r = body?.chart?.result?.[0];
  if (!r) {
    lastError = body?.chart?.error?.description ?? `chart ${symbol}: no data`;
    return null;
  }
  return r;
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

async function batchQuotes(tickers: string[], into: Map<string, Quote>): Promise<boolean> {
  const s = await getSession();
  if (!s) {
    lastError = lastError ?? "no session: Yahoo did not hand out a cookie";
    return false;
  }

  let answered = false;

  for (let i = 0; i < tickers.length; i += BATCH) {
    const slice = tickers.slice(i, i + BATCH);
    const path =
      `/v7/finance/quote?symbols=${slice.map(encodeURIComponent).join(",")}` +
      `&crumb=${encodeURIComponent(s.crumb)}`;
    const res = await getAcrossHosts(path, s.cookie);

    if (res.status !== 200) {
      // 401 means the crumb went stale. Drop it so the next render re-earns
      // one instead of repeating a request that cannot now succeed.
      if (res.status === 401 || res.status === 403) session = null;
      lastError = `batch: HTTP ${res.status}${res.error ? ` (${res.error})` : ""}`;
      return answered;
    }

    const body = parseJson<{ quoteResponse?: { result?: V7Row[] } }>(res.body);
    const rows = body?.quoteResponse?.result;
    if (!Array.isArray(rows)) {
      lastError = "batch: unexpected response shape";
      return answered;
    }
    answered = true;
    for (const row of rows) {
      const q = quoteFromV7(row);
      if (q) into.set(q.ticker, q);
    }
    lastError = null;
  }
  return answered;
}

export function yahooProvider(): MarketProvider {
  return {
    name: "yahoo",
    live: true,

    async quotes(tickers) {
      const out = new Map<string, Quote>();
      const holding = yahooHoldingOff();
      if (holding) {
        // Every figure falls back to a generated one, flagged as generated,
        // and /status says why. That is the honest shape of being throttled.
        lastError = `holding off after a refusal until ${holding}`;
        return out;
      }

      const answered = await batchQuotes(tickers, out);

      const missing = tickers.filter((t) => !out.has(t.toUpperCase()));
      if (!missing.length) {
        lastError = null;
        return out;
      }

      // The per-ticker path is for coverage gaps, not for outages. Ask about
      // one name first: if the endpoint refuses, 162 more requests will not
      // change its mind — and that fan-out is what kept the refusal alive
      // last time. When the batch answered, this is a handful of names and
      // the canary is one of them rather than an extra request.
      const [canary, ...rest] = missing;
      const first = await chart(canary, "range=5d&interval=1d");
      if (!first) return out;
      const q = quoteFromChart(canary, first);
      if (q) out.set(q.ticker, q);

      // Without a session the batch never ran, so this is the whole universe
      // one at a time. It is slow and it is true, and the canary has already
      // shown the endpoint is willing.
      if (rest.length) {
        const results = await pool(rest, (t) => chart(t, "range=5d&interval=1d"));
        results.forEach((r, i) => {
          if (!r) return;
          const each = quoteFromChart(rest[i], r);
          if (each) out.set(each.ticker, each);
        });
      }

      if (out.size) lastError = null;
      else if (answered) lastError = lastError ?? "the batch answered but priced nothing";
      return out;
    },

    async history(ticker, from) {
      if (yahooHoldingOff()) return [];
      const p1 = Math.floor(Date.parse(from + "T00:00:00Z") / 1000);
      if (!Number.isFinite(p1)) return [];
      const p2 = Math.floor(Date.now() / 1000);
      const r = await chart(ticker, `period1=${p1}&period2=${p2}&interval=1d`);

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

// ── Probe ────────────────────────────────────────────────────────────────────

export interface ProbeStep {
  step: string;
  status: number;
  ok: boolean;
  detail: string;
}

/**
 * Walks the same path a render walks, uncached, and reports what each step
 * actually returned. /api/market-probe serves this, so "the source is not
 * answering" can be turned into a reason without shell access to the server.
 */
export async function yahooProbe(): Promise<ProbeStep[]> {
  const steps: ProbeStep[] = [];
  probing = true;
  try {
    return await probeSteps(steps);
  } finally {
    probing = false;
  }
}

async function probeSteps(steps: ProbeStep[]): Promise<ProbeStep[]> {

  const seed = await httpGet("https://fc.yahoo.com/", { headers: HEADERS, timeoutMs: TIMEOUT_MS });
  const cookie = cookieHeader(seed.cookies);
  steps.push({
    step: "cookie",
    status: seed.status,
    ok: Boolean(cookie),
    detail: cookie ? `${seed.cookies.length} cookie(s)` : (seed.error ?? "no Set-Cookie"),
  });

  let crumb = "";
  if (cookie) {
    const c = await httpGet(`https://${HOSTS[0]}/v1/test/getcrumb`, {
      headers: HEADERS,
      cookie,
      timeoutMs: TIMEOUT_MS,
    });
    crumb = c.body.trim();
    steps.push({
      step: "crumb",
      status: c.status,
      ok: c.status === 200 && crumb.length > 0 && crumb.length < 40,
      detail: c.status === 200 ? `${crumb.length} chars` : (c.error ?? c.body.slice(0, 80)),
    });
  }

  if (crumb) {
    const b = await getAcrossHosts(
      `/v7/finance/quote?symbols=SPY&crumb=${encodeURIComponent(crumb)}`,
      cookie
    );
    const row = parseJson<{ quoteResponse?: { result?: V7Row[] } }>(b.body)?.quoteResponse
      ?.result?.[0];
    steps.push({
      step: "batch SPY",
      status: b.status,
      ok: Boolean(row?.regularMarketPrice),
      detail: row?.regularMarketPrice
        ? `SPY ${row.regularMarketPrice}`
        : (b.error ?? b.body.slice(0, 80)),
    });
  }

  const ch = await getAcrossHosts("/v8/finance/chart/SPY?range=5d&interval=1d");
  const meta = parseJson<{ chart?: { result?: ChartResult[] } }>(ch.body)?.chart?.result?.[0]?.meta;
  steps.push({
    step: "chart SPY",
    status: ch.status,
    ok: Boolean(meta?.regularMarketPrice),
    detail: meta?.regularMarketPrice
      ? `SPY ${meta.regularMarketPrice}`
      : (ch.error ?? ch.body.slice(0, 80)),
  });

  return steps;
}
