/**
 * Integrity of the published universe.
 *
 * HANDOFF.md §7 calls the conviction scores the weakest link in the product's
 * credibility, and §14 keeps that published. Tying each score to disclosed
 * segment revenue is step 5 of the build order and needs filings this repo does
 * not have. What CAN be enforced now is that the data cannot rot quietly: these
 * tests catch the shapes of staleness and typo that would otherwise reach a
 * reader as a silently wrong book.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { BALLAST, REVIEWED, THEMES, UNIVERSE } from "../lib/universe";
import { scoreThemes } from "../lib/generator";

const RISKS = new Set(["Speculative", "Aggressive", "Moderate", "Conservative"]);
const KINDS = new Set(["Equity", "ETF", "Crypto", "Treasury", "Commodity"]);

test("theme ids are unique and URL-safe", () => {
  const ids = THEMES.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate theme id");
  for (const id of ids) assert.match(id, /^[a-z][a-z0-9-]*$/, `bad theme id: ${id}`);
});

test("every theme can actually build a book", () => {
  // buildBook takes 6 names from the primary theme; fewer than that and a
  // reader gets a thinner book than the product promises.
  for (const th of THEMES) {
    assert.ok(th.assets.length >= 6, `${th.id} has only ${th.assets.length} assets`);
    assert.ok(RISKS.has(th.risk), `${th.id} has risk ${th.risk}`);
    assert.ok(th.horizon.trim().length > 0, `${th.id} has no horizon`);
  }
});

test("every theme carries both sides of its argument", () => {
  for (const th of THEMES) {
    for (const field of ["claim", "forCase", "againstCase"] as const) {
      assert.ok(th[field].trim().length > 20, `${th.id}.${field} is missing or too short`);
    }
    // A tool that only argues one way is a sales page.
    assert.notEqual(th.forCase, th.againstCase, `${th.id} argues itself`);
  }
});

test("no keyword can be unmatchable", () => {
  // scoreThemes lowercases the premise before matching, so an uppercase
  // keyword could never match anything. Same for stray whitespace.
  for (const th of THEMES) {
    assert.ok(th.kw.length > 0, `${th.id} has no keywords`);
    for (const k of [...th.kw, ...th.neg]) {
      assert.equal(k, k.toLowerCase(), `${th.id}: "${k}" is not lowercase and can never match`);
      assert.equal(k, k.trim(), `${th.id}: "${k}" has padding whitespace`);
      assert.ok(k.length > 0, `${th.id} has an empty keyword`);
    }
    assert.equal(new Set(th.kw).size, th.kw.length, `${th.id} repeats a keyword`);
  }
});

test("a theme's negative keywords never fight its own positives", () => {
  for (const th of THEMES) {
    for (const n of th.neg) {
      assert.ok(!th.kw.includes(n), `${th.id}: "${n}" is both positive and negative`);
    }
  }
});

test("every holding is fully described", () => {
  for (const th of THEMES) {
    for (const a of th.assets) {
      assert.match(a.t, /^[A-Z][A-Z0-9.-]{0,6}$/, `${th.id}: bad ticker ${a.t}`);
      assert.ok(a.n.trim().length > 1, `${th.id}/${a.t} has no name`);
      assert.ok(KINDS.has(a.k), `${th.id}/${a.t} has kind ${a.k}`);
      assert.ok(
        Number.isInteger(a.c) && a.c > 0 && a.c <= 100,
        `${th.id}/${a.t} conviction ${a.c} is out of range`
      );
      // Every weight carries a reason. That is the product.
      assert.ok(a.why.trim().length > 15, `${th.id}/${a.t} has no reason`);
      assert.ok(a.why.trim().endsWith("."), `${th.id}/${a.t} reason is not a sentence`);
    }
  }
});

test("no theme lists the same ticker twice", () => {
  for (const th of THEMES) {
    const t = th.assets.map((a) => a.t);
    assert.equal(new Set(t).size, t.length, `${th.id} repeats a ticker`);
  }
});

test("a ticker means the same company everywhere it appears", () => {
  // Several names sit in more than one theme (CEG, VST, NVDA). If one copy is
  // renamed and the others are not, /universe and the book disagree.
  const seen = new Map<string, { n: string; k: string; where: string }>();
  for (const th of THEMES) {
    for (const a of th.assets) {
      const prev = seen.get(a.t);
      if (!prev) {
        seen.set(a.t, { n: a.n, k: a.k, where: th.id });
        continue;
      }
      assert.equal(a.n, prev.n, `${a.t}: "${a.n}" in ${th.id} vs "${prev.n}" in ${prev.where}`);
      assert.equal(a.k, prev.k, `${a.t}: kind differs between ${th.id} and ${prev.where}`);
    }
  }
});

test("the ballast sleeve covers every risk level", () => {
  // buildBook indexes BALLAST[0] for Speculative and BALLAST[2] for
  // Conservative, and draws 0 or 1 otherwise.
  assert.equal(BALLAST.length, 3);
  for (const b of BALLAST) {
    assert.match(b.t, /^[A-Z]{2,6}$/, `bad ballast ticker ${b.t}`);
    assert.ok(KINDS.has(b.k), `ballast ${b.t} has kind ${b.k}`);
    assert.ok(b.why.trim().length > 15, `ballast ${b.t} has no reason`);
  }
});

test("the published universe matches the themes it is built from", () => {
  const fromThemes = new Set(THEMES.flatMap((t) => t.assets.map((a) => a.t)));
  for (const t of fromThemes) {
    assert.ok(
      UNIVERSE.some((u) => u.t === t),
      `${t} is held by a theme but missing from the published universe`
    );
  }
  const ids = UNIVERSE.map((u) => u.t);
  assert.equal(new Set(ids).size, ids.length, "the universe lists a ticker twice");
  // The benchmark is in the universe but is not a holding.
  assert.ok(UNIVERSE.some((u) => u.t === "SPY" && u.theme === "Benchmark"));
});

test("the reviewed date is a real, stated date", () => {
  assert.match(REVIEWED, /^\d{1,2} [A-Z][a-z]+ \d{4}$/, `REVIEWED is "${REVIEWED}"`);
  assert.ok(!Number.isNaN(Date.parse(REVIEWED)), `REVIEWED does not parse: ${REVIEWED}`);
});

test("no theme is unreachable behind another", () => {
  // If one theme's claim outscores another theme's own claim, the second theme
  // can never lead a book and its names are effectively unpublishable.
  for (const th of THEMES) {
    const ranked = scoreThemes(th.claim);
    assert.equal(ranked[0].th.id, th.id, `${th.id} is shadowed by ${ranked[0].th.id}`);
  }
});
