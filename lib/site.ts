/**
 * Every placeholder that must be replaced before deploy, in one place.
 *
 * HANDOFF.md §10 lists these with their occurrence counts in the prototype
 * (the domain appeared 7 times, the X handle 6, the Telegram link 7). Holding
 * them here makes the pre-deploy checklist a single-file edit instead of a
 * find-and-replace across the site.
 *
 * The public base URL drives every canonical link, the sitemap and the OG
 * image URLs, so it must be absolute and must match the deployed domain.
 */

export const SITE = {
  name: "Premise",
  tagline: "Write what you believe. See what it holds.",
  description:
    "Write one sentence about the next decade. Premise returns a weighted portfolio, and every weight carries the reason it earned its size.",

  /** ⚠ PLACEHOLDER — set NEXT_PUBLIC_SITE_URL in the deploy environment. */
  url: (process.env.NEXT_PUBLIC_SITE_URL || "https://premise.app").replace(/\/$/, ""),

  /** ⚠ PLACEHOLDER — HANDOFF.md §10. */
  x: "https://x.com/premisefi",
  xHandle: "@premisefi",
  /** ⚠ PLACEHOLDER — HANDOFF.md §10. */
  telegram: "https://t.me/premiseportal",
  telegramHandle: "t.me/premiseportal",

  /** ⚠ PLACEHOLDER — HANDOFF.md §10. */
  token: {
    ticker: "PREM",
    supply: "1B",
    chain: "Robinhood Chain",
    chainShort: "Robinhood",
    /** Stays null until the pool opens. The UI reads null as "Coming soon". */
    contractAddress: null as string | null,
  },

  build: "Prototype build 2.1",
} as const;

/** The premise shown on the landing page and used as the /track default. */
export const FEATURED =
  "Compute is the binding constraint on artificial intelligence, not model design.";

/** Display host, for the fake browser-chrome URL bars. */
export const HOST = SITE.url.replace(/^https?:\/\//, "");

export function absolute(path: string): string {
  return SITE.url + (path.startsWith("/") ? path : "/" + path);
}
