/**
 * Daily closes, across a restart.
 *
 * The bug this pins had no symptom on the page and cost the whole vendor
 * allowance in an evening. /ledger tracks every committed claim, which needs a
 * price series per holding — 144 names once Igitur's own theses were on the
 * record. Those lived in a Map in the process. Every deploy restarts the
 * process, and the deploy's own verification opens /ledger, so every deploy
 * paid for all 144 again. Eight deploys spent 1299 credits against 800, and
 * the only visible effect was every source answering 429.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { forgetHistoryStore, rememberBars, rememberedBars } from "../lib/market/history-store";

const dir = mkdtempSync(join(tmpdir(), "history-"));
process.env.MARKET_HISTORY_PATH = join(dir, "history.json");

const BARS = [
  { date: "2026-09-01", close: 100 },
  { date: "2026-09-02", close: 101.5 },
];

test("a series survives the process that fetched it", () => {
  rememberBars("NVDA|2026-09-01", BARS);
  assert.ok(existsSync(process.env.MARKET_HISTORY_PATH!), "it must reach disk, not only memory");

  // What a pm2 restart does: the map is gone, the file is not.
  forgetHistoryStore();
  const back = rememberedBars("NVDA|2026-09-01");
  assert.deepEqual(back?.bars, BARS);
});

test("an empty series is never stored", () => {
  // The vendor not answering is a question, not a result. Persisting it would
  // keep a tracked claim blank across restarts long after the source returned.
  rememberBars("EMPTY|2026-09-01", []);
  forgetHistoryStore();
  assert.equal(rememberedBars("EMPTY|2026-09-01"), null);
});

test("a series it never stored is absent, not invented", () => {
  assert.equal(rememberedBars("NOSUCH|2026-01-01"), null);
});

test("a malformed file takes nothing down", () => {
  const bad = join(dir, "broken.json");
  process.env.MARKET_HISTORY_PATH = bad;
  forgetHistoryStore();
  require("node:fs").writeFileSync(bad, "{ not json", "utf8");
  assert.equal(rememberedBars("NVDA|2026-09-01"), null, "it must read as empty, not throw");
  process.env.MARKET_HISTORY_PATH = join(dir, "history.json");
  forgetHistoryStore();
});

test("bars that lost their shape in transit are not trusted", () => {
  const odd = join(dir, "odd.json");
  process.env.MARKET_HISTORY_PATH = odd;
  forgetHistoryStore();
  require("node:fs").writeFileSync(
    odd,
    JSON.stringify({ "X|2026-01-01": { at: Date.now(), bars: [{ date: "2026-01-01" }] } }),
    "utf8"
  );
  assert.equal(rememberedBars("X|2026-01-01"), null, "a bar without a close is not a bar");
  process.env.MARKET_HISTORY_PATH = join(dir, "history.json");
  forgetHistoryStore();
});
