/**
 * The last real price, kept across a restart.
 *
 * Written after a deployment spent hours on generated figures: throttled by
 * the keyless source, holding a rejected key for the paid one, and restarting
 * on every deploy so nothing it had ever fetched survived. A price that was
 * real forty minutes ago is still a real price.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { forgetStore, remember, remembered } from "../lib/market/store";
import type { Quote } from "../lib/market/types";

const quote = (ticker: string, over: Partial<Quote> = {}): Quote => ({
  ticker,
  price: 184.22,
  changePct: 2.41,
  marketCap: 4490,
  previousClose: 179.88,
  open: 180.5,
  asOf: "2026-09-09T17:42:00.000Z",
  synthetic: false,
  ...over,
});

function freshStore(): string {
  const path = join(mkdtempSync(join(tmpdir(), "igitur-store-")), "quotes.json");
  process.env.MARKET_CACHE_PATH = path;
  forgetStore();
  return path;
}

test("a real quote is kept, with the moment it actually carries", () => {
  freshStore();
  remember([quote("NVDA")]);
  forgetStore(); // as a deploy would: same file, new process

  const back = remembered("nvda");
  assert.ok(back);
  assert.equal(back.price, 184.22);
  assert.equal(back.asOf, "2026-09-09T17:42:00.000Z", "the timestamp is not refreshed by storing it");
  assert.equal(back.synthetic, false);
});

test("a generated figure is never stored", () => {
  // Otherwise one bad hour would be preserved and served back as real for days.
  freshStore();
  remember([quote("FAKE", { synthetic: true })]);
  forgetStore();
  assert.equal(remembered("FAKE"), null);
});

test("a quote older than a long weekend is dropped rather than shown", () => {
  const path = freshStore();
  writeFileSync(
    path,
    JSON.stringify({
      OLD: { at: Date.now() - 5 * 24 * 60 * 60_000, quote: quote("OLD") },
      NEW: { at: Date.now() - 60_000, quote: quote("NEW") },
    })
  );
  forgetStore();
  assert.equal(remembered("OLD"), null, "last week's price must not pass as today's");
  assert.ok(remembered("NEW"));
});

test("a file claiming a synthetic figure is real is not believed", () => {
  const path = freshStore();
  writeFileSync(
    path,
    JSON.stringify({ X: { at: Date.now(), quote: { ...quote("X"), synthetic: true } } })
  );
  forgetStore();
  assert.equal(remembered("X"), null);
});

test("a corrupt file costs the cache, not the page", () => {
  const path = freshStore();
  writeFileSync(path, "{ this is not json");
  forgetStore();
  assert.equal(remembered("NVDA"), null);
  // And it recovers: the next write replaces it.
  remember([quote("NVDA")]);
  forgetStore();
  assert.equal(remembered("NVDA")?.price, 184.22);
});

test("the file is written whole, never half", () => {
  // A render reading a half-written file would be worse than reading none.
  const path = freshStore();
  remember([quote("A"), quote("B"), quote("C")]);
  const parsed = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  assert.deepEqual(Object.keys(parsed).sort(), ["A", "B", "C"]);
});

test("nothing is written when there is nothing real to write", () => {
  const path = freshStore();
  remember([quote("S", { synthetic: true })]);
  assert.throws(() => readFileSync(path, "utf8"), "no file was created for a synthetic-only round");
});
