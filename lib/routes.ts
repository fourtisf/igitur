/**
 * URL construction. HANDOFF.md §6.1 and §8.
 *
 * Every page has a real path, not a hash. A book's path carries a readable slug
 * for the crawler and the raw premise in the query string, so the book can be
 * rebuilt with no database at all — that fallback is what makes sharing work on
 * day one.
 *
 * Four parameters, and the split between them matters:
 *
 *   p  the premise            determines the book
 *   x  removed tickers        determines the book
 *   u  universe version       provenance: which universe it was built against
 *   d  stated-on date         provenance: when the claim was made
 *
 * Only `p` and `x` change what a book contains, so only those appear in the
 * canonical URL. If `u` and `d` were canonical, the same book stated on two
 * days would be two indexable pages saying identical things.
 */

import { slugOf } from "./hash";
import { UNIVERSE_VERSION } from "./universe";

export interface BookRef {
  premise: string;
  drop?: string[];
  /** Reader-set weights, `NVDA:12,TSM:8`. Determines the book, so canonical. */
  weights?: string;
  /** Defaults to the current universe. */
  universe?: number;
  /** ISO date, YYYY-MM-DD. Omitted for links that predate the field. */
  stated?: string;
}

function params({ premise, drop = [], weights, universe, stated }: BookRef): URLSearchParams {
  const q = new URLSearchParams({ p: premise });
  if (drop.length) q.set("x", drop.join(","));
  if (weights) q.set("w", weights);
  if (universe !== undefined) q.set("u", String(universe));
  if (stated) q.set("d", stated);
  return q;
}

/** A shareable book URL, stamped with the universe and date it was built on. */
export function bookHref(
  premise: string,
  drop: string[] = [],
  opts: { universe?: number; stated?: string; weights?: string } = {}
): string {
  return `/b/${slugOf(premise)}?${params({ premise, drop, ...opts })}`;
}

/**
 * The canonical URL for a book: content-determining parameters only.
 * Two readers who state the same premise on different days are looking at one
 * page, and search engines should be told so.
 */
export function bookCanonical(premise: string, drop: string[] = [], weights?: string): string {
  return `/b/${slugOf(premise)}?${params({ premise, drop, weights })}`;
}

export function trackHref(
  premise: string,
  opts: { stated?: string; universe?: number } = {}
): string {
  return `/track/${slugOf(premise)}?${params({ premise, ...opts })}`;
}

export function ogHref(premise: string, drop: string[] = []): string {
  return `/api/og?${params({ premise, drop })}`;
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

/**
 * The universe version a book was built against. Links made before the field
 * existed have none, and are reported as such rather than assumed current —
 * claiming to know would be the same silent lie the field exists to prevent.
 */
export function parseUniverse(v: string | string[] | undefined): number | null {
  const raw = one(v);
  if (!/^\d{1,4}$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 1 && n <= UNIVERSE_VERSION + 1000 ? n : null;
}

/** The date a premise was stated. Null for links that predate the field. */
export function parseStated(v: string | string[] | undefined): string | null {
  const raw = one(v);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const t = Date.parse(raw + "T00:00:00Z");
  if (Number.isNaN(t)) return null;
  // A claim cannot have been stated in the future, and the project did not
  // exist before this. Either means a hand-edited URL.
  if (t > Date.now() + 86_400_000 || t < Date.parse("2026-01-01T00:00:00Z")) return null;
  return raw;
}

/** Today, as YYYY-MM-DD in UTC. Used to stamp a newly composed book. */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** How many days a premise has been standing. Null when it carries no date. */
export function daysSince(stated: string | null): number | null {
  if (!stated) return null;
  const ms = Date.now() - Date.parse(stated + "T00:00:00Z");
  return Math.max(0, Math.floor(ms / 86_400_000));
}

/** The calendar file for a claim's settlement date. */
export function icsHref(id: string): string {
  return `/api/claim.ics?id=${encodeURIComponent(id)}`;
}

/**
 * The universe, filtered to one theme.
 *
 * `q` seeds the filter box in the browser rather than being read on the
 * server, so /universe keeps its static prerender and a crawler still sees
 * every theme on it.
 */
export function themeHref(themeName: string): string {
  return `/universe?q=${encodeURIComponent(themeName)}`;
}
