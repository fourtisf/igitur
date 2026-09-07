/**
 * Determinism primitives. HANDOFF.md §3.3.
 *
 * `fnv(premise)` seeds everything downstream, so the same premise produces the
 * same book byte for byte on any machine. That is what lets a shared URL work
 * with no database behind it. Do not introduce randomness that breaks it.
 */

/** FNV-1a, 32-bit. */
export function fnv(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** xorshift32. Seeded, so every caller gets a reproducible stream. */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return function () {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

/** The seed for a premise. Trimmed and lowercased so trivial edits share a book. */
export function seedOf(premise: string): number {
  return fnv(premise.trim().toLowerCase());
}

/**
 * URL-safe slug for a premise — HANDOFF.md §8.
 *
 * The raw premise still travels in the query string, so a book can be rebuilt
 * with no database at all. That fallback is what makes sharing work on day one.
 */
export function slugOf(premise: string): string {
  const words = premise
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .trim()
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 6)
    .join("-");
  const h = seedOf(premise).toString(36);
  return words ? `${words}-${h}` : h;
}
