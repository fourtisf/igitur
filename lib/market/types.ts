/**
 * The market data contract. HANDOFF.md §5.
 *
 * Everything numeric on the site used to be generated from the ticker string.
 * This is the seam that replaces it. A provider either serves real data or it
 * does not, and every quote says which it is — per quote, not per site, because
 * a vendor that covers 158 of 163 names should not force the other five to lie.
 */

export interface Quote {
  ticker: string;
  /** Last traded price, or last close outside market hours. */
  price: number;
  /** Session change, in percent. Negative for a fall. */
  changePct: number;
  /** Market capitalisation in billions. */
  marketCap: number;
  /** Previous session's close. Used to draw an honest, coarse sparkline. */
  previousClose: number;
  /** Session open. Zero when the provider does not supply it. */
  open: number;
  /** When the provider produced this. */
  asOf: string;
  /** False only when this specific figure came from a real vendor. */
  synthetic: boolean;
}

export interface Bar {
  /** YYYY-MM-DD. */
  date: string;
  close: number;
}

export interface MarketProvider {
  readonly name: string;
  /** True when this provider returns real market data. */
  readonly live: boolean;
  /**
   * Quotes for many tickers. Implementations should batch: 163 names in one
   * request, not 163 requests.
   */
  quotes(tickers: string[]): Promise<Map<string, Quote>>;
  /**
   * Daily closes from `from` (YYYY-MM-DD) to today, oldest first.
   * Returns an empty array when the provider cannot supply history.
   */
  history(ticker: string, from: string): Promise<Bar[]>;
}
