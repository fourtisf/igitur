/**
 * The keyless provider, against a stubbed transport.
 *
 * These stub the HTTP layer rather than the parser, so what runs is the real
 * session dance, the real batching and the real fallback — the parts that were
 * wrong in production, where the site served generated prices for an hour at a
 * time from a source that answered `curl` on the first try.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { cookieHeader, setHttpTransport, type HttpResponse } from "../lib/market/http";
import { forgetYahooSession, yahooLastError, yahooProbe, yahooProvider } from "../lib/market/yahoo";

type Reply = Partial<HttpResponse> | ((url: string) => Partial<HttpResponse>);

/** Serves `routes` by substring match; anything unmatched is a 404. */
function serve(routes: [string, Reply][], onUrl?: (u: string) => void) {
  const urls: string[] = [];
  setHttpTransport(async (url) => {
    urls.push(url);
    onUrl?.(url);
    for (const [needle, reply] of routes) {
      if (!url.includes(needle)) continue;
      const r = typeof reply === "function" ? reply(url) : reply;
      return { status: 200, body: "", cookies: [], error: null, ...r };
    }
    return { status: 404, body: "", cookies: [], error: null };
  });
  return () => urls;
}

const SESSION: [string, Reply][] = [
  ["fc.yahoo.com", { status: 404, cookies: ["A1=d=abc; Path=/; Domain=.yahoo.com"] }],
  ["/v1/test/getcrumb", { status: 200, body: "Xy9zQ2p" }],
];

const ROW = {
  symbol: "NVDA",
  regularMarketPrice: 184.22,
  regularMarketPreviousClose: 179.88,
  regularMarketOpen: 180.5,
  regularMarketChangePercent: 2.4127,
  regularMarketTime: 1788897600,
  marketCap: 4_490_000_000_000,
};

const v7 = (over: Record<string, unknown> = {}) =>
  JSON.stringify({ quoteResponse: { result: [{ ...ROW, ...over }] } });

/** Prices whatever was asked for, the way the real endpoint does. */
const BATCH_OK: [string, Reply] = [
  "/v7/finance/quote",
  (url) => ({
    body: JSON.stringify({
      quoteResponse: {
        result: (new URL(url).searchParams.get("symbols") ?? "")
          .split(",")
          .filter(Boolean)
          .map((symbol) => ({ ...ROW, symbol })),
      },
    }),
  }),
];

