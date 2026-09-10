/**
 * Reading a premise off the wire.
 *
 * Every route that accepts `?p=` goes through here, so the page, its metadata
 * and its share image all agree on exactly the same string — and so one
 * unbounded query parameter cannot turn into unbounded server work.
 */

/**
 * A premise is one sentence. 280 characters is far beyond that and still short
 * enough that scoring it against 354 keywords, rendering the page and rendering
 * the share image all stay cheap.
 *
 * Truncation is deterministic — the same URL still produces the same book — so
 * this does not break the guarantee that a shared link rebuilds byte for byte.
 */
export const MAX_PREMISE = 280;

export function normalizePremise(raw: string | string[] | undefined): string {
  const first = (Array.isArray(raw) ? raw[0] : raw) ?? "";
  // Collapse whitespace so " a  b " and "a b" are one book, not two.
  const collapsed = first.replace(/\s+/g, " ").trim();
  return collapsed.length > MAX_PREMISE ? collapsed.slice(0, MAX_PREMISE).trimEnd() : collapsed;
}

/**
 * Whether the reader has written a claim at all.
 *
 * This is not a second matcher and it never decides whether a book gets built —
 * `buildBook` alone does that, on exactly the terms it always has. It decides
 * which of two true things the refusal page should say.
 *
 * "hello" and "the dollar loses reserve status" both come back with no book,
 * and answering both with "no theme in this universe carries that claim" is
 * accurate and useless. The first reader has not made a claim; they do not know
 * what this box wants. The second made a real one the universe does not cover.
 * Telling them apart is the difference between a page that teaches and a page
 * that shrugs — and "hello" is what a first-time visitor actually types.
 *
 * Deliberately crude: word count after the filler is stripped. Anything
 * cleverer would be a matcher, and there is already exactly one of those.
 */
const FILLER = new Set([
  "a", "about", "all", "an", "and", "are", "as", "at", "be", "because", "become",
  "becomes", "been", "but", "by", "can", "could", "do", "does", "for", "from",
  "get", "gets", "go", "going", "had", "has", "have", "he", "her", "his", "how",
  "i", "if", "in", "into", "is", "it", "its", "just", "like", "make", "makes",
  "may", "me", "might", "more", "most", "much", "must", "my", "next", "no",
  "not", "of", "on", "one", "only", "or", "our", "out", "over", "same", "she",
  "should", "so", "some", "than", "that", "the", "their", "them", "then",
  "there", "these", "they", "think", "this", "those", "to", "up", "us", "very",
  "was", "we", "were", "what", "when", "where", "which", "while", "who", "why",
  "will", "with", "would", "you", "your",
  // The openers people type when they are working out what the box is for.
  "hello", "hi", "hey", "test", "testing", "yo", "ok", "okay", "halo", "hai",
]);

/** Below this many content words, it is not yet a sentence stating anything. */
const MIN_CONTENT_WORDS = 3;

export function looksLikeClaim(premise: string): boolean {
  const words = premise
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((w) => w.length > 1 && !FILLER.has(w));
  return words.length >= MIN_CONTENT_WORDS;
}
