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
  name: "Igitur",
  tagline: "Write what you believe. See what it holds.",
  description:
    "Write one sentence about the next decade. Igitur returns a weighted portfolio, and every weight carries the reason it earned its size.",

  /**
   * ⚠ PLACEHOLDER — set NEXT_PUBLIC_SITE_URL in the deploy environment.
   *
   * This one matters more than the rest. /token promises the contract address
   * appears "here and on X at the same moment, and nowhere else first", and
   * /legal promises "any page that does is not us". Both are only enforceable
   * if "here" is unmistakable, so the domain must actually be owned before
   * launch — and the obvious lookalikes registered defensively alongside it.
   */
  url: (process.env.NEXT_PUBLIC_SITE_URL || "https://igitur.xyz").replace(/\/$/, ""),

  /** ⚠ PLACEHOLDER — HANDOFF.md §10. Claim the handle before shipping this. */
  x: "https://x.com/igiturxyz",
  xHandle: "@igiturxyz",
  /** ⚠ PLACEHOLDER — HANDOFF.md §10. Claim the handle before shipping this. */
  telegram: "https://t.me/igiturxyz",
  telegramHandle: "t.me/igiturxyz",

  /** ⚠ PLACEHOLDER — HANDOFF.md §10. */
  token: {
    ticker: "IGITUR",
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
