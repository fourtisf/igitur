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

/** A handle, stripped of the @ and the URL people paste instead of it. */
export function handleFor(raw: string | undefined): string | null {
  const v = (raw ?? "").trim().replace(/^@/, "").replace(/^https?:\/\/(x\.com|twitter\.com|t\.me)\//i, "");
  return /^[A-Za-z0-9_]{2,32}$/.test(v) ? v : null;
}

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

  /**
   * Social handles. Null until the account is actually claimed, and the UI
   * renders nothing rather than a link.
   *
   * These used to be hard-coded to invented names. That is worse than a missing
   * link: /token promises the contract address appears "here and on X at the
   * same moment, and nowhere else first", and /legal promises "any page that
   * does is not us". Pointing those promises at a handle nobody here owns is an
   * open invitation to whoever registers it — the exact impersonation the two
   * pages exist to prevent.
   *
   * To turn them on, set these in the server environment once the accounts are
   * held. Nothing else needs to change.
   *
   *   NEXT_PUBLIC_X_HANDLE=igiturxyz
   *   NEXT_PUBLIC_TELEGRAM_HANDLE=igiturxyz
   */
  xHandle: handleFor(process.env.NEXT_PUBLIC_X_HANDLE),
  telegramHandle: handleFor(process.env.NEXT_PUBLIC_TELEGRAM_HANDLE),
  get x(): string | null {
    return this.xHandle ? `https://x.com/${this.xHandle}` : null;
  },
  get telegram(): string | null {
    return this.telegramHandle ? `https://t.me/${this.telegramHandle}` : null;
  },

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
