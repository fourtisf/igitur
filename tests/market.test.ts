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
  cachedTtlMs,
  cleanKey,
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
import { setHttpTransport } from "../lib/market/http";
import { syntheticQuote } from "../lib/market/synthetic";
import { sessionsFor } from "../lib/track";
import { UNIVERSE } from "../lib/universe";

// These pin the synthetic path, so the vendor must not actually be reached: a
// test that depends on Yahoo answering is a test that fails on a train.
setHttpTransport(async () => ({ status: 0, body: "", cookies: [], retryAfter: null, error: "offline in tests" }));

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
    assert.ok(
      Math.abs(implied - q.changePct) < 0.05,
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
