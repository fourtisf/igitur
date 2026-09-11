/**
 * The second matcher, and the boundary around it.
 *
 * A model reading the premise is the one addition to this product that could
 * quietly destroy its main claim. The refusal is the differentiator; a matcher
 * eager to please turns "no theme in this universe carries that claim" into a
 * plausible-looking portfolio assembled out of nothing, which is the exact
 * failure the whole site is built to avoid.
 *
 * These pin the boundary rather than the model's judgement. Nothing here calls
 * the API — the properties that matter are structural, and structural
 * properties can be tested without spending a request.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { assemble, buildBook } from "../lib/generator";
import { compose, forgetComposeCache } from "../lib/matcher/compose";
import { modelMatcherConfigured } from "../lib/matcher/llm";
import { THEMES, THEME_BY_ID } from "../lib/universe";

/** Source with comments stripped. The docblocks state these rules, so a naive
 *  scan finds the prohibited word in the sentence forbidding it. */
function code(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

test("with no key configured, nothing changes at all", async () => {
  delete process.env.ANTHROPIC_API_KEY;
  forgetComposeCache();
  assert.equal(modelMatcherConfigured(), false);

  // A refusal stays a refusal.
  const no = await compose("hello");
  assert.equal(no.result.ok, false);
  assert.equal(no.via, "keywords");

  // And a match is byte-for-byte the book the keyword path has always built.
  const yes = await compose(THEMES[0].claim);
  assert.deepEqual(yes.result, buildBook(THEMES[0].claim, []));
  assert.equal(yes.via, "keywords");
});

test("the model is never asked about a premise the keyword index matched", () => {
  // Not a preference — it is what keeps a shared link meaning one thing. If a
  // second opinion could overturn a working match, the same URL would build
  // different books on different days.
  const src = readFileSync("lib/matcher/compose.ts", "utf8");
  const order = src.indexOf("const keyword = buildBook(");
  const ask = src.indexOf("matchWithModel(");
  assert.ok(order > -1 && ask > order, "buildBook must run before the model is reached");
  assert.match(
    src,
    /if \(keyword\.ok\) return \{ result: keyword, via: "keywords" \};/,
    "a keyword match must return before the model is consulted"
  );
});

test("a model refusal leaves the keyword refusal standing", async () => {
  // Both matchers saying no is still no. The page must not invent a third
  // outcome, and the reader must get the refusal they would have got anyway.
  delete process.env.ANTHROPIC_API_KEY;
  forgetComposeCache();
  const out = await compose("that my cat will become mayor of the city");
  assert.equal(out.result.ok, false);
  assert.equal(out.result.ok === false && out.result.premise, "that my cat will become mayor of the city");
});

test("the model picks from the published ids and cannot express another", () => {
  // The schema enum is built from THEMES, so an id outside the universe is not
  // a thing the model can answer, and THEME_BY_ID checks it again after.
  const src = code("lib/matcher/llm.ts");
  assert.match(src, /ID_ENUM: \[string, \.\.\.string\[\]\] = \[NONE, \.\.\.THEMES\.map/);
  assert.match(src, /THEME_BY_ID\.get\(parsed\.theme\)/, "the returned id must be re-checked");
  // "Must not invent tickers" is structural here rather than textual: the
  // matcher never reaches the asset lists, so it has nothing to invent from.
  // (The word itself does appear in the prompt — instructing the model that a
  // bare ticker is not a claim, which is the rule working, not breaking.)
  assert.ok(!/\.assets\b/.test(src), "the matcher must not read a theme's holdings");
  assert.ok(!/\bUNIVERSE\b/.test(src), "the matcher must not import the asset universe");
  assert.ok(!/\bBALLAST\b/.test(src), "the matcher must not reach the ballast list");
});

test("it never sizes anything", () => {
  // "The weighting formula stays in application code so weights stay auditable
  // and reproducible" — README build order. The matcher returns a theme.
  const src = code("lib/matcher/llm.ts");
  for (const forbidden of ["pct", "MAX_WEIGHT", "holdings", "assemble"]) {
    assert.ok(!src.includes(forbidden), `the matcher must not touch ${forbidden}`);
  }
});

test("a model-chosen theme reaches the identical weighting", () => {
  // Same function, same invariants, whichever matcher chose the theme.
  for (const th of THEMES.slice(0, 6)) {
    const viaModel = assemble("a sentence the keyword list does not carry", [], {
      primary: th,
      secondary: null,
      hits: [],
      confidence: 70,
      alternatives: [],
    });
    assert.equal(viaModel.ok, true);
    if (!viaModel.ok) continue;

    const total = viaModel.holdings.reduce((s, h) => s + h.pct, 0);
    assert.equal(Math.round(total * 10) / 10, 100, `${th.id} must total exactly 100%`);
    assert.equal(viaModel.holdings[0].lead, true);
    assert.equal(viaModel.theme.id, th.id, "the lead must come from the chosen theme");
    const tickers = viaModel.holdings.map((h) => h.t);
    assert.equal(new Set(tickers).size, tickers.length, "no duplicate tickers");
    for (const h of viaModel.holdings) {
      if (h.ballast) continue;
      assert.ok(h.pct >= 5 && h.pct <= 27, `${h.t} at ${h.pct}% is outside the published band`);
    }
    // Every name must come from the published universe.
    for (const h of viaModel.holdings) {
      const inTheme = th.assets.some((a) => a.t === h.t);
      assert.ok(inTheme || h.ballast, `${h.t} is not in ${th.id} and is not ballast`);
    }
  }
});

test("reported terms are the reader's own words, never a paraphrase", () => {
  // These print on the page as "matched N terms: ...". A paraphrase there is
  // the site quoting words the reader did not write.
  const src = readFileSync("lib/matcher/llm.ts", "utf8");
  assert.match(src, /function ownWords/, "terms must be filtered against the premise");
  assert.match(src, /haystack\.includes\(term\)/, "a term not in the sentence must be dropped");
});

test("the endpoint returns a refusal as an answer, not an error", () => {
  // "The model must be allowed to return matched: false" — README build order.
  // A 4xx would make refusing look like a fault to every caller.
  const src = readFileSync("app/api/compose/route.ts", "utf8");
  assert.match(src, /matched: false/);
  const refusalBlock = src.slice(src.indexOf("if (!result.ok)"), src.indexOf("return NextResponse.json({\n    matched: true"));
  assert.doesNotMatch(refusalBlock, /status: 4\d\d/, "a refusal must be 200");
});

test("/status derives the line instead of asserting it", () => {
  // Written prose beside a feature is how this page drifted from the truth
  // twice already, in both directions.
  const src = readFileSync("app/status/page.tsx", "utf8");
  assert.match(src, /modelMatcherConfigured\(\)/, "/status must ask whether the matcher exists");
  const missing = /const ALWAYS_MISSING = \[([\s\S]*?)\];/.exec(src)?.[1] ?? "";
  assert.ok(
    !/language model/i.test(missing),
    "the line must be conditional, not permanently in the not-built list"
  );
});

test("every published theme is answerable", () => {
  // The enum is built from THEMES, so a theme the universe gains is matchable
  // the same day. This fails if an id ever stops resolving.
  for (const th of THEMES) assert.ok(THEME_BY_ID.get(th.id), `${th.id} does not resolve`);
});
