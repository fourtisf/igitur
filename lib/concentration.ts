import type { Holding } from "./types";

/**
 * How concentrated a book actually is.
 *
 * Every book here ships a written case against itself, which is worth more than
 * most sites offer and still leaves the most common way to be wrong invisible.
 * A list of twenty-three names reads as diversified. If two of them are half
 * the book, it is not, and no amount of prose beside the holdings makes that as
 * plain as the number does.
 *
 * The figure that carries it is the effective number of holdings: the count of
 * *equally weighted* positions that would be as concentrated as this book is.
 * A book of twenty-three names that behaves like four is telling the reader
 * something the list cannot.
 */

export interface Concentration {
  /** Holdings counted, including ballast. */
  names: number;
  /** The count of equal positions this book is as concentrated as. */
  effectiveNames: number;
  /** Largest single holding. */
  top: { ticker: string; pct: number };
  /** Largest source — a theme, or the ballast sleeve. */
  topSource: { name: string; pct: number };
  /** Weight outside ballast: the part actually exposed to the premise. */
  atRisk: number;
  /** Holdings needed to make up half the book. */
  namesForHalf: number;
}

export function concentration(holdings: readonly Holding[]): Concentration | null {
  if (!holdings.length) return null;

  const total = holdings.reduce((s, h) => s + h.pct, 0);
  if (total <= 0) return null;

  // Renormalised, so a book whose weights were nudged still reports shares of
  // itself rather than shares of a hundred it no longer sums to.
  const shares = holdings.map((h) => (h.pct / total) * 100);

  // Herfindahl over percentage weights: 10,000 for one holding, 10,000/n for n
  // equal ones. Inverting it gives the count a reader can picture.
  const hhi = shares.reduce((s, p) => s + p * p, 0);
  const effectiveNames = hhi > 0 ? 10_000 / hhi : 0;

  let topIndex = 0;
  for (let i = 1; i < holdings.length; i++) if (shares[i] > shares[topIndex]) topIndex = i;

  const bySource = new Map<string, number>();
  holdings.forEach((h, i) => bySource.set(h.src, (bySource.get(h.src) ?? 0) + shares[i]));
  const [sourceName, sourcePct] = [...bySource].sort((a, b) => b[1] - a[1])[0];

  const atRisk = holdings.reduce((s, h, i) => (h.ballast ? s : s + shares[i]), 0);

  const sorted = [...shares].sort((a, b) => b - a);
  let acc = 0;
  let namesForHalf = 0;
  for (const p of sorted) {
    acc += p;
    namesForHalf++;
    if (acc >= 50) break;
  }

  return {
    names: holdings.length,
    effectiveNames: Math.round(effectiveNames * 10) / 10,
    top: { ticker: holdings[topIndex].t, pct: Math.round(shares[topIndex] * 10) / 10 },
    topSource: { name: sourceName, pct: Math.round(sourcePct * 10) / 10 },
    atRisk: Math.round(atRisk * 10) / 10,
    namesForHalf,
  };
}

/**
 * One sentence naming the book's own biggest weakness, chosen from the figures
 * rather than from the premise — so it cannot flatter the thesis.
 */
export function concentrationNote(c: Concentration): string {
  if (c.namesForHalf <= 2) {
    return `Half of this book is ${c.namesForHalf} name${c.namesForHalf > 1 ? "s" : ""}. If ${
      c.namesForHalf > 1 ? "they are" : "it is"
    } wrong, the rest will not save it.`;
  }
  if (c.topSource.pct >= 60) {
    return `${c.topSource.pct.toFixed(0)}% of this book is one theme. It is a bet on ${
      c.topSource.name
    }, not a spread of them.`;
  }
  if (c.effectiveNames < 6) {
    return `Twenty-odd tickers, but weighted like ${c.effectiveNames.toFixed(
      1
    )} equal ones. The list is longer than the exposure.`;
  }
  return `Weighted like ${c.effectiveNames.toFixed(
    1
  )} equal positions, with ${c.atRisk.toFixed(0)}% exposed to the premise and the rest as ballast.`;
}
