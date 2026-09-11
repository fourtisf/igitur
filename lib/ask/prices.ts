import { fmtMcap, fmtPrice, getQuotes, isLive, providerName } from "../market";
import { UNIVERSE } from "../universe";

/**
 * Live prices, handed to the assistant for the names the reader actually named.
 *
 * The assistant used to say "I have no price data at all" — true of the
 * assistant, never true of the site. /universe, /track and /trending have shown
 * real vendor prices for weeks. Withholding them from the one place a reader
 * asks a question in was a limit nobody chose; it just never got wired up.
 *
 * Three rules govern what goes over:
 *
 *   Only names in the universe. A reader asking about a ticker this site does
 *   not cover must not cause a vendor request — that is somebody else's
 *   research budget being spent by a stranger's curiosity, and the vendor
 *   allowance here is finite.
 *
 *   Only what was mentioned, up to six. The whole universe every turn would
 *   spend the day's quota on one conversation.
 *
 *   A generated figure is never passed off as a price. When the vendor is not
 *   answering, the site falls back to synthetic numbers for its tables; here
 *   they are withheld entirely and the assistant is told the price is
 *   unavailable. A made-up price in a sentence about whether to hold something
 *   is the single most damaging thing this assistant could say.
 */

/** Tickers are matched whole and in the reader's own case-insensitive text. */
const BY_TICKER = new Map(UNIVERSE.map((a) => [a.t.toUpperCase(), a]));

/** ServiceNow's ticker is also an English word; one letter is not a mention. */
const AMBIGUOUS = new Set(["NOW", "V"]);

export function mentioned(text: string, limit = 6): string[] {
  const out: string[] = [];
  for (const word of text.toUpperCase().split(/[^A-Z.]+/)) {
    const t = word.replace(/\.$/, "");
    if (!t || t.length < 2 || AMBIGUOUS.has(t)) continue;
    if (!BY_TICKER.has(t) || out.includes(t)) continue;
    out.push(t);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * The block that travels with the question, or "" when there is nothing
 * honest to send. Never cached with the corpus: this is the volatile part.
 */
export async function priceBlock(text: string): Promise<string> {
  const tickers = mentioned(text);
  if (!tickers.length) return "";
  if (!isLive()) {
    return [
      "# LIVE MARKET DATA",
      "",
      "Unavailable: this deployment has no market data vendor configured, so there are",
      "no prices to quote. Say so if asked; do not estimate one.",
    ].join("\n");
  }

  let quotes: Map<string, { price: number; changePct: number | null; marketCap: number; asOf: string; synthetic: boolean }>;
  try {
    quotes = await getQuotes(tickers);
  } catch {
    return "# LIVE MARKET DATA\n\nUnavailable right now: the vendor did not answer. Do not estimate a price.";
  }

  const rows: string[] = [];
  const missing: string[] = [];
  for (const t of tickers) {
    const q = quotes.get(t);
    // A synthetic figure is a generated number, not a price. It stays here.
    if (!q || q.synthetic) {
      missing.push(t);
      continue;
    }
    // Only what the vendor actually supplied. Twelvedata's quote endpoint
    // returns no market cap at all, and sending an empty field made the
    // assistant announce its absence — "market cap is not in the data I have" —
    // which is a sentence about the plumbing in the middle of an answer about
    // a company. A figure that is not there is simply not mentioned.
    const parts = [fmtPrice(q.price)];
    if (q.changePct !== null) {
      parts.push(`${q.changePct >= 0 ? "+" : ""}${q.changePct.toFixed(2)}% on the session`);
    }
    if (q.marketCap > 0) parts.push(`market cap ${fmtMcap(q.marketCap)}`);
    rows.push(`  ${t}: ${parts.join(", ")} (as of ${q.asOf})`);
  }

  if (!rows.length && !missing.length) return "";

  return [
    "# LIVE MARKET DATA",
    "",
    `Source: ${providerName()}. These are real vendor figures, delayed by the vendor's own`,
    "schedule rather than real time. You may state them, say how a name moved today and",
    "what it is worth. You may NOT call a price cheap, expensive, fair or a good entry,",
    "and you may not say where it goes next — this site publishes no valuation and no",
    "forecast, and a price does not become a view because it is current.",
    "",
    "Quote only the figures listed below. A figure that is absent is not mentioned at all:",
    "do not announce what you were not given. The reader asked about a company, not about",
    "the shape of your data.",
    "",
    ...rows,
    ...(missing.length
      ? ["", `No live price for: ${missing.join(", ")}. Say the price is unavailable; never estimate one.`]
      : []),
  ].join("\n");
}
