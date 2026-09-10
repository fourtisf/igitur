import { matchText, scoreThemes } from "./generator";
import type { Theme } from "./types";
import { THEMES } from "./universe";

/**
 * What to offer a reader whose premise was refused.
 *
 * ── What this is not ─────────────────────────────────────────────────────────
 *
 * It is NOT a looser matcher, and it must never become one. The refusal is the
 * product's main differentiator (HANDOFF.md §0, §13): a premise the universe
 * does not carry returns no book, and nothing here changes that by a point.
 * Every suggestion below links to a *theme's own written claim* — the same
 * destination the 26-cell grid already offered — so the book that gets built is
 * one the matcher fully agrees with, built from a sentence the site wrote.
 * The reader's refused premise is never used to build anything.
 *
 * ── What it is ───────────────────────────────────────────────────────────────
 *
 * The grid showed all 26 themes in fixed order, which is the same as showing
 * none: a reader who has just been told "no" has to read 26 names to find the
 * one they nearly hit. This ranks them, and says why each is close, using two
 * signals the matcher already produced:
 *
 *   suppressed  the theme DID match words in the premise, and a negative
 *               keyword vetoed it. This is the most useful thing the site can
 *               say to a refused reader, and until now it was thrown away:
 *               "you wrote 'coal', which this theme excludes" turns a dead end
 *               into one edit.
 *
 *   lexical     the premise and the theme's vocabulary share a word stem that
 *               was too far apart for the matcher — "electricity" against
 *               "electrification". A hint, labelled as one, never a match.
 *
 * A theme with neither signal is not offered. When nothing is close the page
 * falls back to the full grid, which is what it did before.
 */

export type NearMissReason =
  /** Matched, then vetoed. `term` is the negative keyword that did it. */
  | { kind: "suppressed"; term: string; hits: string[] }
  /** Shares word stems with the theme's vocabulary, below the matcher's bar. */
  | { kind: "lexical"; shared: string[] };

export interface NearMiss {
  th: Theme;
  reason: NearMissReason;
}

/**
 * Words that would pair with something in a 354-keyword list whatever the
 * premise said. Filtering them is the difference between a hint and noise.
 * Anything genuinely in the vocabulary was already read by the matcher, which
 * is why a premise reaching this file cannot lose a real signal here.
 */
const STOP = new Set([
  "about", "above", "after", "again", "against", "along", "already", "also", "always",
  "another", "around", "because", "become", "becomes", "becoming", "been", "before",
  "being", "believe", "below", "better", "between", "beyond", "both", "business",
  "cannot", "change", "changes", "could", "decade", "decades", "different", "does",
  "down", "during", "each", "early", "enough", "even", "ever", "every", "everything",
  "first", "from", "future", "going", "growth", "half", "have", "here", "high",
  "higher", "however", "into", "just", "keep", "large", "larger", "last", "late",
  "later", "less", "like", "little", "long", "longer", "look", "made", "make",
  "makes", "many", "matter", "maybe", "more", "most", "much", "must", "near",
  "need", "needs", "never", "next", "nothing", "only", "other", "others", "over",
  "own", "part", "people", "perhaps", "place", "point", "probably", "rather",
  "really", "same", "say", "see", "seem", "seems", "several", "should", "significant",
  "simply", "since", "small", "smaller", "some", "something", "soon", "still",
  "such", "sure", "take", "takes", "than", "that", "their", "them", "then", "there",
  "these", "they", "thing", "things", "think", "this", "those", "though", "through",
  "time", "times", "under", "until", "very", "want", "well", "were", "what", "when",
  "where", "whether", "which", "while", "will", "with", "within", "without", "world",
  "worse", "would", "year", "years", "yet",
]);

/**
 * How many leading characters two words must share to count as the same idea.
 *
 * Four lets "compute" pair with "company" and "market" with "marine". Five is
 * the first length at which the pairs this produces are ones a reader would
 * also have drawn — "electr(icity/ification)", "manufactur(ing/ers)".
 */
const MIN_STEM = 5;

/** How many distinct premise words a lexical hint needs before it is offered. */
const MIN_SHARED = 1;

function sharedPrefix(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return i;
}

function contentWords(q: string): string[] {
  const out: string[] = [];
  for (const w of q.split(/[\s-]+/)) {
    if (w.length < MIN_STEM || STOP.has(w)) continue;
    if (!out.includes(w)) out.push(w);
  }
  return out;
}

export function nearMisses(premise: string, limit = 3): NearMiss[] {
  const q = matchText(premise);
  const asked = contentWords(q);

  // The scorer keeps the keywords it matched even when negatives take the
  // score to zero, so a vetoed theme is simply one with hits and no score.
  const ranked = scoreThemes(premise, THEMES);
  const byId = new Map(ranked.map((r) => [r.th.id, r]));

  const suppressed: { th: Theme; reason: NearMissReason; rank: number }[] = [];
  const lexical: { th: Theme; reason: NearMissReason; rank: number }[] = [];

  for (const th of THEMES) {
    const hits = byId.get(th.id)?.hits ?? [];

    if (hits.length) {
      const term = th.neg.find((k) => q.includes(k));
      if (term) {
        suppressed.push({
          th,
          reason: { kind: "suppressed", term, hits },
          rank: hits.length * 10 + Math.min(9, term.length),
        });
        continue;
      }
    }

    const shared: string[] = [];
    for (const w of asked) {
      const near = th.kw.some((k) =>
        k.split(" ").some((part) => part.length >= MIN_STEM && sharedPrefix(w, part) >= MIN_STEM)
      );
      if (near) shared.push(w);
    }
    if (shared.length >= MIN_SHARED) {
      lexical.push({ th, reason: { kind: "lexical", shared }, rank: shared.length });
    }
  }

  // A veto always outranks a stem: one is something the matcher actually did,
  // the other is a resemblance this file noticed.
  const all = [
    ...suppressed.sort((a, b) => b.rank - a.rank),
    ...lexical.sort((a, b) => b.rank - a.rank),
  ];
  return all.slice(0, limit).map(({ th, reason }) => ({ th, reason }));
}
