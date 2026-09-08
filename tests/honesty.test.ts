/**
 * The site must never describe its own data wrongly — in either direction.
 *
 * This bug class has now appeared twice. First the pages claimed real data
 * because a key was *set*, while a rejected key left every figure generated.
 * Then, fixed, they claimed synthetic data unconditionally, so a working vendor
 * would have had /method and /legal telling readers that real quotes were
 * invented. Both are the same mistake: prose written beside the data instead of
 * derived from it.
 *
 * A unit test cannot render a server component, but it can insist that any page
 * making a claim about the data has read the data first. That is the property
 * that was missing both times.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { SITE, handleFor } from "../lib/site";
import { twitterCard } from "../lib/twitter-card";

function pages(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) pages(p, out);
    else if (e.endsWith(".tsx") || e.endsWith(".ts")) out.push(p);
  }
  return out;
}

/** Prose that asserts something about where the numbers came from. */
const CLAIMS = [
  /\bis synthetic\b/,
  /\bare synthetic\b/,
  /\bAll of it is synthetic\b/,
  /Prototype figures/,
  /not live quotes/,
  /come from \{providerName\(\)\}/,
];

/**
 * Evidence the file asked what the data actually is.
 *
 * Deliberately not `\blive\b`: a page can declare `const live = false` and
 * satisfy that while claiming exactly as confidently as before. The name of the
 * variable is not the property. Only these three actually consult the data.
 */
const READS_THE_DATA = /marketIsReal\(\)|\.synthetic|track\.live/;

test("no page claims to know where its numbers came from without checking", () => {
  const offenders: string[] = [];

  for (const file of pages("app")) {
    const src = readFileSync(file, "utf8");
    // Comments explain the rule; they are not shown to a reader.
    const prose = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");

    if (!CLAIMS.some((re) => re.test(prose))) continue;
    if (READS_THE_DATA.test(prose)) continue;
    offenders.push(file);
  }

  assert.deepEqual(
    offenders,
    [],
    `these pages describe the data without reading it:\n  ${offenders.join("\n  ")}`
  );
});

test("the legal page in particular derives its disclosure", () => {
  // It is the page people quote back at you, and the one a regulator reads.
  const src = readFileSync("app/legal/page.tsx", "utf8");
  assert.match(src, /marketIsReal/, "/legal must ask what the data is");
  assert.match(
    src,
    /may be delayed/,
    "/legal must carry a third-party data disclosure for the live case"
  );
});

test("a track page enters the index only on real figures", () => {
  const src = readFileSync("app/track/[slug]/page.tsx", "utf8");
  assert.match(src, /robots: \{ index: live/, "noindex must follow the computed series");
  assert.doesNotMatch(src, /robots: \{ index: true/, "never unconditionally indexable");
});

test("with no handle configured the site links to no social account", () => {
  // The site is public. Linking a handle nobody here owns hands the project's
  // name — and /token's contract-address promise — to whoever registers it.
  assert.equal(SITE.x, null);
  assert.equal(SITE.telegram, null);
  assert.equal(SITE.xHandle, null);
});

test("a configured handle is accepted however it is written", () => {
  assert.equal(handleFor("@igitur"), "igitur");
  assert.equal(handleFor("https://x.com/igitur"), "igitur");
  assert.equal(handleFor("igitur"), "igitur");
  // Not a handle: refuse rather than build a broken link.
  assert.equal(handleFor("igitur xyz"), null);
  assert.equal(handleFor(""), null);
  assert.equal(handleFor(undefined), null);
});

test("no page hand-writes its own Twitter card", () => {
  // Next replaces the whole `twitter` object when a page exports one, so a
  // hand-written card silently drops the account attribution the root set.
  // Sixteen pages did exactly that. Building it in one place is the fix; this
  // stops the seventeenth.
  const offenders = pages("app")
    .filter((f) => /twitter: \{\s*\n?\s*card:/.test(readFileSync(f, "utf8")))
    .map((f) => f);
  assert.deepEqual(offenders, [], `hand-written twitter cards in:\n  ${offenders.join("\n  ")}`);
});

test("the card carries no attribution when no handle is held", () => {
  assert.equal("site" in twitterCard("/x.png"), false);
  assert.equal("creator" in twitterCard("/x.png"), false);
});
