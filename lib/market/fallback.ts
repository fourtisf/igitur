import type { MarketProvider, Quote } from "./types";

/**
 * Two providers, in order, so a broken one cannot take the site down with it.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 *
 * The site sat on generated figures while reporting `HTTP 401 from
 * /stable/batch-quote`. FMP was rejecting the key — but the keyless source was
 * configured, working and never asked, because the selection logic treated a
 * key being *present* as a decision. A key that does not work is not a
 * preference; it is a broken part, and a broken part should be routed around.
 *
 * So the vendor with a key is tried first, and whatever it cannot price is
 * asked of the keyless one. Per ticker, not per site: a vendor covering 158 of
 * 163 names keeps those 158 and the other five come from the fallback.
 *
 * ── Not asking a dead vendor for ever ────────────────────────────────────────
 *
 * A rejected key returns 401 every time, and asking it four times a minute for
 * the rest of the day is rude to the vendor and slow for the reader — every
 * page render would wait for the refusal before reaching the source that
 * works. After three consecutive rounds where the primary priced nothing at
 * all it is set aside for half an hour, then tried once more. A key fixed in
 * .env is picked up on the next attempt without a deploy.
 */

const STRIKES = 3;
const COOL_OFF_MS = 30 * 60_000;

interface Link {
  provider: MarketProvider;
  strikes: number;
  skipUntil: number;
}

/**
 * Sources in order of preference. Each is asked only for what the ones before
 * it could not price, so the chain costs one request set in the ordinary case
 * and reaches the end only when everything above it is failing.
 */
export function chainProviders(providers: MarketProvider[]): MarketProvider {
  const links: Link[] = providers.map((provider) => ({ provider, strikes: 0, skipUntil: 0 }));
  let served: MarketProvider | null = null;

  function record(link: Link, gotAnything: boolean) {
    if (gotAnything) {
      link.strikes = 0;
      return;
    }
    if (++link.strikes >= STRIKES) {
      link.strikes = 0;
      link.skipUntil = Date.now() + COOL_OFF_MS;
    }
  }

  return {
    /**
     * Whoever actually answered. /status prints this, and printing the vendor
     * that was *configured* while a different one supplies the numbers is the
     * kind of small lie this whole file exists to avoid.
     */
    get name(): string {
      const first = links[0]?.provider;
      if (!served || !first || served === first) return first?.name ?? "none";
      return `${served.name} (fallback from ${first.name})`;
    },

    live: true,

    async quotes(tickers) {
      const out = new Map<string, Quote>();
      let best = { count: 0, provider: null as MarketProvider | null };

      for (const link of links) {
        const missing = tickers.filter((t) => !out.has(t.toUpperCase()));
        if (!missing.length) break;
        if (Date.now() < link.skipUntil) continue;

        const got = await link.provider.quotes(missing);
        record(link, got.size > 0);
        for (const [k, v] of got) out.set(k, v);
        if (got.size > best.count) best = { count: got.size, provider: link.provider };
      }

      if (best.provider) served = best.provider;
      return out;
    },

    async history(ticker, from) {
      for (const link of links) {
        if (Date.now() < link.skipUntil) continue;
        const bars = await link.provider.history(ticker, from);
        if (bars.length) return bars;
      }
      return [];
    },
  };
}

/** Two sources. Kept because most of the site only ever needs the pair. */
export function fallbackProvider(
  primary: MarketProvider,
  secondary: MarketProvider
): MarketProvider {
  return chainProviders([primary, secondary]);
}
