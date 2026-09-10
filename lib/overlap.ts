import type { Holding } from "./types";

/**
 * What a book has in common with what someone already owns.
 *
 * ── Why this is the missing step ─────────────────────────────────────────────
 *
 * The site stops one move short of a decision. It will build the book that
 * expresses a belief, argue both sides of it and measure it against the index —
 * and then the reader is left holding a list with no way to know whether their
 * own portfolio already says the same thing. Half the answers to "should I act
 * on this?" are "you already have."
 *
 * ── Why it runs in the browser ───────────────────────────────────────────────
 *
 * A list of what someone owns is the most sensitive thing this site could ever
 * be handed, and /legal promises the site does not track its readers. So this
 * module is pure: it is imported by a client component, the text never leaves
 * the page, and there is no endpoint that could receive it. Nothing to store,
 * nothing to leak, nothing to promise about deletion.
 */

export interface Position {
  ticker: string;
  /** Null when the line named a holding but no size. */
  pct: number | null;
}

/** Tickers are short and upper case; anything else is a stray word. */
const TICKER = /^[A-Z][A-Z.\-]{0,7}$/;

/**
 * Reads a pasted portfolio.
 *
 * Deliberately forgiving about shape, because the input is whatever a broker's
 * export or a person's own notes happen to look like: "NVDA 12%", "NVDA, 12.5",
 * "NVDA: 12", "NVDA" alone, tabs, semicolons, blank lines and a header row.
 * Strict about what counts as a ticker, so a stray word does not become a
 * position.
 */
export function parsePortfolio(text: string): { positions: Position[]; ignored: string[] } {
  const positions: Position[] = [];
  const ignored: string[] = [];
  const seen = new Map<string, number>();

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    const parts = line.split(/[\s,;:|\t]+/).filter(Boolean);
    const ticker = (parts[0] ?? "").toUpperCase().replace(/^\$/, "");
    if (!TICKER.test(ticker)) {
      ignored.push(line.slice(0, 40));
      continue;
    }

    // The first number anywhere after the ticker is its size. A broker export
    // often puts the name in between.
    let pct: number | null = null;
    for (const p of parts.slice(1)) {
      const n = Number(p.replace(/[%$,]/g, ""));
      if (Number.isFinite(n) && n > 0) {
        pct = n;
        break;
      }
    }

    // "Symbol Weight" and "my notes here" both start with something shaped
    // exactly like a ticker, and a header row counted as a holding is a name
    // the reader does not own appearing in their own portfolio. So a line is a
    // position only if it is the ticker alone, or the ticker followed by a
    // number somewhere. Anything else is reported as skipped rather than
    // guessed at.
    if (parts.length > 1 && pct === null) {
      ignored.push(line.slice(0, 40));
      continue;
    }

    // The same name twice is one position, sized by the sum — which is what a
    // portfolio held across two accounts actually is.
    const at = seen.get(ticker);
    if (at !== undefined) {
      const existing = positions[at];
      existing.pct = existing.pct === null && pct === null ? null : (existing.pct ?? 0) + (pct ?? 0);
      continue;
    }
    seen.set(ticker, positions.length);
    positions.push({ ticker, pct });
  }

  return { positions, ignored };
}

export interface Overlap {
  /** Names in both, with each side's weight. */
  shared: { ticker: string; bookPct: number; yourPct: number | null }[];
  /** In the book, not held. Largest first — the actual shopping list. */
  missing: { ticker: string; name: string; bookPct: number }[];
  /** Held, but not in this book. */
  outside: string[];
  /** Share of the book's weight already held, 0–100. */
  bookWeightHeld: number;
  /**
   * Share of the reader's own portfolio sitting in names this book also holds,
   * 0–100. Null when the paste carried no weights at all.
   */
  yourWeightShared: number | null;
  /** What the pasted weights sum to, so a partial paste is visible as partial. */
  yourTotal: number | null;
}

export function overlapWith(holdings: readonly Holding[], positions: readonly Position[]): Overlap {
  const held = new Map(positions.map((p) => [p.ticker, p.pct]));
  const bookTotal = holdings.reduce((s, h) => s + h.pct, 0) || 1;

  const shared: Overlap["shared"] = [];
  const missing: Overlap["missing"] = [];
  let heldWeight = 0;

  for (const h of holdings) {
    if (held.has(h.t)) {
      shared.push({ ticker: h.t, bookPct: h.pct, yourPct: held.get(h.t) ?? null });
      heldWeight += h.pct;
    } else {
      missing.push({ ticker: h.t, name: h.n, bookPct: h.pct });
    }
  }
  missing.sort((a, b) => b.bookPct - a.bookPct);

  const bookTickers = new Set(holdings.map((h) => h.t));
  const outside = positions.filter((p) => !bookTickers.has(p.ticker)).map((p) => p.ticker);

  // Weights are used exactly as pasted, never rescaled to a hundred. Someone
  // who pastes half their portfolio should see a figure about half their
  // portfolio, not one silently inflated to look like all of it.
  const weighted = positions.some((p) => p.pct !== null);
  const yourTotal = weighted ? positions.reduce((s, p) => s + (p.pct ?? 0), 0) : null;
  const yourWeightShared = weighted
    ? shared.reduce((s, x) => s + (x.yourPct ?? 0), 0)
    : null;

  return {
    shared,
    missing,
    outside,
    bookWeightHeld: Math.round((heldWeight / bookTotal) * 1000) / 10,
    yourWeightShared: yourWeightShared === null ? null : Math.round(yourWeightShared * 10) / 10,
    yourTotal: yourTotal === null ? null : Math.round(yourTotal * 10) / 10,
  };
}

/**
 * One sentence saying what the overlap means for a decision. Written from the
 * figures, so it can say "you already own this" — which is the answer the site
 * has never been able to give and the one that saves a reader the most.
 */
export function overlapNote(o: Overlap, bookNames: number): string {
  if (!o.shared.length) {
    return `None of this book is in what you pasted. Whatever else is true, this is a position you do not currently have.`;
  }
  if (o.bookWeightHeld >= 70) {
    return `You already hold ${o.bookWeightHeld.toFixed(
      0
    )}% of this book by weight. Acting on it would mostly mean buying more of what you own — the belief is already expressed in your portfolio.`;
  }
  if (o.bookWeightHeld >= 30) {
    return `You hold ${o.shared.length} of ${bookNames} names, ${o.bookWeightHeld.toFixed(
      0
    )}% of the book by weight. The gap below is what this belief would actually add.`;
  }
  return `You hold ${o.shared.length} of ${bookNames} names, only ${o.bookWeightHeld.toFixed(
    0
  )}% of the book by weight. This belief is largely absent from what you pasted.`;
}
