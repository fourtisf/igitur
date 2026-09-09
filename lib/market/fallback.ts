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

export function fallbackProvider(
  primary: MarketProvider,
  secondary: MarketProvider
): MarketProvider {
  let strikes = 0;
  let skipUntil = 0;
  let served: MarketProvider | null = null;

  const primaryUsable = () => Date.now() >= skipUntil;

  function record(gotAnything: boolean) {
    if (gotAnything) {
      strikes = 0;
      return;
    }
    if (++strikes >= STRIKES) {
      strikes = 0;
      skipUntil = Date.now() + COOL_OFF_MS;
    }
  }

  return {
    /**
     * Whoever actually answered. /status prints this, and printing the vendor
     * that was *configured* while a different one supplies the numbers is the
     * kind of small lie this whole file exists to avoid.
     */
    get name(): string {
      if (served === secondary) return `${secondary.name} (fallback from ${primary.name})`;
      return primary.name;
    },

    live: true,

    async quotes(tickers) {
      const out = new Map<string, Quote>();
      let fromPrimary = 0;

      if (primaryUsable()) {
        const got = await primary.quotes(tickers);
        record(got.size > 0);
        for (const [k, v] of got) out.set(k, v);
        fromPrimary = got.size;
      }

      let fromSecondary = 0;
      const missing = tickers.filter((t) => !out.has(t.toUpperCase()));
      if (missing.length) {
        const got = await secondary.quotes(missing);
        for (const [k, v] of got) out.set(k, v);
        fromSecondary = got.size;
      }

      // Whoever supplied more of what is on the page is the one named.
      if (fromPrimary || fromSecondary) served = fromSecondary > fromPrimary ? secondary : primary;
      return out;
    },

    async history(ticker, from) {
      if (primaryUsable()) {
        const bars = await primary.history(ticker, from);
        if (bars.length) return bars;
      }
      return secondary.history(ticker, from);
    },
  };
}
