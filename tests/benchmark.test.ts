/**
 * The benchmark is not rigged. HANDOFF.md §5 and §13.
 *
 * An earlier build gave the book a higher drift (0.055) than the index (0.032),
 * so every book beat the market — a marketing claim baked into the code. This
 * test exists so that can never come back unnoticed.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { bookDrift, SPY_DRIFT } from "../lib/market";
import { buildBook } from "../lib/generator";
import { THEMES } from "../lib/universe";

test("roughly half of all theme claims lose to the index", () => {
  let beat = 0;
  for (const th of THEMES) {
    const b = buildBook(th.claim);
    assert.ok(b.ok, th.id);
    if (bookDrift(b.seed) > SPY_DRIFT) beat++;
  }
  // The prototype's published figure is 14 of 26 beating the index.
  assert.equal(beat, 14, `${beat} of ${THEMES.length} themes beat the index`);
  assert.equal(THEMES.length - beat, 12);
});

test("book drift is centred on the index, not tilted above it", () => {
  // Over a large sample the mean drift must sit on the benchmark, and losers
  // must be about as common as winners.
  const N = 20000;
  let sum = 0;
  let beat = 0;
  for (let i = 0; i < N; i++) {
    const d = bookDrift(i);
    sum += d;
    if (d > SPY_DRIFT) beat++;
  }
  const mean = sum / N;
  assert.ok(
    Math.abs(mean - SPY_DRIFT) < 0.002,
    `mean drift ${mean} is not centred on the index ${SPY_DRIFT}`
  );
  const share = beat / N;
  assert.ok(share > 0.45 && share < 0.55, `${(share * 100).toFixed(1)}% of books beat the index`);
});

test("the index drift is a constant the book cannot outrun by construction", () => {
  // Guard the specific regression: no asymmetry between the two drifts.
  const drifts = Array.from({ length: 5000 }, (_, i) => bookDrift(i));
  const above = drifts.filter((d) => d > SPY_DRIFT).length;
  const below = drifts.filter((d) => d < SPY_DRIFT).length;
  assert.ok(
    Math.abs(above - below) / drifts.length < 0.06,
    `asymmetric: ${above} above, ${below} below`
  );
});
