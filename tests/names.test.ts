/**
 * The per-name pages. 163 URLs built entirely from data that already existed,
 * so the tests are about completeness and about not leaking a name that is not
 * in the published universe.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { lookupName, nameHref, NAMES_INDEX } from "../lib/names";
import { BALLAST, THEMES, UNIVERSE } from "../lib/universe";

test("every name a book can hold has a page", () => {
  const holdable = new Set([
    ...THEMES.flatMap((t) => t.assets.map((a) => a.t)),
    ...BALLAST.map((b) => b.t),
  ]);
  for (const t of holdable) {
    assert.ok(lookupName(t), `${t} can be held but has no page`);
  }
  assert.equal(NAMES_INDEX.length, holdable.size);
});

test("the benchmark has no page — it is not something a book holds", () => {
  assert.equal(lookupName("SPY"), null);
  assert.ok(UNIVERSE.some((u) => u.t === "SPY"));
});

test("lookup is case-insensitive, and nothing outside the universe resolves", () => {
  assert.ok(lookupName("nvda"));
  assert.ok(lookupName("NVDA"));
  for (const bad of ["", "ZZZZ", "../../etc/passwd", "__proto__", "constructor"]) {
    assert.equal(lookupName(bad), null, `resolved ${JSON.stringify(bad)}`);
  }
});

test("a name carries every theme that can give it weight, best conviction first", () => {
  for (const n of NAMES_INDEX) {
    for (let i = 1; i < n.positions.length; i++) {
      assert.ok(n.positions[i - 1].conviction >= n.positions[i].conviction, n.ticker);
    }
    // Non-ballast names must have at least one theme, or the page is empty.
    if (!n.ballast) assert.ok(n.positions.length >= 1, `${n.ticker} has no theme`);
    for (const p of n.positions) {
      assert.ok(p.why.trim().length > 15, `${n.ticker} in ${p.themeId} has no reason`);
      assert.ok(p.conviction > 0 && p.conviction <= 100, `${n.ticker} ${p.conviction}`);
    }
  }
});

test("names held by more than one theme keep a distinct reason in each", () => {
  // This disagreement is the most interesting thing the data says about them,
  // and it is the reason these pages are worth having at all.
  const multi = NAMES_INDEX.filter((n) => n.positions.length > 1);
  assert.ok(multi.length >= 5, `only ${multi.length} names span themes`);
  for (const n of multi) {
    const reasons = n.positions.map((p) => p.why);
    assert.equal(new Set(reasons).size, reasons.length, `${n.ticker} repeats a reason`);
  }
});

test("every page URL is lowercase and safe to route", () => {
  for (const n of NAMES_INDEX) {
    const href = nameHref(n.ticker);
    assert.equal(href, href.toLowerCase());
    assert.match(href, /^\/name\/[a-z0-9.-]+$/, href);
    assert.ok(lookupName(href.split("/").pop()!), `${href} does not resolve back`);
  }
});
