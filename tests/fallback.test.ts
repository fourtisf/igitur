/**
 * Routing around a vendor that is configured but broken.
 *
 * This is the failure it was written for, verbatim from production:
 * `HTTP 401 from /stable/batch-quote`, every figure on the site generated,
 * and a keyless source that was configured, working, and never asked — because
 * the selection logic read a key being *present* as the decision.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { pickProvider } from "../lib/market";
import { fallbackProvider } from "../lib/market/fallback";
import { setHttpTransport } from "../lib/market/http";
import type { MarketProvider, Quote } from "../lib/market/types";

const quote = (ticker: string, price: number): Quote => ({
  ticker,
  price,
  changePct: 0,
  marketCap: 0,
  previousClose: price,
  open: price,
  asOf: "2026-09-09T00:00:00.000Z",
  synthetic: false,
});

function stub(
  name: string,
  prices: Record<string, number>,
  count = { quotes: 0, history: 0 }
): MarketProvider & { calls: typeof count } {
  return {
    name,
    live: true,
    calls: count,
    async quotes(tickers) {
      count.quotes++;
      const out = new Map<string, Quote>();
      for (const t of tickers) {
        const p = prices[t.toUpperCase()];
        if (p) out.set(t.toUpperCase(), quote(t.toUpperCase(), p));
      }
      return out;
    },
    async history(ticker) {
      count.history++;
      return prices[ticker.toUpperCase()] ? [{ date: "2026-09-01", close: 1 }] : [];
    },
  };
}

test("a rejected key no longer takes the site down with it", async () => {
  const fmp = stub("fmp", {}); // 401 for everything
  const yahoo = stub("yahoo", { NVDA: 184.22 });
  const p = fallbackProvider(fmp, yahoo);

  const q = await p.quotes(["NVDA"]);
  assert.equal(q.get("NVDA")?.price, 184.22, "the working source was asked");
  assert.equal(p.name, "yahoo (fallback from fmp)", "/status must name who answered");
});

test("the fallback fills the gaps, per ticker, without discarding what worked", async () => {
  // A vendor covering 158 of 163 keeps those 158.
  const fmp = stub("fmp", { NVDA: 100, CCJ: 50 });
  const yahoo = stub("yahoo", { NVDA: 999, SGOV: 25 });
  const p = fallbackProvider(fmp, yahoo);

  const q = await p.quotes(["NVDA", "CCJ", "SGOV"]);
  assert.equal(q.get("NVDA")?.price, 100, "the primary wins where it answered");
  assert.equal(q.get("CCJ")?.price, 50);
  assert.equal(q.get("SGOV")?.price, 25, "the gap came from the fallback");
  assert.equal(p.name, "fmp", "the primary supplied most of the page");
});

test("a vendor that keeps refusing is set aside rather than asked for ever", async () => {
  // A rejected key answers 401 every time. Four requests a minute for the rest
  // of the day is rude to the vendor, and every render waits for the refusal
  // before reaching the source that works.
  const fmp = stub("fmp", {});
  const yahoo = stub("yahoo", { NVDA: 184.22 });
  const p = fallbackProvider(fmp, yahoo);

  for (let i = 0; i < 6; i++) await p.quotes(["NVDA"]);
  assert.equal(fmp.calls.quotes, 3, "three strikes, then set aside");
  assert.equal(yahoo.calls.quotes, 6, "the reader never notices");
});

test("a vendor that answers is never set aside", async () => {
  const fmp = stub("fmp", { NVDA: 100 });
  const yahoo = stub("yahoo", { NVDA: 999 });
  const p = fallbackProvider(fmp, yahoo);

  for (let i = 0; i < 6; i++) await p.quotes(["NVDA"]);
  assert.equal(fmp.calls.quotes, 6);
  assert.equal(yahoo.calls.quotes, 0, "the fallback is not called when nothing is missing");
});

test("an occasional empty round does not count as a broken vendor", async () => {
  // Strikes must be consecutive, or a vendor that fails once an hour would be
  // dropped after three hours of otherwise perfect service.
  const prices: Record<string, number> = { NVDA: 100 };
  const calls = { quotes: 0, history: 0 };
  const fmp = stub("fmp", prices, calls);
  const yahoo = stub("yahoo", { NVDA: 999, GHOST: 1 });
  const p = fallbackProvider(fmp, yahoo);

  for (let i = 0; i < 10; i++) {
    await p.quotes(["GHOST"]); // the primary prices nothing
    await p.quotes(["NVDA"]); // then prices something
  }
  assert.equal(calls.quotes, 20, "a vendor that keeps answering keeps being asked");
});

test("history falls through too, and an empty series is not an answer", async () => {
  const fmp = stub("fmp", {});
  const yahoo = stub("yahoo", { NVDA: 1 });
  const p = fallbackProvider(fmp, yahoo);

  assert.equal((await p.history("NVDA", "2026-09-01")).length, 1);
  assert.equal(yahoo.calls.history, 1);
});

test("before anything is served the primary is named, not guessed at", async () => {
  const p = fallbackProvider(stub("fmp", {}), stub("yahoo", {}));
  assert.equal(p.name, "fmp");
  assert.equal(p.live, true);
});

test("a key that FMP rejects still leaves the site on real prices", async () => {
  // The production bug end to end: MARKET_API_KEY set, FMP answering 401, and
  // every figure on the site generated because the keyless source was never
  // asked. This runs the real selection and the real providers, over a stubbed
  // socket.
  setHttpTransport(async (url) => {
    if (url.includes("financialmodelingprep.com"))
      return { status: 401, body: "Invalid API KEY", cookies: [], error: null };
    if (url.includes("fc.yahoo.com"))
      return { status: 404, body: "", cookies: ["A1=d=abc"], error: null };
    if (url.includes("getcrumb"))
      return { status: 200, body: "Xy9zQ2p", cookies: [], error: null };
    return {
      status: 200,
      cookies: [],
      error: null,
      body: JSON.stringify({
        quoteResponse: {
          result: [{ symbol: "NVDA", regularMarketPrice: 184.22, marketCap: 4.49e12 }],
        },
      }),
    };
  });
  try {
    const p = pickProvider({ MARKET_API_KEY: "rejected-key" });
    const q = await p.quotes(["NVDA"]);
    assert.equal(q.get("NVDA")?.price, 184.22);
    assert.equal(q.get("NVDA")?.synthetic, false);
    assert.equal(p.name, "yahoo (fallback from fmp)");
  } finally {
    setHttpTransport(null);
  }
});

test("no key at all reaches for real prices rather than settling for generated", () => {
  assert.equal(pickProvider({}).name, "yahoo");
  assert.equal(pickProvider({ MARKET_PROVIDER: "synthetic" }).live, false);
});
