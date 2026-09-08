/**
 * THE GENERATOR — HANDOFF.md §3. This is the core IP.
 *
 * Every constant in here was tuned and regression-tested. The invariants it
 * guarantees are listed in HANDOFF.md §13 and enforced in tests/. Read both
 * before changing a number.
 *
 * Two properties are deliberate and must survive any rewrite:
 *   - It refuses. `ok: false` is a valid, shippable outcome. The app does not
 *     improvise a portfolio out of adjacent vocabulary.
 *   - It is deterministic. Same premise, same book, on any machine.
 */

import { BALLAST, THEMES } from "./universe";
import { fnv, rng } from "./hash";
import type { Book, BookResult, Holding, Risk, Theme } from "./types";

/**
 * The minimum a theme needs to be scored. The full Theme satisfies it, and so
 * does the trimmed index the composer ships to the browser — one scorer, so the
 * live feedback in the composer can never disagree with the book it produces.
 */
export interface MatchableTheme {
  id: string;
  kw: string[];
  neg: string[];
}

export interface ThemeScore<T extends MatchableTheme = Theme> {
  th: T;
  score: number;
  /** The keywords that actually matched. Drives the confidence figure. */
  hits: string[];
  /** Index of the earliest matched keyword. The tie-break. */
  first: number;
}

/** Ballast share by risk level. HANDOFF.md §3.2. */
export const RISK_BALLAST: Record<Risk, number> = {
  Speculative: 0.06,
  Aggressive: 0.1,
  Moderate: 0.16,
  Conservative: 0.22,
};

/** Weight spread exponent. At 1.0 the book is nearly equal-weighted, which
 *  contradicts the entire pitch. 2.8 gives a 2–3.5x spread top to bottom. */
const CONVICTION_EXPONENT = 2.8;
/** A secondary theme's convictions are discounted so it can never take the
 *  lead position. Without it a nuclear premise mentioning "datacentre" came
 *  back led by NVDA instead of Cameco. */
const SECONDARY_DISCOUNT = 0.7;
/** Below this a holding is unreadable on the allocation bar. */
const MIN_WEIGHT = 0.05;
/** No single holding may dominate the book. */
const MAX_WEIGHT = 0.27;

function escapeRe(s: string): string {
  return s.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
}

/**
 * Score every theme against the premise. HANDOFF.md §3.1.
 *
 * Four rules here exist because of bugs found in testing. Do not remove them:
 *  1. Word-boundary matching, not substring. Naive substring matching made the
 *     two-letter keyword "ai" match inside "rails", sending a premise about
 *     ledgers to the compute theme.
 *  2. Substring credit only for keywords of 6+ characters. Same reason.
 *  3. One credit per sentence position, so a list holding both "bank" and
 *     "banks" cannot score the same word twice.
 *  4. Negative keywords. Without them "drones will replace delivery vans"
 *     resolved to Palantir and Northrop Grumman.
 */
export function scoreThemes<T extends MatchableTheme>(
  text: string,
  themes: readonly T[] = THEMES as unknown as readonly T[]
): ThemeScore<T>[] {
  const q =
    " " +
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .replace(/\s+/g, " ") +
    " ";

  return themes.map((th): ThemeScore<T> => {
    let s = 0;
    const hits: string[] = [];
    const seen: Record<number, 1> = {};

    for (const k of th.kw) {
      // Whole word, tolerating a plural.
      const re = new RegExp("(^|[^a-z0-9])" + escapeRe(k) + "(e?s)?([^a-z0-9]|$)");
      const mm = re.exec(q);
      if (mm) {
        const at = mm.index + mm[1].length;
        if (!seen[at]) {
          seen[at] = 1;
          // A multi-word keyword is a much stronger signal than a single word.
          s += k.includes(" ") ? 6 : 3;
          hits.push(k);
        }
      } else if (k.length >= 6 && q.includes(k)) {
        s += 1;
      }
    }

    for (const k of th.neg) {
      if (q.includes(k)) s -= 7;
    }

    // Earliest matched keyword: on a tie the subject of the sentence usually
    // appears before the modifier ("copper supply ... electrification").
    let first = 1e9;
    for (const k of hits) {
      const i = q.indexOf(k);
      if (i > -1 && i < first) first = i;
    }
    if (first === 1e9) {
      for (const k of th.kw) {
        if (k.length < 6) continue;
        const i = q.indexOf(k);
        if (i > -1 && i < first) first = i;
      }
    }

    return { th, score: Math.max(0, s), hits, first };
  }).sort((a, b) => (b.score !== a.score ? b.score - a.score : a.first - b.first));
}

/**
 * Build the book. HANDOFF.md §3.2.
 *
 * @param premise  the user's sentence
 * @param drop     tickers the reader removed by hand; the book reweights around them
 */
/**
 * @param universe the themes to match against. Defaults to the published
 *        universe, and exists so the fidelity test can run this algorithm over
 *        the prototype's own data. That separates the two questions it must not
 *        confuse: did the code drift, and did the data change. The universe is
 *        meant to grow — v2 added vocabulary — and a test welded to v1 data
 *        would have made growing it look like a regression.
 */
