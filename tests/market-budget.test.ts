/**
 * The vendor's daily allowance, held against what the site actually spends.
 *
 * This failure has no symptom on the page. The key is not rejected and nothing
 * errors: the vendor simply starts answering 429, every fallback is also being
 * rate-limited, and the site goes on serving yesterday's closes off the disk
 * store — correctly, and silently. It is only visible by asking
 * /api/market-probe, which nobody does until something else looks wrong.
 *
 * It has now happened twice. The FMP key died before lunch on a one-hour TTL.
 * Then Twelve Data's did, because the six-hour TTL was chosen when /ledger was
 * empty: quotes cost 652 of 800 credits a day, and nobody added the price
 * series /ledger needs for every claim on the record. The day Igitur's own 26
 * theses were committed, that became a 144-name sweep and the budget was 796
 * of 800 before a single reader arrived.
 *
 * So the sum is a test rather than a comment. Growing the universe, adding
 * themes, or shortening the refresh cannot quietly spend the key again.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { buildBook } from "../lib/generator";
import { TWELVEDATA_TTL_S } from "../lib/market";
import { DAILY_CREDITS } from "../lib/market/twelvedata";
import { THEMES, UNIVERSE } from "../lib/universe";

/** A batch spends one credit per symbol, so a refresh costs the universe. */
const QUOTES_PER_REFRESH = UNIVERSE.length;

/** Every distinct name the record can touch, fetched once a day and cached. */
function ledgerHistoryTickers(): number {
  const seen = new Set<string>();
  for (const th of THEMES) {
    const book = buildBook(th.claim);
    if (book.ok) for (const h of book.holdings) seen.add(h.t);
  }
  return seen.size;
}

test("a day of quotes and ledger history fits inside the free tier", () => {
  const refreshes = Math.ceil(86_400 / TWELVEDATA_TTL_S);
  const quotes = refreshes * QUOTES_PER_REFRESH;
  const history = ledgerHistoryTickers();
  const total = quotes + history;

  assert.ok(
    total <= DAILY_CREDITS,
    `a day costs ${total} credits (${refreshes} refreshes × ${QUOTES_PER_REFRESH} quotes ` +
      `+ ${history} ledger histories) against ${DAILY_CREDITS}. Lengthen TWELVEDATA_TTL_S.`
  );
});

test("and leaves room for readers, not just for the schedule", () => {
  // Four credits of headroom is what produced the outage: one /track page, one
  // deploy verifying /ledger, one cache miss. A tenth of the allowance is the
  // smallest margin that survives a normal day.
  const refreshes = Math.ceil(86_400 / TWELVEDATA_TTL_S);
  const total = refreshes * QUOTES_PER_REFRESH + ledgerHistoryTickers();
  const headroom = DAILY_CREDITS - total;

  assert.ok(
    headroom >= DAILY_CREDITS * 0.1,
    `only ${headroom} credits spare of ${DAILY_CREDITS}. Readers spend these, and ` +
      `an exhausted key looks exactly like a working one from the page.`
  );
});

test("the refresh interval stays inside a day, so prices still move", () => {
  // The other direction. Budget is not the only property: a TTL long enough to
  // pass the sum above and never refresh would be cheap and useless.
  assert.ok(TWELVEDATA_TTL_S <= 12 * 3600, "prices must refresh at least twice a day");
  assert.ok(TWELVEDATA_TTL_S >= 3600, "below an hour no allowance survives");
});
