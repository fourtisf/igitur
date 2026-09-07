/**
 * URL construction. HANDOFF.md §6.1 and §8.
 *
 * Every page has a real path, not a hash. A book's path carries a readable
 * slug for the crawler and the raw premise in the query string, so the book
 * can be rebuilt with no database at all — that fallback is what makes sharing
 * work on day one.
 */

import { slugOf } from "./hash";

export function bookHref(premise: string, drop: string[] = []): string {
  const q = new URLSearchParams({ p: premise });
  if (drop.length) q.set("x", drop.join(","));
  return `/b/${slugOf(premise)}?${q}`;
}

export function trackHref(premise: string): string {
  return `/track/${slugOf(premise)}?${new URLSearchParams({ p: premise })}`;
}

export function ogHref(premise: string, drop: string[] = []): string {
  const q = new URLSearchParams({ p: premise });
  if (drop.length) q.set("x", drop.join(","));
  return `/api/og?${q}`;
}

/** Parse the `x` query parameter into a list of removed tickers. */
export function parseDrop(x: string | string[] | undefined): string[] {
  const raw = Array.isArray(x) ? x[0] : x;
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
}

/** First value of a possibly-repeated query parameter. */
export function one(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}
