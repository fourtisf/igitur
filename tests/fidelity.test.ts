/**
 * The port must not drift from the prototype.
 *
 * HANDOFF.md §0: "Do not rebuild the logic from scratch — port it." This test
 * loads the original implementation straight out of premise.html and diffs it
 * against lib/generator.ts across a large corpus. If someone retunes a constant
 * in one place and not the other, this fails.
 *
 * When the generator is deliberately changed (the LLM matcher of §4, say),
 * this test is the thing that should be updated last and on purpose.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { buildBook, scoreThemes } from "../lib/generator";
import { THEMES } from "../lib/universe";

const html = fs.readFileSync(
  path.join(import.meta.dirname, "..", "premise.html"),
  "utf8"
);

function between(from: string, to: string): string {
  const i = html.indexOf(from);
  const j = html.indexOf(to);
  assert.ok(i > -1 && j > i, `prototype marker not found: ${from}`);
  return html.slice(i, j);
}

const SECTION_UNIVERSE = "/* ============================================================\n   1. THE UNIVERSE";
const SECTION_MATCHING = "/* ============================================================\n   2. MATCHING";
const SECTION_RENDER = "/* ============================================================\n   3. RENDER";

/** The shape of a book as the prototype returns it, loosely typed: it is
 *  plain JavaScript from a string, so only the fields compared here matter. */
interface ProtoHolding {
  t: string;
  pct: number;
  src: string;
  lead?: boolean;
  ballast?: boolean;
}
interface ProtoBook {
  ok: boolean;
  premise: string;
  emptied?: boolean;
  theme?: { id: string };
  second?: { id: string } | null;
  risk?: string;
  horizon?: string;
  confidence?: number;
  hits?: string[];
  seed?: number;
  holdings?: ProtoHolding[];
}
type Proto = {
  buildBook: (p: string, drop?: string[]) => ProtoBook;
  scoreThemes: (t: string) => { th: { id: string }; score: number; hits: string[]; first: number }[];
};

const prototype: Proto = new Function(
  between("function fnv(s)", SECTION_UNIVERSE) +
    "\n" +
    between("var BALLAST=[", SECTION_MATCHING) +
    "\n" +
    between("function scoreThemes(text)", SECTION_RENDER) +
    "\nreturn { buildBook: buildBook, scoreThemes: scoreThemes };"
)() as Proto;

const CORPUS: string[] = [
  ...THEMES.map((t) => t.claim),
  "drones will replace delivery vans in cities",
  "banks will be disintermediated by stablecoin rails",
  "the ledger rails of finance",
  "copper supply cannot keep up with electrification",
  "nuclear restarts will power datacentres",
  "my cat is very fluffy and likes the sun",
  "AI",
  "rails",
  "",
  "   ",
];
for (let i = 0; i < 200; i++) {
  const t = THEMES[i % THEMES.length];
  CORPUS.push(t.claim.toUpperCase());
  CORPUS.push(`${t.name} will matter in ${i} ways`);
  CORPUS.push(`${t.kw[i % t.kw.length]} changes everything by 20${30 + (i % 40)}`);
}

const DROPS: string[][] = [[], ["NVDA"], ["NVDA", "TSM"], ["CCJ", "BWXT", "LEU"], ["SGOV"]];

/** The observable book: everything a reader or a shared URL can see. */
function shape(x: ProtoBook): string {
  if (!x.ok) return JSON.stringify({ ok: false, premise: x.premise, emptied: !!x.emptied });
  return JSON.stringify({
    ok: true,
    premise: x.premise,
    theme: x.theme?.id,
    second: x.second ? x.second.id : null,
    risk: x.risk,
    horizon: x.horizon,
    confidence: x.confidence,
    hits: x.hits,
    seed: x.seed,
    holdings: (x.holdings ?? []).map((h) => [h.t, h.pct, h.src, !!h.lead, !!h.ballast]),
  });
}

test("scoreThemes matches the prototype exactly", () => {
  for (const p of CORPUS) {
    const a = prototype.scoreThemes(p).map((r) => [r.th.id, r.score, r.hits, r.first]);
    const b = scoreThemes(p).map((r) => [r.th.id, r.score, r.hits, r.first]);
    assert.equal(JSON.stringify(b), JSON.stringify(a), `scoring drifted for ${JSON.stringify(p)}`);
  }
});

test("buildBook matches the prototype exactly, including hand-dropped holdings", () => {
  let compared = 0;
  for (const p of CORPUS) {
    for (const d of DROPS) {
      const a = shape(prototype.buildBook(p, d.slice()));
      const b = shape(buildBook(p, d.slice()) as unknown as ProtoBook);
      assert.equal(b, a, `book drifted for ${JSON.stringify(p)} drop=${JSON.stringify(d)}`);
      compared++;
    }
  }
  assert.ok(compared > 3000, `expected a broad corpus, compared only ${compared}`);
});