const chartBody = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    chart: {
      result: [
        {
          meta: {
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

test.afterEach(() => {
  setHttpTransport(null);
  forgetYahooSession();
});

test("the batch endpoint prices a name, in the site's own units", async () => {
  forgetYahooSession();
  const seen = serve([...SESSION, BATCH_OK]);

  const n = (await yahooProvider().quotes(["NVDA"])).get("NVDA");
  assert.ok(n);
  assert.equal(n.price, 184.22);
  assert.equal(n.previousClose, 179.88);
  assert.equal(n.changePct, 2.41, "percent to two places");
  assert.equal(n.open, 180.5);
  assert.equal(n.marketCap, 4490, "units converted to billions");
  assert.equal(n.synthetic, false);
  assert.ok(
    seen().some((u) => u.includes("crumb=Xy9zQ2p")),
    "the crumb is carried on the batch request"
  );
});

test("163 tickers cost a handful of requests, not 163", async () => {
  // This is the bug that put the site on generated prices in production: a
  // request per ticker, on every prerender, until the vendor throttled it.
  forgetYahooSession();
  const seen = serve([...SESSION, BATCH_OK]);

  await yahooProvider().quotes(Array.from({ length: 163 }, (_, i) => `T${i}`));
  const quoteCalls = seen().filter((u) => u.includes("/v7/finance/quote")).length;
  assert.equal(quoteCalls, 4, "163 names at 50 a batch");
  assert.equal(
    seen().filter((u) => u.includes("/v8/finance/chart")).length,
    0,
    "nothing falls back when the batch answered"
  );
});

test("the session is earned once and reused", async () => {
  forgetYahooSession();
  const seen = serve([...SESSION, BATCH_OK]);

  await yahooProvider().quotes(["NVDA"]);
  await yahooProvider().quotes(["AAPL"]);
  assert.equal(seen().filter((u) => u.includes("getcrumb")).length, 1);
});

test("a failed batch falls back to the chart endpoint rather than to fiction", async () => {
  forgetYahooSession();
  serve([
    ...SESSION,
    ["/v7/finance/quote", { status: 500 }],
    ["/v8/finance/chart", { body: chartBody() }],
  ]);

  const n = (await yahooProvider().quotes(["NVDA"])).get("NVDA");
  assert.ok(n, "the fallback priced it");
  assert.equal(n.price, 184.22);
  assert.equal(n.open, 180.5, "open comes from the last daily bar");
  assert.equal(n.marketCap, 0, "the chart response has no market cap; 0 renders as an em dash");
});

test("the fallback does not become the burst it replaced", async () => {
  forgetYahooSession();
  let inFlight = 0;
  let peak = 0;
  setHttpTransport(async (url) => {
    if (url.includes("/v8/finance/chart")) {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 3));
      inFlight--;
      return { status: 200, body: chartBody(), cookies: [], error: null };
    }
    if (url.includes("getcrumb")) return { status: 200, body: "Xy9zQ2p", cookies: [], error: null };
    if (url.includes("fc.yahoo.com"))
      return { status: 404, body: "", cookies: ["A1=d=abc"], error: null };
    return { status: 500, body: "", cookies: [], error: null };
  });

  await yahooProvider().quotes(Array.from({ length: 60 }, (_, i) => `T${i}`));
  assert.ok(peak <= 6, `peaked at ${peak} concurrent requests`);
});

test("either spelling of the previous close is accepted", async () => {
  forgetYahooSession();
  serve([
    ...SESSION,
    ["/v7/finance/quote", { status: 500 }],
    [
      "/v8/finance/chart",
      { body: chartBody({ chartPreviousClose: undefined, previousClose: 179.88 }) },
    ],
  ]);
  assert.equal((await yahooProvider().quotes(["NVDA"])).get("NVDA")?.changePct, 2.41);
});

test("a row without a usable price is dropped, not rendered as zero", async () => {
  forgetYahooSession();
  serve([
    ...SESSION,
    ["/v7/finance/quote", { body: v7({ regularMarketPrice: null }) }],
    ["/v8/finance/chart", { body: chartBody({ regularMarketPrice: null }) }],
  ]);
  assert.equal((await yahooProvider().quotes(["NVDA"])).size, 0);
});

test("history skips the nulls Yahoo leaves for halted sessions", async () => {
  forgetYahooSession();
  serve([
    [
      "/v8/finance/chart",
      {
        body: JSON.stringify({
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
      },
    ],
  ]);
  const bars = await yahooProvider().history("NVDA", "2026-09-01");
  assert.equal(bars.length, 2, "the gap is not a price");
  assert.deepEqual(
    bars.map((x) => x.close),
    [179.0, 184.22]
  );
  assert.ok(bars[0].date < bars[1].date, "oldest first");
});

test("a refusal degrades, and says which code it was refused with", async () => {
  forgetYahooSession();
  serve([["", { status: 429, body: "go away" }]]);

  assert.equal((await yahooProvider().quotes(["NVDA"])).size, 0);
  assert.match(yahooLastError() ?? "", /429/, "the status reaches /status, not just the logs");
  assert.deepEqual(await yahooProvider().history("NVDA", "2026-09-01"), []);
});

test("a request that never completes is reported as a reason, not as silence", async () => {
  forgetYahooSession();
  serve([["", { status: 0, error: "timeout" }]]);
  await yahooProvider().quotes(["NVDA"]);
  assert.match(yahooLastError() ?? "", /timeout/);
});

test("a stale crumb is thrown away so the next render earns a new one", async () => {
  forgetYahooSession();
  let crumbs = 0;
  serve(
    [
      ...SESSION,
      ["/v7/finance/quote", { status: 401 }],
      ["/v8/finance/chart", { body: chartBody() }],
    ],
    (u) => {
      if (u.includes("getcrumb")) crumbs++;
    }
  );

  await yahooProvider().quotes(["NVDA"]);
  await yahooProvider().quotes(["NVDA"]);
  assert.equal(crumbs, 2, "a 401 invalidates the session instead of being repeated");
});

test("the probe reports each step, so a failure has a reason", async () => {
  forgetYahooSession();
  serve([...SESSION, ["/v7/finance/quote", { status: 403 }], ["/v8/finance/chart", { body: chartBody() }]]);

  const steps = await yahooProbe();
  const by = Object.fromEntries(steps.map((s) => [s.step, s]));
  assert.equal(by.cookie.ok, true);
  assert.equal(by.crumb.ok, true);
  assert.equal(by["batch SPY"].ok, false);
  assert.equal(by["batch SPY"].status, 403, "the code a person needs is the code reported");
  assert.equal(by["chart SPY"].ok, true);
});

test("cookies are reduced to name=value pairs, last one winning", () => {
  assert.equal(
    cookieHeader([
      "A1=d=first; Path=/; Domain=.yahoo.com; HttpOnly",
      "A3=second; Path=/",
      "A1=d=third; Path=/",
    ]),
    "A1=d=third; A3=second"
  );
});
