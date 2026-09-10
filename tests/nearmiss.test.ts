/**
 * The way out of a refusal.
 *
 * The danger with this file's subject is not that it says something unhelpful.
 * It is that it quietly becomes a second, looser matcher — a premise the
 * generator refused, answered with a book anyway, one release later. These
 * tests pin the boundary: it may rank and explain the published themes, and it
 * may never build anything from the reader's sentence.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildBook, matchText, scoreThemes } from "../lib/generator";
import { nearMisses } from "../lib/nearmiss";
import { THEMES } from "../lib/universe";

/** Premises the universe genuinely does not carry. */
const REFUSED = [
  "that my cat will become mayor of the city",
  "that the colour purple becomes fashionable again",
  "that manufacturers relocate away from far away places",
  "that delivery matters less than military over the next ten years",
];

test("every premise used here is actually refused", () => {
  // If one of these starts building a book the rest of this file is testing
  // nothing, silently.
  for (const p of REFUSED) {
    assert.equal(buildBook(p).ok, false, `"${p}" is no longer refused`);
  }
});

test("suggesting a way out does not soften the refusal", () => {
  for (const p of REFUSED) {
    nearMisses(p);
    assert.equal(buildBook(p).ok, false, `"${p}" became buildable`);
  }
});

test("every suggestion is a published theme, and its own claim builds it", () => {
  // The link on the card goes to the theme's claim, not to the reader's
  // premise. If that claim did not build this theme the card would send them
  // somewhere else entirely.
  for (const p of REFUSED) {
    for (const { th } of nearMisses(p)) {
      assert.ok(
        THEMES.some((t) => t.id === th.id),
        `${th.id} is not in the published universe`
      );
      const book = buildBook(th.claim);
      assert.equal(book.ok, true, `${th.id}'s own claim no longer builds`);
      assert.equal(book.ok && book.theme.id, th.id);
    }
  }
});

test("a suppressed reason names a real negative keyword, present in the premise", () => {
  const p = "that delivery matters less than military over the next ten years";
  const found = nearMisses(p).filter((m) => m.reason.kind === "suppressed");
  assert.ok(found.length, "this premise must produce at least one veto explanation");

  const q = matchText(p);
  for (const { th, reason } of found) {
    if (reason.kind !== "suppressed") continue;
    assert.ok(th.neg.includes(reason.term), `${reason.term} is not a negative for ${th.id}`);
    assert.ok(q.includes(reason.term), `${reason.term} is not in the premise`);
    // The hits it reports are the matcher's own, not this file's opinion.
    const hits = scoreThemes(p, THEMES).find((r) => r.th.id === th.id)?.hits ?? [];
    assert.deepEqual(reason.hits, hits);
  }
});

test("a lexical reason names words that really are in the premise and near the vocabulary", () => {
  const p = "that manufacturers relocate away from far away places";
  const q = matchText(p);
  const found = nearMisses(p).filter((m) => m.reason.kind === "lexical");
  assert.ok(found.length, "this premise must produce at least one stem hint");

  for (const { th, reason } of found) {
    if (reason.kind !== "lexical") continue;
    for (const w of reason.shared) {
      assert.ok(q.includes(w), `${w} is not in the premise`);
      const near = th.kw.some((k) =>
        k.split(" ").some((part) => part.length >= 5 && part.slice(0, 5) === w.slice(0, 5))
      );
      assert.ok(near, `${w} shares no stem with any keyword of ${th.id}`);
    }
  }
});

test("filler words never become a reason", () => {
  // "that ... will ... years" pairs with something in a 354-keyword list on
  // almost any premise. A hint drawn from those is noise wearing a reason's
  // clothes.
  for (const p of REFUSED) {
    for (const { reason } of nearMisses(p)) {
      if (reason.kind !== "lexical") continue;
      for (const w of reason.shared) {
        assert.ok(
          !["that", "will", "years", "become", "matters", "little"].includes(w),
          `${w} should have been filtered`
        );
      }
    }
  }
});

test("it is deterministic and respects its limit", () => {
  for (const p of REFUSED) {
    assert.deepEqual(nearMisses(p), nearMisses(p));
    assert.ok(nearMisses(p, 3).length <= 3);
    assert.ok(nearMisses(p, 1).length <= 1);
  }
});

test("a premise with nothing near it gets nothing, rather than a filler suggestion", () => {
  // The full grid is the honest fallback. Inventing a closest theme for a
  // premise about a cat is how a refusal turns into a guess.
  assert.deepEqual(nearMisses("that my cat will become mayor of the city"), []);
});

test("the refusal page never builds a book from the refused premise", () => {
  // Read as source, because this is a property of what the component links to
  // and a rendered assertion cannot reach it.
  const src = readFileSync("components/NoMatch.tsx", "utf8");
  const calls = [...src.matchAll(/bookHref\(([^,)]+)/g)].map((m) => m[1].trim());
  assert.ok(calls.length, "NoMatch must still link to books");
  for (const arg of calls) {
    assert.ok(
      arg === "premise" || arg === "th.claim",
      `NoMatch builds a book from ${arg}; only the reader's own retry and a theme's claim are allowed`
    );
  }
});
