/**
 * Reader-set weights. The generator's invariants (HANDOFF.md §13) must survive
 * a reader editing the book, or "remove and reweight" becomes a way to produce
 * a portfolio the site's own rules would reject.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { buildBook } from "../lib/generator";
import { applyPins, formatPins, MAX_PCT, MIN_PCT, parsePins } from "../lib/reweight";
import { THEMES } from "../lib/universe";
import type { Book } from "../lib/types";

const PREMISES = [
  "nuclear restarts will power datacentres",
  "copper supply cannot keep up with electrification",
  ...THEMES.slice(0, 10).map((t) => t.claim),
];

const generated = (p: string): Book => {
  const b = buildBook(p);
  assert.ok(b.ok, p);
  return b;
};

const riskyTickers = (b: Book) => b.holdings.filter((h) => !h.ballast).map((h) => h.t);

test("pins are parsed defensively and clamped to the published limits", () => {
  const known = new Set(["NVDA", "TSM"]);
  assert.deepEqual([...parsePins("NVDA:12,TSM:8", known)], [["NVDA", 12], ["TSM", 8]]);
  // Unknown tickers, junk numbers and out-of-range values cannot get through.
  assert.deepEqual([...parsePins("ZZZZ:12", known)], []);
  assert.deepEqual([...parsePins("NVDA:abc", known)], []);
  assert.deepEqual([...parsePins("NVDA:99", known)], [["NVDA", MAX_PCT]]);
  assert.deepEqual([...parsePins("NVDA:0", known)], [["NVDA", MIN_PCT]]);
  assert.deepEqual([...parsePins(undefined, known)], []);
});

test("pins round-trip through the URL form", () => {
  const known = new Set(["NVDA", "TSM"]);
  const pins = parsePins("NVDA:12,TSM:8", known);
  assert.deepEqual([...parsePins(formatPins(pins), known)], [...pins]);
});

test("an edited book still totals exactly 100.0%", () => {
  for (const p of PREMISES) {
    const b = generated(p);
    const t = riskyTickers(b);
    for (const pins of [
      new Map([[t[0], 10]]),
      new Map([[t[0], MAX_PCT]]),
      new Map([[t[t.length - 1], MAX_PCT]]),
      new Map([[t[0], MIN_PCT], [t[1], MIN_PCT]]),
    ]) {
      const e = applyPins(b, pins);
      const total = e.holdings.reduce((s, h) => s + h.pct, 0);
      assert.equal(Math.round(total * 10) / 10, 100, `${p} with ${formatPins(pins)} totalled ${total}`);
    }
  }
});

test("an edited book keeps the 5% floor and the 27% cap", () => {
  for (const p of PREMISES) {
    const b = generated(p);
    const t = riskyTickers(b);
    // Ask for far more than the book can give, on several holdings at once.
    const greedy = new Map(t.slice(0, 3).map((x) => [x, MAX_PCT]));
    const e = applyPins(b, greedy);
    for (const h of e.holdings) {
      if (h.ballast) continue;
      assert.ok(h.pct >= MIN_PCT - 0.05, `${p}: ${h.t} fell to ${h.pct}%`);
      assert.ok(h.pct <= MAX_PCT + 0.05, `${p}: ${h.t} reached ${h.pct}%`);
    }
  }
});

test("editing never changes which names are held, only their sizes", () => {
  for (const p of PREMISES) {
    const b = generated(p);
    const t = riskyTickers(b);
    const e = applyPins(b, new Map([[t[0], 8]]));
    assert.deepEqual(
      e.holdings.map((h) => h.t).sort(),
      b.holdings.map((h) => h.t).sort(),
      `${p}: the set of holdings moved`
    );
  }
});

test("the ballast sleeve cannot be moved by a reader", () => {
  // Its share is a function of the theme's risk level. Letting it be edited
  // would quietly change what the book claims about its own risk.
  for (const p of PREMISES) {
    const b = generated(p);
    const ballast = b.holdings.filter((h) => h.ballast);
    const e = applyPins(b, new Map([[ballast[0].t, 25], [riskyTickers(b)[0], 8]]));
    const after = e.holdings.filter((h) => h.ballast);
    assert.deepEqual(
      after.map((h) => [h.t, h.pct]),
      ballast.map((h) => [h.t, h.pct]),
      `${p}: ballast moved`
    );
  }
});

test("an edited book has exactly one lead, and it is the largest holding", () => {
  for (const p of PREMISES) {
    const b = generated(p);
    const t = riskyTickers(b);
    const e = applyPins(b, new Map([[t[t.length - 1], MAX_PCT]]));
    const leads = e.holdings.filter((h) => h.lead);
    assert.equal(leads.length, 1, p);
    const risky = e.holdings.filter((h) => !h.ballast);
    assert.equal(leads[0].pct, Math.max(...risky.map((h) => h.pct)), p);
  }
});

test("editing is marked, so an edited book never passes as generated", () => {
  const b = generated(PREMISES[0]);
  assert.ok(!b.edited);
  assert.ok(applyPins(b, new Map([[riskyTickers(b)[0], 10]])).edited);
  // No pins is not an edit.
  assert.equal(applyPins(b, new Map()), b);
});

test("the same pins produce the same book, so an adjusted URL still rebuilds", () => {
  for (const p of PREMISES.slice(0, 6)) {
    const pins = new Map([[riskyTickers(generated(p))[0], 11]]);
    const a = JSON.stringify(applyPins(generated(p), new Map(pins)));
    const c = JSON.stringify(applyPins(generated(p), new Map(pins)));
    assert.equal(a, c, p);
  }
});

test("weights stay clean one-decimal figures after editing", () => {
  for (const p of PREMISES) {
    const b = generated(p);
    const e = applyPins(b, new Map([[riskyTickers(b)[0], 13]]));
    for (const h of e.holdings) {
      assert.equal(Math.round(h.pct * 10) / 10, h.pct, `${p}: ${h.t} is ${h.pct}`);
    }
  }
});
