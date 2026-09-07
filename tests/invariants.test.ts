/**
 * The invariants from HANDOFF.md §13. Every one of these was a bug that
 * testing caught. They run in CI.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { buildBook, RISK_BALLAST } from "../lib/generator";
import { THEMES, UNIVERSE } from "../lib/universe";
import type { Book } from "../lib/types";

/** A broad corpus: every theme claim plus phrasings a reader would actually type. */
const PREMISES: string[] = [
  ...THEMES.map((t) => t.claim),
  "drones will replace delivery vans in cities",
  "compute is the binding constraint on AI, not model design",
  "banks will be disintermediated by stablecoin rails",
  "copper supply cannot keep up with electrification",
  "nuclear restarts will power datacentres",
  "obesity drugs change the food industry",
  "machines will do the manual labour in warehouses",
  "water scarcity reshapes agriculture",
  "defense spending rises across europe",
  "medicine keeps people healthy for longer",
  "security breaches will get worse every year",
];
for (const th of THEMES) {
  for (const k of th.kw.slice(0, 4)) {
    PREMISES.push(`${k} will reshape the next decade`);
  }
}

const books = (): Book[] =>
  PREMISES.map((p) => buildBook(p)).filter((b): b is Book => b.ok);

test("weights total exactly 100.0% after rounding, every time", () => {
  for (const b of books()) {
    const total = b.holdings.reduce((s, h) => s + h.pct, 0);
    assert.equal(
      Math.round(total * 10) / 10,
      100,
      `${b.premise} totalled ${total}`
    );
  }
});

test("the lead position always comes from the primary theme, never the secondary", () => {
  for (const b of books()) {
    const lead = b.holdings.find((h) => h.lead);
    assert.ok(lead, `${b.premise} has no lead`);
    assert.equal(lead.src, b.theme.name, `${b.premise} led by ${lead.src}`);
    assert.ok(!lead.ballast, `${b.premise} led by ballast`);
    // The lead is also the largest risky holding.
    const risky = b.holdings.filter((h) => !h.ballast);
    assert.equal(lead.pct, Math.max(...risky.map((h) => h.pct)));
  }
});

test("exactly one lead position per book", () => {
  for (const b of books()) {
    assert.equal(b.holdings.filter((h) => h.lead).length, 1, b.premise);
  }
});

test("no duplicate tickers in one book", () => {
  for (const b of books()) {
    const t = b.holdings.map((h) => h.t);
    assert.equal(new Set(t).size, t.length, `${b.premise}: ${t.join(",")}`);
  }
});

test("no risky holding below 5% (ballast may be lower)", () => {
  for (const b of books()) {
    for (const h of b.holdings) {
      if (h.ballast) continue;
      assert.ok(h.pct >= 5, `${b.premise}: ${h.t} at ${h.pct}%`);
    }
  }
});

test("no holding above 27%", () => {
  for (const b of books()) {
    for (const h of b.holdings) {
      assert.ok(h.pct <= 27, `${b.premise}: ${h.t} at ${h.pct}%`);
    }
  }
});

test("every theme claim builds its own theme", () => {
  // Healthspan, Robotics and Cyber each failed this during development,
  // because their claims used words their own keyword lists did not contain.
  for (const th of THEMES) {
    const b = buildBook(th.claim);
    assert.ok(b.ok, `${th.id}: own claim produced no match`);
    assert.equal(b.theme.id, th.id, `${th.id}: claim resolved to ${b.theme.id}`);
  }
});

test("same premise produces an identical book, always", () => {
  for (const p of PREMISES) {
    const a = JSON.stringify(buildBook(p));
    for (let i = 0; i < 3; i++) {
      assert.equal(JSON.stringify(buildBook(p)), a, p);
    }
  }
});

test("matched:false is a valid, shippable outcome", () => {
  for (const p of ["my cat is very fluffy", "the weather tomorrow looks pleasant", "", "   "]) {
    assert.equal(buildBook(p).ok, false, `expected refusal for ${JSON.stringify(p)}`);
  }
});

test("a book only ever holds names from the published universe", () => {
  const known = new Set(UNIVERSE.map((u) => u.t));
  for (const b of books()) {
    for (const h of b.holdings) {
      assert.ok(known.has(h.t), `${b.premise}: ${h.t} is not in the universe`);
    }
  }
});

test("every book carries exactly one ballast sleeve, sized by risk", () => {
  for (const b of books()) {
    const bal = b.holdings.filter((h) => h.ballast);
    assert.equal(bal.length, 1, b.premise);
    // Last in the ordering.
    assert.ok(b.holdings[b.holdings.length - 1].ballast, b.premise);
    const want = RISK_BALLAST[b.risk] * 100;
    // The 100% correction lands on holdings[0], so ballast is untouched.
    assert.ok(
      Math.abs(bal[0].pct - want) < 0.11,
      `${b.premise}: ${b.risk} ballast ${bal[0].pct}%, expected ${want}%`
    );
  }
});

test("books hold between 5 and 8 names", () => {
  for (const b of books()) {
    assert.ok(
      b.holdings.length >= 5 && b.holdings.length <= 8,
      `${b.premise}: ${b.holdings.length} holdings`
    );
  }
});

test("risky holdings are ordered by weight, ballast last", () => {
  for (const b of books()) {
    const risky = b.holdings.filter((h) => !h.ballast);
    for (let i = 1; i < risky.length; i++) {
      assert.ok(risky[i - 1].pct >= risky[i].pct, b.premise);
    }
  }
});

test("removing a holding reweights the book and keeps every invariant", () => {
  for (const p of PREMISES.slice(0, 30)) {
    const first = buildBook(p);
    if (!first.ok) continue;
    const victim = first.holdings.find((h) => !h.ballast)!.t;
    const after = buildBook(p, [victim]);
    if (!after.ok) continue;
    assert.ok(!after.holdings.some((h) => h.t === victim), `${p}: ${victim} survived`);
    const total = after.holdings.reduce((s, h) => s + h.pct, 0);
    assert.equal(Math.round(total * 10) / 10, 100, p);
    assert.equal(after.holdings.filter((h) => h.lead).length, 1, p);
  }
});

test("every weight is a clean one-decimal figure", () => {
  for (const b of books()) {
    for (const h of b.holdings) {
      assert.equal(Math.round(h.pct * 10) / 10, h.pct, `${b.premise}: ${h.t} ${h.pct}`);
    }
  }
});

test("confidence stays in range and a weak match is flagged", () => {
  for (const b of books()) {
    assert.ok(b.confidence > 0 && b.confidence <= 96, `${b.premise}: ${b.confidence}`);
  }
  // A single weak keyword must land below the 50 threshold that triggers the
  // orange warning. That warning is the honest signal; keep it reachable.
  const weak = buildBook("wafer");
  assert.ok(weak.ok);
  assert.ok(weak.confidence < 50, `expected a low-confidence match, got ${weak.confidence}`);
});
