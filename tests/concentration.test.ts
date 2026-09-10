/**
 * Concentration, in figures.
 *
 * Every book ships a written case against itself and still leaves the most
 * common way to be wrong invisible: a list of twenty-three names reads as
 * diversified whatever the weights say.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { concentration, concentrationNote } from "../lib/concentration";
import { buildBook } from "../lib/generator";
import type { Holding } from "../lib/types";

const h = (t: string, pct: number, src = "Theme", ballast = false): Holding => ({
  t,
  n: t,
  k: "Equity",
  why: "",
  pct,
  src,
  ...(ballast ? { ballast: true } : {}),
});

test("equal weights are as concentrated as their own count", () => {
  const c = concentration([h("A", 25), h("B", 25), h("C", 25), h("D", 25)]);
  assert.equal(c?.effectiveNames, 4);
  assert.equal(c?.namesForHalf, 2);
});

test("one holding is one effective holding, however many rows sit beside it", () => {
  const c = concentration([h("A", 96), h("B", 1), h("C", 1), h("D", 1), h("E", 1)]);
  assert.ok(c);
  assert.ok(c.effectiveNames <= 1.1, `five rows behaved like ${c.effectiveNames}`);
  assert.equal(c.namesForHalf, 1);
  assert.equal(c.top.ticker, "A");
});

test("weights that no longer sum to 100 report shares of the book, not of 100", () => {
  // Readers can nudge weights, so a book can arrive summing to anything.
  const c = concentration([h("A", 10), h("B", 10)]);
  assert.equal(c?.top.pct, 50, "half of this book, not ten percent of a hundred");
  assert.equal(c?.effectiveNames, 2);
});

test("ballast is counted in the book but not as exposure to the premise", () => {
  const c = concentration([h("A", 70), h("SGOV", 30, "Ballast", true)]);
  assert.equal(c?.atRisk, 70);
  assert.equal(c?.names, 2, "it is still part of the book and measured with it");
});

test("the largest source is named, ballast included when it is the largest", () => {
  const c = concentration([h("A", 20, "Compute"), h("B", 20, "Compute"), h("C", 15, "Energy")]);
  assert.equal(c?.topSource.name, "Compute");
  assert.ok(Math.abs((c?.topSource.pct ?? 0) - 72.7) < 0.2);
});

test("an empty book has no concentration rather than a divide by zero", () => {
  assert.equal(concentration([]), null);
  assert.equal(concentration([h("A", 0)]), null);
});

test("the note names the sharpest weakness the figures show", () => {
  assert.match(
    concentrationNote(concentration([h("A", 96), h("B", 4)])!),
    /Half of this book is 1 name/
  );
  // Spread evenly enough that no pair is half the book, but still one bet.
  const oneTheme = concentration([
    h("A", 20, "Compute"),
    h("B", 20, "Compute"),
    h("C", 20, "Compute"),
    h("D", 20, "Compute"),
    h("E", 20, "Energy"),
  ])!;
  assert.equal(oneTheme.namesForHalf, 3, "no two names are half of it");
  assert.match(concentrationNote(oneTheme), /one theme/);
});

test("a real book reports a concentration a reader could have guessed at", () => {
  const b = buildBook("compute is the binding constraint on artificial intelligence");
  assert.ok(b.ok);
  const c = concentration(b.holdings);
  assert.ok(c);
  assert.ok(c.effectiveNames > 1 && c.effectiveNames <= c.names, "between one and the row count");
  assert.ok(c.atRisk > 0 && c.atRisk < 100, "some of it is ballast, and it is not all ballast");
  assert.ok(c.namesForHalf >= 1 && c.namesForHalf <= c.names);
});
