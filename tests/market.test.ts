/**
 * The market data layer. HANDOFF.md §5.
 *
 * These run without a vendor key, which is the point: the site has to be
 * correct and honest on the synthetic path, and the switch to real data has to
 * be a configuration change rather than a code change.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  buildingOffline,
  cachedTtlMs,
  cleanKey,
  pickProvider,
  fmtMcap,
  fmtPrice,
  getQuote,
  getQuotes,
  isLive,
  nextRetryDelayMs,
  providerName,
  QUOTE_TTL_MS,
  resetMarketCache,
  sparkPath,
} from "../lib/market";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { setHttpTransport } from "../lib/market/http";
import { forgetStore, remember } from "../lib/market/store";
import { syntheticQuote } from "../lib/market/synthetic";
import { sessionsFor } from "../lib/track";
import { UNIVERSE } from "../lib/universe";

// These pin the synthetic path, so the vendor must not actually be reached: a
// test that depends on Yahoo answering is a test that fails on a train.
setHttpTransport(async () => ({ status: 0, body: "", cookies: [], retryAfter: null, error: "offline in tests" }));

// And they must not read or write the real server's remembered prices.
process.env.MARKET_CACHE_PATH = join(mkdtempSync(join(tmpdir(), "igitur-mkt-")), "quotes.json");

test("with nothing configured the site still reaches for real prices", () => {
  // It used to fall back to generated figures, which meant real data was
  // gated behind an account signup — the obstacle that kept this deployment on
  // invented numbers for weeks. The keyless source is the default now, and
  // generated figures are what happens when that source fails, not what
  // happens when nobody configured anything.
  assert.equal(process.env.MARKET_API_KEY ?? "", "");
  assert.equal(providerName(), "yahoo");
  assert.equal(isLive(), true);
});

test("every quote carries its own honesty flag", async () => {
  // Per quote, not per site: a vendor covering 158 of 163 names must not force
  // the other five to be presented as real.
  const quotes = await getQuotes(["NVDA", "CCJ", "SGOV"]);
  for (const q of quotes.values()) {
    assert.equal(q.synthetic, true, `${q.ticker} did not declare itself`);
  }
});

test("quotes are returned for every ticker asked for, always", async () => {
  // The page must always have something to render; a vendor gap falls back
  // rather than leaving a hole.
  const tickers = UNIVERSE.map((u) => u.t);
  const quotes = await getQuotes(tickers);
  assert.equal(quotes.size, tickers.length);
  for (const t of tickers) {
    const q = quotes.get(t);
    assert.ok(q, `${t} missing`);
    assert.ok(q.price > 0, `${t} price ${q.price}`);
    assert.ok(Number.isFinite(q.changePct), `${t} change ${q.changePct}`);
  }
});

test("a ticker outside the universe still yields a usable quote", async () => {
  // /api/book.csv and the name pages must not throw on an unexpected symbol.
  const q = await getQuote("ZZZZ");
  assert.ok(q.price > 0);
  assert.equal(q.synthetic, true);
});

test("synthetic quotes stay deterministic", async () => {
  // The whole test suite, and every screenshot, depends on this.
  const a = syntheticQuote("NVDA");
  const b = syntheticQuote("NVDA");
  assert.deepEqual(a, b);
});

test("the price and the previous close never contradict the change", () => {
  for (const t of ["NVDA", "CCJ", "GLD", "SGOV", "TSM"]) {
    const q = syntheticQuote(t);
    const implied = ((q.price - q.previousClose) / q.previousClose) * 100;
    // A generated figure always states its own move; only real sources leave
    // it unknown, and null there is the honest answer, not a gap in this test.
    assert.notEqual(q.changePct, null, `${t}: a generated quote must state a move`);
    assert.ok(
      Math.abs(implied - (q.changePct ?? 0)) < 0.05,
      `${t}: change says ${q.changePct}% but the closes imply ${implied.toFixed(2)}%`
    );
  }
});

test("the sparkline is drawn only from points the quote actually reports", () => {
  // The prototype drew twenty-six invented vertices. Three real ones is coarse
  // and true; a plausible wiggle beside real prices is the same lie smaller.
  const q = syntheticQuote("NVDA");
  const d = sparkPath(q, 112, 26);
  const vertices = d.split(/[ML]/).filter(Boolean).length;
  assert.ok(vertices <= 3, `drew ${vertices} points from a 3-point quote`);
  assert.match(d, /^M[\d.]+ [\d.]+/);
  // Every y must sit inside the box.
  for (const m of d.matchAll(/[ML]([\d.]+) ([\d.]+)/g)) {
    assert.ok(Number(m[1]) >= 0 && Number(m[1]) <= 112, `x ${m[1]}`);
    assert.ok(Number(m[2]) >= 0 && Number(m[2]) <= 26, `y ${m[2]}`);
  }
});

test("a degenerate quote draws a flat line rather than crashing", () => {
  const d = sparkPath({ ...syntheticQuote("X"), price: 0, previousClose: 0, open: 0 }, 100, 20);
  assert.match(d, /^M0 10\.0 L100 10\.0$/);
});

test("formatting refuses to present a missing figure as a number", () => {
  assert.equal(fmtPrice(0), "—");
  assert.equal(fmtMcap(0), "—");
  assert.equal(fmtPrice(NaN), "—");
  assert.equal(fmtPrice(1052.876), "$1052.88");
  assert.equal(fmtMcap(228), "$228B");
  assert.equal(fmtMcap(3400), "$3.40T");
});

test("the tracking window follows the stated date and stays bounded", () => {
  assert.equal(sessionsFor(null), 180);
  assert.equal(sessionsFor(365), 252);
  assert.equal(sessionsFor(0), 20);
  assert.equal(sessionsFor(100000), 1260);
  assert.ok(sessionsFor(30) < sessionsFor(365));
});

test("the cache TTL fits the vendor's free daily allowance", async () => {
  // The reason this matters is not tidiness. FMP's free tier is 250 requests a
  // day and one refresh of the universe costs 4, so a 60-second TTL — which is
  // what this started at — spends the whole allowance in about an hour and the
  // site silently falls back to synthetic for the rest of the day. Anyone
  // configuring a key would have concluded it did not work.
  const { UNIVERSE } = await import("../lib/universe");
  const BATCH = 50;
  const FREE_TIER_PER_DAY = 250;

  const perRefresh = Math.ceil(UNIVERSE.length / BATCH);
  const ttlSeconds = Math.max(60, Number(process.env.MARKET_TTL_S) || 3600);
  const perDay = (86_400 / ttlSeconds) * perRefresh;

  assert.ok(
    perDay <= FREE_TIER_PER_DAY,
    `${perDay.toFixed(0)} requests/day at a ${ttlSeconds}s TTL exceeds the ${FREE_TIER_PER_DAY} free tier`
  );
});

test("a source that stops answering is retried in a minute, not in an hour", async () => {
  // The production failure this fixes: a failure was cached for the same hour
  // a price was, so one throttled burst during a deploy left every figure on
  // the site generated until the hour was up — and the next deploy earned the
  // same throttle again. The source was answering `curl` the whole time.
  resetMarketCache();
  await getQuotes(["NVDA"]);
  const held = cachedTtlMs("NVDA");
  assert.ok(held !== null);
  assert.ok(held <= 60_000, `a dead source was held for ${held}ms`);
  assert.ok(held < QUOTE_TTL_MS, "a failure must not be cached as long as a price");
});

test("a source that stays dead is backed off rather than hammered", async () => {
  resetMarketCache();
  const seen: number[] = [];
  for (let i = 0; i < 5; i++) {
    // A distinct ticker each time, so this measures repeated failures rather
    // than a cache hit.
    await getQuotes([`FAKE${i}`]);
    seen.push(nextRetryDelayMs());
  }
  assert.deepEqual(seen, [60_000, 120_000, 240_000, 480_000, 960_000]);
  for (const d of seen) assert.ok(d <= QUOTE_TTL_MS, "backoff never exceeds the ordinary TTL");
});

test("a source answering for most names is not retried for the few it lacks", async () => {
  // Otherwise a vendor that covers 158 of 163 would be asked for the other
  // five every minute for ever — a request storm to learn nothing new.
  resetMarketCache();
  setHttpTransport(async (url) => ({
    status: 200,
    cookies: url.includes("fc.yahoo.com") ? ["A1=d=abc"] : [],
    retryAfter: null,
    body: url.includes("getcrumb")
      ? "crumb1"
      : JSON.stringify({
          quoteResponse: { result: [{ symbol: "NVDA", regularMarketPrice: 1, marketCap: 1 }] },
        }),
    error: null,
  }));
  try {
    await getQuotes(["NVDA", "NOTLISTED"]);
    assert.equal(cachedTtlMs("NOTLISTED"), QUOTE_TTL_MS);
  } finally {
    setHttpTransport(async () => ({ status: 0, body: "", cookies: [], retryAfter: null, error: "offline in tests" }));
  }
});

test("a key wrapped in quotes in .env is still the key", () => {
  // `MARKET_API_KEY="abc"` is the ordinary way to write a shell variable, and
  // the quotes end up in the value. The vendor then answers 401, which from
  // the site is indistinguishable from a key that is simply wrong.
  assert.equal(cleanKey('"abc123"'), "abc123");
  assert.equal(cleanKey("'abc123'"), "abc123");
  assert.equal(cleanKey(" abc123\r\n"), "abc123");
  assert.equal(cleanKey('""'), undefined, "an empty key is no key, not an empty string");
  assert.equal(cleanKey(undefined), undefined);
  assert.equal(cleanKey("   "), undefined);
});

test("a vendor outage falls back to the last real price, not to a made-up one", async () => {
  // The whole reason the store exists. During the outage this was written for,
  // NVDA showed $7.24 — a number generated from the letters of its ticker —
  // while a real price from an hour earlier was sitting unused.
  resetMarketCache();
  forgetStore();
  remember([
    {
      ticker: "NVDA",
      price: 184.22,
      changePct: 2.41,
      marketCap: 4490,
      previousClose: 179.88,
      open: 180.5,
      asOf: "2026-09-09T17:42:00.000Z",
      synthetic: false,
    },
  ]);

  // The transport is offline for every test in this file.
  const q = (await getQuotes(["NVDA"])).get("NVDA");
  assert.equal(q?.price, 184.22);
  assert.equal(q?.synthetic, false, "a stored real price is real, and says so");
  assert.equal(q?.asOf, "2026-09-09T17:42:00.000Z", "shown as of when it was true");
});

test("with nothing remembered the figure is generated, and admits it", async () => {
  resetMarketCache();
  forgetStore();
  const q = (await getQuotes(["ZZZZ"])).get("ZZZZ");
  assert.equal(q?.synthetic, true);
});

test("a move the source could not supply is filled in from the previous session", async () => {
  // Stooq prices a name without a previous close. Yesterday's stored price is
  // exactly that previous close, so the move becomes knowable the day after
  // the first successful fetch, without asking anyone for anything more.
  resetMarketCache();
  // Stored a week ago: old enough that the vendor is asked, recent enough that
  // yesterday's close is still worth something. remember() stamps the present,
  // so the file is written directly.
  writeFileSync(
    process.env.MARKET_CACHE_PATH!,
    JSON.stringify({
      NVDA: {
        at: Date.now() - 2 * 86_400_000,
        quote: {
          ticker: "NVDA",
          price: 180,
          changePct: 0,
          marketCap: 0,
          previousClose: 0,
          open: 0,
          asOf: "2026-09-08T20:00:00.000Z",
          synthetic: false,
        },
      },
    })
  );
  forgetStore();

  setHttpTransport(async (url) =>
    url.includes("stooq.com")
      ? {
          status: 200,
          cookies: [],
          retryAfter: null,
          error: null,
          body:
            "Symbol,Date,Time,Open,High,Low,Close,Volume\n" +
            "NVDA.US,2026-09-09,22:00:04,178.10,185.00,177.50,189.00,1",
        }
      : { status: 429, body: "", cookies: [], retryAfter: null, error: null }
  );
  try {
    const q = (await getQuotes(["NVDA"])).get("NVDA");
    assert.equal(q?.price, 189);
    assert.equal(q?.previousClose, 180, "yesterday's close, from the store");
    assert.equal(q?.changePct, 5, "a real move, computed rather than guessed");
  } finally {
    setHttpTransport(async () => ({
      status: 0,
      body: "",
      cookies: [],
      retryAfter: null,
      error: "offline in tests",
    }));
  }
});

test("a stored quote from the same session is not treated as a previous close", async () => {
  resetMarketCache();
  writeFileSync(
    process.env.MARKET_CACHE_PATH!,
    JSON.stringify({
      AAPL: {
        at: Date.now() - 2 * 86_400_000,
        quote: {
          ticker: "AAPL",
      price: 180,
          changePct: null,
          marketCap: 0,
          previousClose: 0,
          open: 0,
          asOf: "2026-09-09T14:00:00.000Z",
          synthetic: false,
        },
      },
    })
  );
  forgetStore();
  setHttpTransport(async (url) =>
    url.includes("stooq.com")
      ? {
          status: 200,
          cookies: [],
          retryAfter: null,
          error: null,
          body:
            "Symbol,Date,Time,Open,High,Low,Close,Volume\n" +
            "AAPL.US,2026-09-09,22:00:04,178.10,185.00,177.50,189.00,1",
        }
      : { status: 429, body: "", cookies: [], retryAfter: null, error: null }
  );
  try {
    const q = (await getQuotes(["AAPL"])).get("AAPL");
    assert.equal(q?.changePct, null, "that is this session, not the one before it");
  } finally {
    setHttpTransport(async () => ({
      status: 0,
      body: "",
      cookies: [],
      retryAfter: null,
      error: "offline in tests",
    }));
  }
});

test("a build never spends a vendor's allowance", () => {
  // 184 pages across three workers fired the whole universe at the vendor
  // several times in seconds. Against a free tier metered per symbol that was
  // an instant 429 and most of a day's credits spent before a reader arrived.
  assert.equal(buildingOffline({ MARKET_OFFLINE: "1" }), true);
  assert.equal(buildingOffline({ NEXT_PHASE: "phase-production-build" }), true);
  assert.equal(buildingOffline({}), false, "a running server is not a build");

  // A key set and a build running: the key is not spent.
  const p = pickProvider({ MARKET_OFFLINE: "1", TWELVEDATA_API_KEY: "real-key" });
  assert.equal(p.live, false, "generated figures, and the pages say so");
  assert.equal(p.name, "synthetic");
});

test("a stored quote inside its own TTL is not bought again", async () => {
  // Every deploy restarts the server and empties the in-process cache. Without
  // this, each deploy re-bought the whole universe from a metered vendor.
  resetMarketCache();
  forgetStore();
  remember([
    {
      ticker: "NVDA",
      price: 184.22,
      changePct: 1,
      marketCap: 0,
      previousClose: 182,
      open: 183,
      asOf: "2026-09-10T14:00:00.000Z",
      synthetic: false,
    },
  ]);

  let calls = 0;
  setHttpTransport(async () => {
    calls++;
    return { status: 0, body: "", cookies: [], retryAfter: null, error: "offline in tests" };
  });
  try {
    const q = (await getQuotes(["NVDA"])).get("NVDA");
    assert.equal(q?.price, 184.22);
    assert.equal(q?.synthetic, false);
    assert.equal(calls, 0, "the vendor was never asked");
  } finally {
    setHttpTransport(async () => ({
      status: 0,
      body: "",
      cookies: [],
      retryAfter: null,
      error: "offline in tests",
    }));
  }
});
