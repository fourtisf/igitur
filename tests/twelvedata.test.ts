/**
 * The vendor that answered.
 *
 * Three providers before this one were written from memory and each missed
 * reality in a different way — the wrong API generation, unverified field
 * names, an address that returned 404. This one was written after the
 * deployment server proved the endpoint reachable, and these tests pin the two
 * things most likely to be wrong anyway: numbers arriving as strings, and a
 * failure arriving inside a 200.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { setHttpTransport } from "../lib/market/http";
import {
  quoteFromRow,
  rowsFrom,
  twelveDataLastError,
  twelveDataProvider,
} from "../lib/market/twelvedata";

function serve(body: unknown, status = 200) {
  const urls: string[] = [];
  setHttpTransport(async (url) => {
    urls.push(url);
    return {
      status,
      body: typeof body === "string" ? body : JSON.stringify(body),
      cookies: [],
      retryAfter: null,
      error: null,
    };
  });
  return () => urls;
}

const ROW = {
  symbol: "SPY",
  open: "668.00",
  high: "672.10",
  low: "667.20",
  close: "671.23",
  previous_close: "669.00",
  percent_change: "0.3333",
  datetime: "2026-09-09",
  timestamp: 1789000000,
};

test.afterEach(() => setHttpTransport(null));

test("prices arrive as strings, and are read as numbers", () => {
  // "671.23", not 671.23. The single most common way to parse this API wrong,
  // and it would put NaN or zero on every row.
  const q = quoteFromRow(ROW);
  assert.ok(q);
  assert.equal(q.price, 671.23);
  assert.equal(q.previousClose, 669);
  assert.equal(q.open, 668);
  assert.equal(q.changePct, 0.33, "rounded to two places");
  assert.equal(q.synthetic, false);
  assert.equal(q.marketCap, 0, "not in this response; renders as an em dash");
});

test("a missing percent change is derived from two real closes", () => {
  const q = quoteFromRow({ ...ROW, percent_change: undefined });
  assert.equal(q?.changePct, 0.33);
});

test("no previous close leaves the move unknown, never a calm zero", () => {
  const q = quoteFromRow({ ...ROW, percent_change: undefined, previous_close: undefined });
  assert.equal(q?.changePct, null);
  assert.equal(q?.price, 671.23);
});

test("a row without a usable price is dropped, not rendered as zero", () => {
  assert.equal(quoteFromRow({ ...ROW, close: "0" }), null);
  assert.equal(quoteFromRow({ ...ROW, close: "" }), null, "an empty string is not zero");
  assert.equal(quoteFromRow({ ...ROW, close: undefined }), null);
  assert.equal(quoteFromRow({ ...ROW, symbol: undefined }), null);
});

test("both response shapes are read", () => {
  // One symbol comes back as the row itself; several come back keyed by symbol.
  assert.deepEqual(rowsFrom(ROW).map((r) => r.symbol), ["SPY"]);
  assert.deepEqual(
    rowsFrom({ SPY: ROW, NVDA: { ...ROW, symbol: "NVDA" } }).map((r) => r.symbol),
    ["SPY", "NVDA"]
  );
});

test("a batch row that omits its own symbol is named by its key", () => {
  const rows = rowsFrom({ NVDA: { close: "184.22" } });
  assert.equal(rows[0].symbol, "NVDA");
});

test("a failure inside a 200 is not treated as data", async () => {
  // This vendor reports a spent allowance and a rejected key as ordinary JSON
  // with a 200. Reading that as a quote would leave the page empty while the
  // site claimed the vendor was answering.
  serve({ code: 429, message: "You have run out of API credits", status: "error" });
  const q = await twelveDataProvider("k").quotes(["SPY"]);
  assert.equal(q.size, 0);
  assert.match(twelveDataLastError() ?? "", /credits/);
});

test("a per-symbol error inside a good batch costs that symbol alone", () => {
  const rows = rowsFrom({
    SPY: ROW,
    ZZZZ: { code: 404, status: "error", message: "symbol not found" },
  });
  const quotes = rows.map(quoteFromRow).filter(Boolean);
  assert.equal(quotes.length, 1);
  assert.equal(quotes[0]?.ticker, "SPY");
});

test("163 names are batched, not asked one at a time", async () => {
  const seen = serve({ SPY: ROW });
  await twelveDataProvider("k").quotes(Array.from({ length: 163 }, (_, i) => `T${i}`));
  assert.equal(seen().length, 4, "163 names at fifty a request");
});

test("the key never reaches a user-facing string", async () => {
  serve("not json at all", 500);
  await twelveDataProvider("s3cret-key").quotes(["SPY"]);
  assert.doesNotMatch(twelveDataLastError() ?? "", /s3cret/);
});

test("history is oldest first and skips rows without a close", async () => {
  const seen = serve({
    values: [
      { datetime: "2026-09-03", close: "102" },
      { datetime: "2026-09-02", close: null },
      { datetime: "2026-09-01", close: "100" },
    ],
  });
  const bars = await twelveDataProvider("k").history("SPY", "2026-09-01");
  assert.deepEqual(bars.map((b) => b.date), ["2026-09-01", "2026-09-03"]);
  assert.equal(bars[0].close, 100);
  assert.match(seen()[0], /interval=1day/);
});

test("an outage degrades instead of taking the page down", async () => {
  serve("", 503);
  const p = twelveDataProvider("k");
  assert.equal((await p.quotes(["SPY"])).size, 0);
  assert.deepEqual(await p.history("SPY", "2026-01-01"), []);
  assert.match(twelveDataLastError() ?? "", /503/);
});

test("a 429 says which limit was hit, because they recover differently", async () => {
  // Eight requests a minute recovers in sixty seconds; a spent daily allowance
  // does not until midnight. A bare status code cannot tell them apart.
  serve({ code: 429, message: "You have run out of API credits for the current minute." }, 429);
  await twelveDataProvider("k").quotes(["SPY"]);
  const err = twelveDataLastError() ?? "";
  assert.match(err, /429/);
  assert.match(err, /current minute/, "the vendor's own words reach /status");
});
