/**
 * The keyless provider, against a stubbed response.
 *
 * The endpoint was confirmed reachable from the server — it answered with real
 * JSON for NVDA where three Stooq endpoints did not — but the response came
 * back truncated before the price fields, so the names below are read through
 * a list rather than pinned to one spelling. These tests fix what is ours: the
 * parsing, what a gap in the series does, and that a refusal degrades.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { yahooProvider, yahooLastError } from "../lib/market/yahoo";

type Fetch = typeof globalThis.fetch;

async function withFetch(stub: Fetch, run: (seen: () => string[]) => Promise<void>) {
  const real = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    urls.push(String(input));
    return stub(input, init);
  }) as Fetch;
  try {
    await run(() => urls);
  } finally {
    globalThis.fetch = real;
  }
}

/** The shape Yahoo's chart endpoint returns, as its own charts consume it. */
const body = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    chart: {
      result: [
        {
          meta: {
            currency: "USD",
            symbol: "NVDA",
            regularMarketPrice: 184.22,
            chartPreviousClose: 179.88,
            regularMarketTime: 1788897600,
            ...over,
          },
          timestamp: [1788638400, 1788724800, 1788811200],
          indicators: { quote: [{ open: [178.1, 181.0, 180.5], close: [179.0, 179.88, 184.22] }] },
        },
      ],
      error: null,
    },
  });

test("a quote is parsed into the site's own units", async () => {
  await withFetch(
    (async () => new Response(body(), { status: 200 })) as Fetch,
    async (seen) => {
      const q = await yahooProvider().quotes(["NVDA"]);
      assert.match(seen()[0], /\/v8\/finance\/chart\/NVDA/);
      const n = q.get("NVDA");
      assert.ok(n);
      assert.equal(n.price, 184.22);
      assert.equal(n.previousClose, 179.88);
      assert.equal(n.changePct, 2.41, "percent to two places");
      assert.equal(n.open, 180.5, "open comes from the last daily bar");
      assert.equal(n.synthetic, false);
    }
  );
});

test("a missing market cap is absent, never zero dressed as a number", async () => {
  // fmtMcap renders 0 as an em dash. Any other value here would put a made-up
  // valuation on every holding.
  await withFetch(
    (async () => new Response(body(), { status: 200 })) as Fetch,
    async () => {
      assert.equal((await yahooProvider().quotes(["NVDA"])).get("NVDA")?.marketCap, 0);
    }
  );
});

test("either spelling of the previous close is accepted", async () => {
  // Yahoo has used both across versions, and the live response could not be
  // read far enough to see which this one sends.
  await withFetch(
    (async () =>
      new Response(
        body({ chartPreviousClose: undefined, previousClose: 179.88 }),
        { status: 200 }
      )) as Fetch,
    async () => {
      assert.equal((await yahooProvider().quotes(["NVDA"])).get("NVDA")?.changePct, 2.41);
    }
  );
});

test("a row without a usable price is dropped, not rendered as zero", async () => {
  await withFetch(
    (async () => new Response(body({ regularMarketPrice: null }), { status: 200 })) as Fetch,
    async () => {
      assert.equal((await yahooProvider().quotes(["NVDA"])).size, 0);
    }
  );
});

test("history skips the nulls Yahoo leaves for halted sessions", async () => {
  await withFetch(
    (async () =>
      new Response(
        JSON.stringify({
          chart: {
            result: [
              {
                meta: {},
                timestamp: [1788638400, 1788724800, 1788811200],
                indicators: { quote: [{ close: [179.0, null, 184.22] }] },
              },
            ],
          },
        }),
        { status: 200 }
      )) as Fetch,
    async () => {
      const bars = await yahooProvider().history("NVDA", "2026-09-01");
      assert.equal(bars.length, 2, "the gap is not a price");
      assert.deepEqual(bars.map((x) => x.close), [179.0, 184.22]);
      assert.ok(bars[0].date < bars[1].date, "oldest first");
    }
  );
});

test("a refusal degrades instead of taking the page down", async () => {
  await withFetch(
    (async () => new Response("go away", { status: 429 })) as Fetch,
    async () => {
      assert.equal((await yahooProvider().quotes(["NVDA"])).size, 0);
      assert.match(yahooLastError() ?? "", /429/);
      assert.deepEqual(await yahooProvider().history("NVDA", "2026-09-01"), []);
    }
  );
});

test("163 tickers do not arrive as 163 simultaneous requests", async () => {
  // Yahoo has every reason to throttle a burst, and being throttled looks
  // exactly like the endpoint not working.
  let inFlight = 0;
  let peak = 0;
  await withFetch(
    (async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return new Response(body(), { status: 200 });
    }) as Fetch,
    async () => {
      await yahooProvider().quotes(Array.from({ length: 163 }, (_, i) => `T${i}`));
      assert.ok(peak <= 8, `peaked at ${peak} concurrent requests`);
    }
  );
});
