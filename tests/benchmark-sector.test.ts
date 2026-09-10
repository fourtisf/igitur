/**
 * The second yardstick.
 *
 * A nuclear book that beats the index may be an insight, or nuclear may simply
 * have had a good year. Only one of those was worth composing a book for, and
 * the index alone cannot tell them apart.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { THEMES, themeBenchmark } from "../lib/universe";

test("every theme with an ETF has a benchmark, and it is the broad one", () => {
  // The universe lists assets from the most specific bet to the least, so the
  // broad fund sorts last by construction — no hand-maintained mapping to drift.
  const expected: Record<string, string> = {
    compute: "SMH",
    nuclear: "URA",
    emerging: "EEM",
    cyber: "BUG",
    defense: "ITA",
  };
  for (const [id, ticker] of Object.entries(expected)) {
    const theme = THEMES.find((t) => t.id === id);
    assert.ok(theme, `${id} left the universe`);
    assert.equal(themeBenchmark(theme), ticker);
  }
});

test("a theme carrying no ETF gets no benchmark rather than a guessed one", () => {
  // Naming a sector fund that might not exist would be worse than admitting
  // the comparison is unavailable: the page would show a line for a ticker no
  // vendor can price, and quietly fall back to nothing.
  const without = THEMES.filter((t) => !t.assets.some((a) => a.k === "ETF"));
  assert.ok(without.length > 0, "this test is only meaningful while some theme lacks one");
  for (const t of without) assert.equal(themeBenchmark(t), null);
});

test("the benchmark is always a ticker the universe already carries", () => {
  // Anything else would be a ticker introduced by this function alone, priced
  // by nobody and tested by nothing.
  for (const t of THEMES) {
    const b = themeBenchmark(t);
    if (!b) continue;
    assert.ok(
      t.assets.some((a) => a.t === b),
      `${t.id} benchmarks against ${b}, which is not in its own assets`
    );
  }
});

test("no theme benchmarks against a single-name equity", () => {
  for (const t of THEMES) {
    const b = themeBenchmark(t);
    if (!b) continue;
    const asset = t.assets.find((a) => a.t === b);
    assert.equal(asset?.k, "ETF", `${t.id} benchmarks against ${b}, which is not a fund`);
  }
});
