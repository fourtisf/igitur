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
