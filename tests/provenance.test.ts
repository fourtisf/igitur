/**
 * Provenance: which universe a book was built against, and when the claim was
 * made. Both were missing, and both are unfixable retroactively — a link
 * already in circulation cannot be told what it was built on.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { buildBook, scoreThemes } from "../lib/generator";
import { MATCH_INDEX } from "../lib/match-index";
import {
  bookCanonical,
  bookHref,
  daysSince,
  parseStated,
  parseUniverse,
  today,
  trackHref,
} from "../lib/routes";
import { sessionsFor } from "../components/TrackChart";
import { CHANGELOG, THEMES, UNIVERSE_VERSION } from "../lib/universe";

test("a book URL records the universe it was built against", () => {
  const url = new URL(bookHref("nuclear restarts", [], { universe: 3 }), "https://x.test");
  assert.equal(url.searchParams.get("u"), "3");
  assert.equal(parseUniverse("3"), 3);
});

test("a link with no version is reported as unknown, never assumed current", () => {
  // Claiming to know would be the same silent lie the field exists to prevent.
  assert.equal(parseUniverse(undefined), null);
  assert.equal(parseUniverse(""), null);
  assert.equal(parseUniverse("not-a-number"), null);
  assert.equal(parseUniverse("0"), null);
});

test("the changelog covers every version up to the current one", () => {
  assert.ok(CHANGELOG.length >= 1);
  const versions = CHANGELOG.map((r) => r.version);
  assert.equal(new Set(versions).size, versions.length, "duplicate version in the changelog");
  assert.equal(Math.max(...versions), UNIVERSE_VERSION, "current universe is not in the changelog");
  // Newest first, so the page reads correctly top to bottom.
  for (let i = 1; i < versions.length; i++) {
    assert.ok(versions[i - 1] > versions[i], "changelog is not newest-first");
  }
  for (const r of CHANGELOG) {
    assert.ok(r.summary.trim().length > 20, `v${r.version} has no summary`);
    assert.ok(!Number.isNaN(Date.parse(r.date)), `v${r.version} date does not parse: ${r.date}`);
  }
});

test("the stated date round-trips and rejects nonsense", () => {
  const url = new URL(bookHref("copper supply", [], { stated: "2026-09-07" }), "https://x.test");
  assert.equal(url.searchParams.get("d"), "2026-09-07");
  assert.equal(parseStated("2026-09-07"), "2026-09-07");
  for (const bad of ["", "yesterday", "2026-13-01", "07-09-2026", "1999-01-01", "3000-01-01"]) {
    assert.equal(parseStated(bad), null, `accepted ${JSON.stringify(bad)}`);
  }
});

test("today() is a valid stated date the parser accepts", () => {
  assert.match(today(), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(parseStated(today()), today());
  assert.equal(daysSince(today()), 0);
});

test("provenance never changes what a book contains", () => {
  // u and d are metadata. If either reached buildBook, a shared link would
  // stop being reproducible.
  const base = JSON.stringify(buildBook("nuclear restarts will power datacentres"));
  for (const drop of [[], ["CCJ"]]) {
    assert.equal(JSON.stringify(buildBook("nuclear restarts will power datacentres", drop)),
      JSON.stringify(buildBook("nuclear restarts will power datacentres", drop)));
  }
  assert.equal(base, JSON.stringify(buildBook("nuclear restarts will power datacentres")));
});

test("the canonical URL carries only what determines the book", () => {
  // Otherwise the same book stated on two days is two indexable pages.
  const a = bookCanonical("copper supply cannot keep up", ["FCX"]);
  const url = new URL(a, "https://x.test");
  assert.equal(url.searchParams.get("u"), null);
  assert.equal(url.searchParams.get("d"), null);
  assert.equal(url.searchParams.get("p"), "copper supply cannot keep up");
  assert.equal(url.searchParams.get("x"), "FCX");
  // Same book, different provenance, one canonical.
  assert.equal(
    bookCanonical("copper supply cannot keep up", ["FCX"]),
    bookCanonical("copper supply cannot keep up", ["FCX"])
  );
});

test("the tracking window follows the stated date", () => {
  // "Since stated" needs a stated date. Without one it falls back and the page
  // says so rather than inventing a start.
  assert.equal(sessionsFor(null), 180);
  assert.equal(sessionsFor(365), 252);
  assert.ok(sessionsFor(30) < sessionsFor(365));
  // Bounded at both ends, so a hand-edited date cannot ask for a silly chart.
  assert.equal(sessionsFor(0), 20);
  assert.equal(sessionsFor(100000), 1260);
});

test("a track URL carries the date so the window survives sharing", () => {
  const url = new URL(trackHref("copper supply", { stated: "2026-06-01" }), "https://x.test");
  assert.equal(url.searchParams.get("d"), "2026-06-01");
});

test("the composer's live matcher agrees with the book it will produce", () => {
  // The composer scores against a trimmed index to keep the universe prose off
  // the wire. If the two ever disagreed, the composer would promise a theme the
  // book then refuses.
  const corpus = [
    ...THEMES.map((t) => t.claim),
    "nuclear restarts will power datacentres",
    "drones will replace delivery vans in cities",
    "my cat is very fluffy",
    "copper",
    "",
  ];
  for (const p of corpus) {
    const full = scoreThemes(p, THEMES).map((r) => [r.th.id, r.score, r.hits]);
    const lite = scoreThemes(p, MATCH_INDEX).map((r) => [r.th.id, r.score, r.hits]);
    assert.equal(JSON.stringify(lite), JSON.stringify(full), `matcher disagreed on ${JSON.stringify(p)}`);
  }
});

test("the composer's confidence is the confidence the book will show", () => {
  // The read-out under the field must not flatter. It recomputes the same
  // figure buildBook lands on, from the same hits, so a reader is never told
  // 80% and then handed a book that says 40%.
  const confidenceOf = (hits: number, score: number) =>
    Math.min(96, 26 + hits * 14 + (score > 12 ? 8 : 0));
  for (const p of [
    "nuclear",
    "nuclear restarts will power datacentres",
    "uranium enrichment and smr reactor buildout",
    ...THEMES.slice(0, 8).map((t) => t.claim),
  ]) {
    const book = buildBook(p);
    if (!book.ok) continue;
    const live = scoreThemes(p, MATCH_INDEX)[0];
    assert.equal(live.th.id, book.theme.id, `composer and book disagree on the theme for "${p}"`);
    assert.equal(
      confidenceOf(live.hits.length, live.score),
      book.confidence,
      `composer would show a different confidence than the book for "${p}"`
    );
  }
});

test("the match index carries the keywords and none of the prose", () => {
  assert.equal(MATCH_INDEX.length, THEMES.length);
  const bytes = JSON.stringify(MATCH_INDEX).length;
  assert.ok(bytes < JSON.stringify(THEMES).length * 0.35, `index is ${bytes} bytes, too much prose`);
  for (const t of MATCH_INDEX) {
    assert.ok(!("assets" in t) && !("forCase" in t) && !("claim" in t), `${t.id} leaks prose`);
  }
});

test("a book reports the themes that scored but did not lead", () => {
  const b = buildBook("nuclear restarts will power datacentres");
  assert.ok(b.ok);
  assert.ok(Array.isArray(b.alternatives));
  for (const a of b.alternatives) {
    assert.ok(a.score > 0, `${a.id} listed with score ${a.score}`);
    assert.notEqual(a.id, b.theme.id, "the leading theme is listed as an alternative");
    assert.notEqual(a.id, b.second?.id, "the secondary theme is listed as an alternative");
  }
  // Ranked, and never more than a handful.
  assert.ok(b.alternatives.length <= 3);
  for (let i = 1; i < b.alternatives.length; i++) {
    assert.ok(b.alternatives[i - 1].score >= b.alternatives[i].score);
  }
});
