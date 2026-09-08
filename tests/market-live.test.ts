/**
 * The vendor path, exercised against a stubbed API.
 *
 * No key was available when this was written, so the live path could not be
 * run against the real service. These pin the parts that are ours: how the
 * response is parsed, what happens to a malformed row, and that an outage
 * degrades instead of taking a page down. What they cannot prove is that FMP's
 * response shape matches the one stubbed here — that is checked the first time
 * a real key is configured.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { fmpProvider } from "../lib/market/fmp";

type Fetch = typeof globalThis.fetch;

/** Swap fetch for the duration of one test, then always put it back. */
async function withFetch(stub: Fetch, run: (seen: () => string) => Promise<void>) {
  const real = globalThis.fetch;
  let lastUrl = "";
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    lastUrl = String(input);
    return stub(input, init);
  }) as Fetch;
  try {
    await run(() => lastUrl);
  } finally {
    globalThis.fetch = real;
  }
}

const quoteBody = JSON.stringify([
  {
    symbol: "NVDA",
    price: 184.22,
    changesPercentage: 2.4137,
    marketCap: 4.49e12,
    previousClose: 179.88,
    open: 180.5,
    timestamp: 1757318400,
  },
  { symbol: "CCJ", price: 92.11, changesPercentage: -1.2, marketCap: 4.0e10, previousClose: 93.23 },
  // A row the vendor returned but cannot price.
  { symbol: "BROKEN", price: null },
]);

test("a vendor quote is parsed into the site's own units", async () => {
  await withFetch(
    (async () => new Response(quoteBody, { status: 200 })) as Fetch,
    async (seen) => {
      const q = await fmpProvider("test-key").quotes(["NVDA", "CCJ", "BROKEN"]);
      assert.match(seen(), /apikey=test-key/);

      const nvda = q.get("NVDA");
      assert.ok(nvda);
      assert.equal(nvda.price, 184.22);
      assert.equal(nvda.changePct, 2.41, "percent should be rounded to two places");
      // FMP reports market cap in units; the site works in billions throughout.
      assert.equal(nvda.marketCap, 4490);
      assert.equal(nvda.previousClose, 179.88);
      assert.equal(nvda.synthetic, false, "a real quote must not claim to be synthetic");
    }
  );
});

test("a row without a usable price is dropped, never rendered as zero", async () => {
  // Dropping it lets the caller fall back for that one ticker. Keeping it would
  // put "$0.00" on the page as though it were a price.
  await withFetch(
    (async () => new Response(quoteBody, { status: 200 })) as Fetch,
    async () => {
      const q = await fmpProvider("k").quotes(["NVDA", "CCJ", "BROKEN"]);
      assert.equal(q.size, 2);
      assert.ok(!q.has("BROKEN"));
    }
  );
});

test("a missing previous close is derived from the change, not invented", async () => {
  await withFetch(
    (async () =>
      new Response(JSON.stringify([{ symbol: "X", price: 110, changesPercentage: 10 }]), {
        status: 200,
      })) as Fetch,
    async () => {
      const q = await fmpProvider("k").quotes(["X"]);
      assert.equal(q.get("X")?.previousClose, 100);
    }
  );
});

test("history is returned oldest first, whatever order the vendor sends", async () => {
  // FMP returns newest first; the chart reads left to right.
  await withFetch(
    (async () =>
      new Response(
        JSON.stringify({
          historical: [
            { date: "2026-09-03", close: 100 },
            { date: "2026-09-01", close: 90 },
            { date: "2026-09-02", close: 95 },
            { date: "2026-09-04", close: null },
          ],
        }),
        { status: 200 }
      )) as Fetch,
    async () => {
      const bars = await fmpProvider("k").history("SPY", "2026-09-01");
      assert.deepEqual(
        bars.map((b) => b.date),
        ["2026-09-01", "2026-09-02", "2026-09-03"]
      );
      assert.equal(bars[0].close, 90);
    }
  );
});

test("a vendor outage degrades instead of taking the page down", async () => {
  await withFetch(
    (async () => {
      throw new Error("connection reset");
    }) as Fetch,
    async () => {
      const p = fmpProvider("k");
      assert.equal((await p.quotes(["NVDA"])).size, 0);
      assert.deepEqual(await p.history("SPY", "2026-01-01"), []);
    }
  );
});

test("a non-200 response is treated as no data, not as data", async () => {
  await withFetch(
    (async () => new Response("Rate limit exceeded", { status: 429 })) as Fetch,
    async () => {
      assert.equal((await fmpProvider("k").quotes(["NVDA"])).size, 0);
    }
  );
});

test("tickers are requested in batches rather than one call each", async () => {
  // 163 names on one page must not become 163 requests.
  let calls = 0;
  await withFetch(
    (async () => {
      calls++;
      return new Response("[]", { status: 200 });
    }) as Fetch,
    async () => {
      const many = Array.from({ length: 163 }, (_, i) => `T${i}`);
      await fmpProvider("k").quotes(many);
      assert.ok(calls <= 4, `made ${calls} requests for 163 tickers`);
    }
  );
});
