/**
 * The third source, against a stubbed transport.
 *
 * It exists because two sources that fail together are one source, and they
 * did: FMP holding a key it had never accepted, and Yahoo answering 429 to
 * this server's address for hours because data-centre ranges are throttled as
 * a matter of policy.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { setHttpTransport } from "../lib/market/http";
import { parseCsv, stooqLastError, stooqProvider, stooqSymbol } from "../lib/market/stooq";

function serve(body: string, status = 200) {
  const urls: string[] = [];
  setHttpTransport(async (url) => {
    urls.push(url);
    return { status, body, cookies: [], retryAfter: null, error: null };
  });
  return () => urls;
}

const QUOTE_CSV = [
  "Symbol,Date,Time,Open,High,Low,Close,Volume",
  "NVDA.US,2026-09-09,22:00:04,178.10,185.00,177.50,184.22,50000000",
  "SPY.US,2026-09-09,22:00:04,668.00,672.10,667.20,671.23,70000000",
].join("\n");

test.afterEach(() => setHttpTransport(null));

test("a name is priced, and the session move is unknown rather than zero", async () => {
  // A flat 0.00% across 163 rows would be the most convincing false thing on
  // the site. Null renders as an em dash.
  const seen = serve(QUOTE_CSV);
  const q = (await stooqProvider().quotes(["NVDA", "SPY"])).get("NVDA");

  assert.ok(q);
  assert.equal(q.price, 184.22);
  assert.equal(q.open, 178.1);
  assert.equal(q.changePct, null, "no previous close means no move, not a calm one");
  assert.equal(q.previousClose, 0);
  assert.equal(q.marketCap, 0, "rendered as an em dash, not as $0B");
  assert.equal(q.synthetic, false);
  assert.match(seen()[0], /s=nvda\.us\+spy\.us/, "one request for both names");
});

test("163 names cost four requests", async () => {
  const seen = serve(QUOTE_CSV);
  await stooqProvider().quotes(Array.from({ length: 163 }, (_, i) => `T${i}`));
  assert.equal(seen().length, 4);
});

test("a bot check answering 200 with HTML is not parsed as data", async () => {
  // Parsing a page as CSV yields confident nonsense, which is worse than a
  // refusal because nothing downstream can tell.
  serve("<html><body>Please enable JavaScript</body></html>");
  assert.equal((await stooqProvider().quotes(["NVDA"])).size, 0);
  assert.match(stooqLastError() ?? "", /page, not CSV/);
});

test("N/D for a name it does not carry is not a price", async () => {
  serve("Symbol,Date,Time,Open,High,Low,Close,Volume\nZZZZ.US,N/D,N/D,N/D,N/D,N/D,N/D,N/D");
  assert.equal((await stooqProvider().quotes(["ZZZZ"])).size, 0);
});

test("an empty close is not zero", async () => {
  // Number("") is 0, which would land on the page as a price.
  serve("Symbol,Date,Time,Open,High,Low,Close,Volume\nX.US,2026-09-09,22:00:04,1,1,1,,1");
  assert.equal((await stooqProvider().quotes(["X"])).size, 0);
});

test("a refusal degrades and says which code it was", async () => {
  serve("", 429);
  assert.equal((await stooqProvider().quotes(["NVDA"])).size, 0);
  assert.match(stooqLastError() ?? "", /429/);
  assert.deepEqual(await stooqProvider().history("NVDA", "2026-09-01"), []);
});

test("history is oldest first and skips rows without a close", async () => {
  serve(
    [
      "Date,Open,High,Low,Close,Volume",
      "2026-09-03,1,1,1,102,1",
      "2026-09-01,1,1,1,100,1",
      "2026-09-02,1,1,1,,1",
    ].join("\n")
  );
  const bars = await stooqProvider().history("NVDA", "2026-09-01");
  assert.deepEqual(
    bars.map((b) => b.date),
    ["2026-09-01", "2026-09-03"]
  );
});

test("US listings are named the way Stooq names them", () => {
  assert.equal(stooqSymbol("NVDA"), "nvda.us");
  assert.equal(stooqSymbol("BRK.B"), "brk-b.us", "a class suffix is a hyphen there");
});

test("columns are read by name, so a reordered response does not shift fields", () => {
  const rows = parseCsv("Close,Symbol\n184.22,NVDA.US");
  assert.deepEqual(rows, [{ close: "184.22", symbol: "NVDA.US" }]);
});
