/**
 * Whether the reader already owns the belief.
 *
 * The site would build a book, argue both sides and measure it against the
 * index, then stop one move short of the decision. Half the honest answers to
 * "should I act on this?" are "you already have."
 */
import test from "node:test";
import assert from "node:assert/strict";

import { overlapNote, overlapWith, parsePortfolio } from "../lib/overlap";
import type { Holding } from "../lib/types";

const h = (t: string, pct: number): Holding => ({ t, n: t, k: "Equity", why: "", pct, src: "T" });

const BOOK = [h("NVDA", 20), h("TSM", 15), h("ASML", 10), h("AVGO", 5), h("SGOV", 50)];

// ── Reading whatever a person happens to paste ───────────────────────────────

test("the shapes a broker export and a person's notes actually take", () => {
  const { positions } = parsePortfolio(
    ["NVDA 12%", "TSM, 8", "ASML: 4.5", "AVGO\t3", "SGOV"].join("\n")
  );
  assert.deepEqual(positions, [
    { ticker: "NVDA", pct: 12 },
    { ticker: "TSM", pct: 8 },
    { ticker: "ASML", pct: 4.5 },
    { ticker: "AVGO", pct: 3 },
    { ticker: "SGOV", pct: null },
  ]);
});

test("a name written with the company in between still finds its size", () => {
  const { positions } = parsePortfolio("NVDA Nvidia Corp 12.5%");
  assert.deepEqual(positions, [{ ticker: "NVDA", pct: 12.5 }]);
});

test("a header row is not a holding, and the skip is reported", () => {
  // "Symbol Weight" starts with something shaped exactly like a ticker. Counted
  // as a position it would put a name the reader does not own into their own
  // portfolio. Silently dropping a real holding would be worse still, so the
  // caller is told how many lines were skipped.
  const { positions, ignored } = parsePortfolio("Symbol Weight\nNVDA 12\n\nmy notes here");
  assert.deepEqual(
    positions.map((p) => p.ticker),
    ["NVDA"]
  );
  assert.equal(ignored.length, 2);
});

test("a ticker with no size is a holding; a ticker with words but no size is not", () => {
  // The rule that separates them, stated once: alone, or followed by a number.
  assert.deepEqual(parsePortfolio("SGOV").positions, [{ ticker: "SGOV", pct: null }]);
  assert.deepEqual(parsePortfolio("NVDA Nvidia Corp").positions, []);
});

test("a dollar sign in front of a ticker is how half of X writes them", () => {
  assert.deepEqual(parsePortfolio("$NVDA 12").positions, [{ ticker: "NVDA", pct: 12 }]);
});

test("the same name twice is one position, sized by the sum", () => {
  // Which is what a holding split across two accounts actually is.
  assert.deepEqual(parsePortfolio("NVDA 5\nNVDA 7").positions, [{ ticker: "NVDA", pct: 12 }]);
});

// ── The comparison ───────────────────────────────────────────────────────────

test("weight held is measured against the book, not against the name count", () => {
  // Holding one name out of five can still be half the book.
  const o = overlapWith(BOOK, parsePortfolio("SGOV 40").positions);
  assert.equal(o.shared.length, 1);
  assert.equal(o.bookWeightHeld, 50, "one name, half the book");
});

test("the shopping list is what is missing, largest first", () => {
  const o = overlapWith(BOOK, parsePortfolio("SGOV 40").positions);
  assert.deepEqual(
    o.missing.map((m) => m.ticker),
    ["NVDA", "TSM", "ASML", "AVGO"]
  );
});

test("names held outside the book are counted, not ignored", () => {
  const o = overlapWith(BOOK, parsePortfolio("NVDA 10\nKO 5\nPEP 5").positions);
  assert.deepEqual(o.outside, ["KO", "PEP"]);
});

test("pasted weights are used as given, never rescaled to a hundred", () => {
  // Someone pasting half their portfolio should see a figure about half their
  // portfolio, not one silently inflated to look like all of it.
  const o = overlapWith(BOOK, parsePortfolio("NVDA 10\nTSM 5").positions);
  assert.equal(o.yourWeightShared, 15);
  assert.equal(o.yourTotal, 15, "and the partial paste is visible as partial");
});

test("a paste with no sizes still answers the name question", () => {
  const o = overlapWith(BOOK, parsePortfolio("NVDA\nTSM").positions);
  assert.equal(o.shared.length, 2);
  assert.equal(o.bookWeightHeld, 35);
  assert.equal(o.yourWeightShared, null, "no weights in, no weight figure out");
  assert.equal(o.yourTotal, null);
});

test("a book whose weights were nudged still reports shares of itself", () => {
  const nudged = [h("A", 30), h("B", 30)]; // sums to 60, not 100
  const o = overlapWith(nudged, parsePortfolio("A 1").positions);
  assert.equal(o.bookWeightHeld, 50);
});

// ── What it tells the reader to do ───────────────────────────────────────────

test("holding most of the book is told plainly, because it changes the decision", () => {
  const o = overlapWith(BOOK, parsePortfolio("NVDA 1\nTSM 1\nSGOV 1").positions);
  assert.match(overlapNote(o, BOOK.length), /already hold 85% of this book/);
});

test("holding none of it is the other answer worth having", () => {
  const o = overlapWith(BOOK, parsePortfolio("KO 10").positions);
  assert.match(overlapNote(o, BOOK.length), /None of this book/);
});

test("a partial overlap points at the gap rather than at the total", () => {
  const o = overlapWith(BOOK, parsePortfolio("NVDA 1\nTSM 1").positions);
  assert.match(overlapNote(o, BOOK.length), /2 of 5 names/);
});
