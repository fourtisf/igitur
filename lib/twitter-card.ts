import type { Metadata } from "next";

import { SITE } from "./site";

/**
 * The Twitter/X card for a page.
 *
 * Next merges metadata per field, not per key: a page that exports its own
 * `twitter` object replaces the root layout's completely. Sixteen pages did,
 * so `twitter:site` — the attribution that tells X which account the card
 * belongs to — was silently dropped from every one of them, and survived only
 * on the pages that had no card of their own.
 *
 * Building it here means a page cannot forget the attribution, because it no
 * longer writes the object at all.
 *
 * `site` is omitted entirely when no handle is configured, rather than guessed:
 * a card attributed to an account nobody here owns credits a stranger with the
 * whole site.
 */
export function twitterCard(image: string): NonNullable<Metadata["twitter"]> {
  return {
    card: "summary_large_image",
    ...(SITE.xHandle ? { site: `@${SITE.xHandle}`, creator: `@${SITE.xHandle}` } : {}),
    images: [image],
  };
}
