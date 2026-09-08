/**
 * The vendor path, exercised against a stubbed API.
 *
 * No key was available when this was written, so the live path could not be
 * run against the real service. These pin the parts that are ours: which
 * endpoint is called, how the response is parsed, what happens to a malformed
 * row, and that an outage degrades instead of taking a page down.
 *
 * FMP has two API generations that disagree on names, and a key created today
 * only reaches the newer one. So the parser accepts either, and these tests
 * assert that — including the field rename that would otherwise have shown
 * every holding as flat 0.00% while looking entirely healthy.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { fmpLastError, fmpProvider } from "../lib/market/fmp";

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
    changePercentage: 2.4137,
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
      // A key created today does not reach /api/v3 at all; it is legacy and
      // no longer issued. Calling it would have returned 403 for every ticker
      // and left the site silently synthetic.
      assert.match(seen(), /\/stable\/batch-quote\?symbols=NVDA,CCJ,BROKEN/);
      assert.doesNotMatch(seen(), /api\/v3/);

      const nvda = q.get("NVDA");
      assert.ok(nvda);
      assert.equal(nvda.price, 184.22);
      assert.equal(nvda.changePct, 2.41, "percent should be rounded to two places");
      // FMP reports market cap in units; the site works in billions throughout.
      assert.equal(nvda.marketCap, 4490);
      assert.equal(nvda.previousClose, 179.88);
      assert.equal(nvda.synthetic, false, "a real quote must not claim to be synthetic");

      // NVDA above carries the /stable spelling; CCJ carries the /api/v3 one.
      // Reading only the newer name would have rendered every change as an
      // untroubled 0.00% — wrong, and impossible to spot on the page.
      assert.equal(q.get("CCJ")?.changePct, -1.2);
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

const rows = [
  { date: "2026-09-03", close: 100 },
  { date: "2026-09-01", close: 90 },
  { date: "2026-09-02", close: 95 },
  { date: "2026-09-04", close: null },
];

test("history is returned oldest first, whatever order the vendor sends", async () => {
  // FMP returns newest first; the chart reads left to right.
  await withFetch(
    (async () => new Response(JSON.stringify(rows), { status: 200 })) as Fetch,
    async (seen) => {
      const bars = await fmpProvider("k").history("SPY", "2026-09-01");
      assert.match(seen(), /\/stable\/historical-price-eod\/full\?symbol=SPY&from=2026-09-01/);
      assert.deepEqual(
        bars.map((b) => b.date),
        ["2026-09-01", "2026-09-02", "2026-09-03"]
      );
      assert.equal(bars[0].close, 90);
    }
  );
});

test("either API generation's response shape yields the same bars", async () => {
  // /stable returns a bare array; /api/v3 wrapped it in `historical`. The
  // wrapper cost nothing to keep and removes one way to be silently wrong.
  await withFetch(
    (async () => new Response(JSON.stringify({ historical: rows }), { status: 200 })) as Fetch,
    async () => {
      const bars = await fmpProvider("k").history("SPY", "2026-09-01");
      assert.deepEqual(
        bars.map((b) => b.date),
        ["2026-09-01", "2026-09-02", "2026-09-03"]
      );
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

test("a rejected key is reported, and the reason never contains the key", async () => {
  // Without this the site would say "live market data from fmp" while serving
  // generated numbers, because a key being *set* is not a key being *accepted*.
  await withFetch(
    (async () => new Response("Invalid API KEY", { status: 401 })) as Fetch,
    async () => {
      await fmpProvider("s3cret-key").quotes(["NVDA"]);
      const err = fmpLastError();
      assert.match(err ?? "", /401/);
      assert.doesNotMatch(err ?? "", /s3cret/, "the key must never reach the page");
    }
  );
});

test("a thrown error can never carry the key onto the page", async () => {
  // This is not hypothetical. Next.js throws DynamicServerError with the whole
  // request URL in its message, and /status printed that message verbatim —
  // publishing the API key in the HTML of a public page. The message below is
  // the real one, with the real key position.
  const KEY = "s3cret-key";
  await withFetch(
    (async () => {
      throw new Error(
        "Dynamic server usage: Route /status couldn't be rendered statically " +
          `because it used revalidate: 0 fetch https://financialmodelingprep.com/` +
          `stable/batch-quote?symbols=SPY&apikey=${KEY} /status. See more info ` +
          "here: https://nextjs.org/docs/messages/dynamic-server-error"
      );
    }) as Fetch,
    async () => {
      await fmpProvider(KEY).quotes(["SPY"]);
      const err = fmpLastError() ?? "";
      assert.doesNotMatch(err, /s3cret/, "the key reached a user-facing string");
      assert.doesNotMatch(err, /financialmodelingprep\.com/, "a full URL leaked with it");
    }
  );
});

test("the vendor response is cached rather than marked no-store", async () => {
  // `cache: "no-store"` makes Next throw inside a statically rendered route,
  // so every prerendered page would fall back to synthetic no matter how
  // valid the key was. The failure looked exactly like a bad key.
  let init: RequestInit | undefined;
  await withFetch(
    (async (_i: RequestInfo | URL, r?: RequestInit) => {
      init = r;
      return new Response("[]", { status: 200 });
    }) as Fetch,
    async () => {
      await fmpProvider("k").quotes(["SPY"]);
      assert.notEqual(init?.cache, "no-store");
      assert.ok(
        typeof (init as { next?: { revalidate?: number } })?.next?.revalidate === "number",
        "the fetch must tell Next how long it may be reused"
      );
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