export function buildBook(
  premise: string,
  drop: string[] = [],
  universe: readonly Theme[] = THEMES
): BookResult {
  const ranked = scoreThemes(premise, universe);

  // Refusing is a correct answer. Keep it.
  if (!ranked[0] || ranked[0].score === 0) {
    return { ok: false, premise };
  }

  const primary = ranked[0].th;
  const secondary =
    ranked[1] && ranked[1].score >= Math.max(3, ranked[0].score * 0.55)
      ? ranked[1].th
      : null;

  const seed = fnv(premise.trim().toLowerCase());
  const rand = rng(seed);

  type Picked = {
    t: string;
    n: string;
    k: Holding["k"];
    c: number;
    why: string;
    src: string;
    w: number;
    capped?: boolean;
  };

  const picked: Picked[] = [];
  const takeP = secondary ? 5 : 6;

  primary.assets
    .slice()
    .sort((a, b) => b.c - a.c)
    .filter((a) => !drop.includes(a.t))
    .slice(0, takeP)
    .forEach((a) => picked.push({ ...a, src: primary.name, w: 0 }));

  if (secondary) {
    secondary.assets
      .slice()
      .sort((a, b) => b.c - a.c)
      .filter((a) => !drop.includes(a.t))
      .slice(0, 2)
      .forEach((a) => {
        // No duplicate tickers in one book.
        if (picked.some((p) => p.t === a.t)) return;
        picked.push({
          ...a,
          src: secondary.name,
          c: Math.round(a.c * SECONDARY_DISCOUNT),
          w: 0,
        });
      });
  }

  if (!picked.length) return { ok: false, premise, emptied: true };

  const ballastShare = RISK_BALLAST[primary.risk] ?? 0.12;
  const risky = 1 - ballastShare;

  function spread(list: Picked[], budget: number) {
    const pw = list.map((a) => Math.pow(a.c / 100, CONVICTION_EXPONENT));
    const sum = pw.reduce((x, y) => x + y, 0);
    list.forEach((a, i) => {
      a.w = (pw[i] / sum) * budget;
    });
  }

  spread(picked, risky);

  // Drop anything unreadable on the bar, then re-spread across what is left.
  let list = picked;
  const kept = list.filter((a) => a.w >= MIN_WEIGHT);
  if (kept.length >= 4) {
    list = kept;
    spread(list, risky);
  }

  // Cap, then redistribute the excess proportionally across the uncapped.
  let excess = 0;
  for (const a of list) {
    if (a.w > MAX_WEIGHT) {
      excess += a.w - MAX_WEIGHT;
      a.w = MAX_WEIGHT;
      a.capped = true;
    }
  }
  if (excess > 0) {
    const room = list.filter((a) => !a.capped);
    const rsum = room.reduce((x, a) => x + a.w, 0);
    if (rsum > 0) for (const a of room) a.w += excess * (a.w / rsum);
  }

  const bal =
    BALLAST[
      primary.risk === "Speculative" ? 0 : primary.risk === "Conservative" ? 2 : rand() > 0.5 ? 0 : 1
    ];

  const holdings: Holding[] = list
    .map((a): Holding => ({
      t: a.t, n: a.n, k: a.k, why: a.why, src: a.src, pct: 0, capped: a.capped,
    }))
    .concat([
      { t: bal.t, n: bal.n, k: bal.k, why: bal.why, src: "Ballast", ballast: true, pct: 0 },
    ]);

  list.forEach((a, i) => {
    holdings[i].pct = Math.round(a.w * 1000) / 10;
  });
  holdings[holdings.length - 1].pct = Math.round(ballastShare * 1000) / 10;

  // Force the total to exactly 100 by adjusting the largest holding.
  const total = holdings.reduce((x, h) => x + h.pct, 0);
  holdings[0].pct = Math.round((holdings[0].pct + (100 - total)) * 10) / 10;

  holdings.sort((a, b) => {
    if (!!a.ballast !== !!b.ballast) return a.ballast ? 1 : -1;
    return b.pct - a.pct;
  });
  holdings[0].lead = true;

  const conf = Math.min(96, 26 + ranked[0].hits.length * 14 + (ranked[0].score > 12 ? 8 : 0));

  // scoreThemes ranks all 26 and the book uses at most two. The rest are a
  // real part of how the answer was reached, so they are reported rather than
  // discarded — the same reason /method publishes its own weak points.
  const alternatives = ranked
    .slice(1)
    .filter((r) => r.score > 0 && r.th.id !== secondary?.id)
    .slice(0, 3)
    .map((r) => ({ id: r.th.id, name: r.th.name, score: r.score, hits: r.hits }));

  const book: Book = {
    ok: true,
    premise: premise.trim(),
    theme: primary,
    second: secondary,
    holdings,
    risk: primary.risk,
    horizon: primary.horizon,
    confidence: conf,
    hits: ranked[0].hits,
    seed,
    drop,
    alternatives,
  };
  return book;
}
