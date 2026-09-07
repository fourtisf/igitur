import { BALLAST, THEMES, UNIVERSE } from "./universe";
import type { Kind } from "./types";

/**
 * A name, seen from every theme that holds it.
 *
 * The universe already carries a written reason and a conviction score for all
 * 170 asset entries, and until now none of it had anywhere to live: clicking a
 * ticker on /trending went to a theme's book, not to the name. Ten names sit in
 * more than one theme with different scores and different reasons — NVDA is 97
 * in Compute buildout and 78 in Physical labour automation — and that
 * disagreement is the most interesting thing the data has to say about them.
 */
export interface NamePosition {
  themeId: string;
  themeName: string;
  claim: string;
  risk: string;
  horizon: string;
  conviction: number;
  why: string;
}

export interface NameEntry {
  ticker: string;
  name: string;
  kind: Kind;
  /** Every theme that can give this name weight, best conviction first. */
  positions: NamePosition[];
  /** True for the treasury and commodity sleeves, which no theme selects. */
  ballast: boolean;
  ballastWhy?: string;
}

const byTicker = new Map<string, NameEntry>();

for (const th of THEMES) {
  for (const a of th.assets) {
    const entry = byTicker.get(a.t) ?? {
      ticker: a.t,
      name: a.n,
      kind: a.k,
      positions: [],
      ballast: false,
    };
    entry.positions.push({
      themeId: th.id,
      themeName: th.name,
      claim: th.claim,
      risk: th.risk,
      horizon: th.horizon,
      conviction: a.c,
      why: a.why,
    });
    byTicker.set(a.t, entry);
  }
}

for (const b of BALLAST) {
  const entry = byTicker.get(b.t) ?? {
    ticker: b.t,
    name: b.n,
    kind: b.k,
    positions: [],
    ballast: true,
  };
  entry.ballast = true;
  entry.ballastWhy = b.why;
  byTicker.set(b.t, entry);
}

for (const e of byTicker.values()) {
  e.positions.sort((a, b) => b.conviction - a.conviction);
}

export const NAME_BY_TICKER = byTicker;

/** Every name with a page, alphabetical. The benchmark has none — it is not holdable here. */
export const NAMES_INDEX: NameEntry[] = [...byTicker.values()].sort((a, b) =>
  a.ticker.localeCompare(b.ticker)
);

export function nameHref(ticker: string): string {
  return `/name/${ticker.toLowerCase()}`;
}

export function lookupName(slug: string): NameEntry | null {
  return NAME_BY_TICKER.get(slug.toUpperCase()) ?? null;
}

/** Sanity: the benchmark is in UNIVERSE but is never a holding. */
export const BENCHMARK = UNIVERSE.find((u) => u.theme === "Benchmark")?.t ?? "SPY";
