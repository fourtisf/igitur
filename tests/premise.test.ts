/**
 * The premise is the only untrusted input this product has: it comes off the
 * URL, it drives the generator, the page and the share image, and it is echoed
 * back to the reader. These pin the boundary.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { MAX_PREMISE, normalizePremise } from "../lib/premise";
import { buildBook } from "../lib/generator";
import { slugOf } from "../lib/hash";
import { bookHref, parseDrop } from "../lib/routes";
import { isPageCardId, PAGE_CARDS, pageOg } from "../lib/og-pages";

test("a premise is bounded, so one query parameter cannot buy unbounded work", () => {
  const huge = "nuclear uranium reactor ".repeat(4000);
  const out = normalizePremise(huge);
  assert.ok(out.length <= MAX_PREMISE, `got ${out.length} characters`);
});

test("truncation stays deterministic, so a shared link still rebuilds", () => {
  const long = "nuclear reactor ".repeat(80);
  const a = normalizePremise(long);
  const b = normalizePremise(long);
  assert.equal(a, b);
  assert.equal(JSON.stringify(buildBook(a)), JSON.stringify(buildBook(b)));
});

test("whitespace variants collapse to one book, not several", () => {
  const a = normalizePremise("  nuclear   restarts \n will power datacentres  ");
  assert.equal(a, "nuclear restarts will power datacentres");
  assert.equal(slugOf(a), slugOf("nuclear restarts will power datacentres"));
});

test("a missing or empty premise is handled, not crashed on", () => {
  for (const v of [undefined, "", "   ", [] as string[]]) {
    assert.equal(normalizePremise(v as string | string[] | undefined), "");
  }
  assert.equal(buildBook(normalizePremise(undefined)).ok, false);
});

test("dropped tickers are parsed defensively", () => {
  assert.deepEqual(parseDrop("nvda, tsm ,,"), ["NVDA", "TSM"]);
  assert.deepEqual(parseDrop(undefined), []);
  assert.deepEqual(parseDrop(""), []);
});

test("a book URL round-trips through its own href builder", () => {
  const p = "nuclear restarts will power datacentres";
  const href = bookHref(p, ["CCJ"]);
  const url = new URL(href, "https://example.test");
  assert.equal(url.pathname, `/b/${slugOf(p)}`);
  assert.equal(url.searchParams.get("p"), p);
  assert.deepEqual(parseDrop(url.searchParams.get("x") ?? undefined), ["CCJ"]);
});

test("share cards for pages come from a fixed allowlist", () => {
  // Free-text card rendering would let anyone mint a Premise-branded image
  // saying anything. Only these ids may render.
  assert.ok(isPageCardId("method"));
  assert.ok(isPageCardId("home"));
  assert.ok(!isPageCardId("anything-else"));
  assert.ok(!isPageCardId("__proto__"));
  assert.ok(!isPageCardId("constructor"));
  for (const [id, card] of Object.entries(PAGE_CARDS)) {
    assert.ok(card.title.trim().length > 0, `${id} has no title`);
    assert.ok(card.body.trim().length > 0, `${id} has no body`);
    // The home card has no kicker: the wordmark above it already says "Premise".
    assert.equal("kicker" in card, id !== "home", `${id} kicker`);
    assert.equal(pageOg(id as Parameters<typeof pageOg>[0]), `/api/og?page=${id}`);
  }
});
