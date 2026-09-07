/**
 * Core data model. See HANDOFF.md §7.
 *
 * These shapes are the contract between the universe data, the generator
 * and every view. The generator is pure: given a premise and this data it
 * returns the same book on any machine, which is what makes a shared URL
 * work with no database behind it.
 */

export type Risk = "Speculative" | "Aggressive" | "Moderate" | "Conservative";

export type Kind = "Equity" | "ETF" | "Crypto" | "Treasury" | "Commodity";

export interface Asset {
  /** Ticker. Stable, and the key used to drop a holding from a book. */
  t: string;
  /** Display name. */
  n: string;
  /** Instrument kind. */
  k: Kind;
  /** Conviction, 0–100. Editorial judgement today — see HANDOFF.md §7. */
  c: number;
  /** One sentence stating why this name carries the thesis. */
  why: string;
}

export interface Theme {
  /** Stable id, used in URLs. */
  id: string;
  name: string;
  risk: Risk;
  horizon: string;
  /** Must be matchable by this theme's own keyword list — see tests. */
  claim: string;
  forCase: string;
  againstCase: string;
  /** Positive keywords: pull a premise toward this theme. */
  kw: string[];
  /** Negative keywords: push a premise away from it. */
  neg: string[];
  assets: Asset[];
}

/** A treasury or commodity sleeve appended to every book. */
export interface BallastEntry {
  t: string;
  n: string;
  k: Kind;
  why: string;
}

export interface Holding {
  t: string;
  n: string;
  k: Kind;
  why: string;
  /** Weight as a percentage, one decimal place. */
  pct: number;
  /** Theme this holding came from, or "Ballast". */
  src: string;
  /** True for the single largest risky holding. Always from the primary theme. */
  lead?: boolean;
  /** True for the treasury/commodity sleeve. */
  ballast?: boolean;
  /** True if the 27% cap bound this holding. */
  capped?: boolean;
}

export interface Book {
  ok: true;
  premise: string;
  theme: Theme;
  second: Theme | null;
  holdings: Holding[];
  risk: Risk;
  horizon: string;
  /** 0–96. Below 50 the UI warns and lists what actually matched. */
  confidence: number;
  /** The keywords that actually matched. Shown when confidence is low. */
  hits: string[];
  seed: number;
  drop: string[];
  /**
   * Themes that scored but did not lead, and are not the secondary. Shown on
   * the book page so a reader can see what the matcher weighed and rejected.
   */
  alternatives: { id: string; name: string; score: number; hits: string[] }[];
  /**
   * True when the reader has set weights by hand. An edited book keeps every
   * other invariant but may be led by a holding the generator did not choose.
   */
  edited?: boolean;
}

export interface NoBook {
  ok: false;
  premise: string;
  /** True when the premise matched but every holding was dropped by hand. */
  emptied?: boolean;
}

/**
 * A refusal is a valid, shippable outcome — HANDOFF.md §13. The app does not
 * improvise a portfolio out of adjacent vocabulary.
 */
export type BookResult = Book | NoBook;

/** An entry in the published universe. */
export interface UniverseEntry {
  t: string;
  n: string;
  k: Kind;
  theme: string;
}
