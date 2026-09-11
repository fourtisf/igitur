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

import { corpus } from "../lib/ask/corpus";
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

test("the site links to the accounts that are actually held", () => {
  // These were null while the handles were invented, because linking a handle
  // nobody owns hands the project's name — and /token's contract-address
  // promise — to whoever registers it. Both are claimed now, so they are
  // defaults in code rather than environment-only: a deploy that forgets a
  // variable must not silently un-launch the channels on a live site.
  assert.equal(SITE.x, "https://x.com/Igiturapp");
  assert.equal(SITE.telegram, "https://t.me/igiturchannel");
});

test("a handle that is not handle-shaped still yields no link", () => {
  // The guard that made the placeholders safe has to keep working, or a typo in
  // the environment produces a link to nowhere rather than no link.
  assert.equal(handleFor(" "), null);
  assert.equal(handleFor("not a handle"), null);
  assert.equal(handleFor("https://x.com/"), null);
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

test("the card is attributed to the account that holds the name", () => {
  // Without this, a post about this site credits nobody — and on X an
  // unattributed card is one anyone can claim by posting the link first.
  const card = twitterCard("/x.png") as { site?: string; creator?: string };
  assert.equal(card.site, "@Igiturapp");
  assert.equal(card.creator, "@Igiturapp");
});

test("the contract-address strip never invents an address", () => {
  // When it is up it is on every page, so it is the most-read sentence on the
  // site. It must show the deployed address or nothing — never a placeholder
  // that could be mistaken for the real thing.
  const src = readFileSync("components/TokenStrip.tsx", "utf8");
  assert.match(src, /SITE\.token/, "the strip must read the address, not carry one");
  assert.doesNotMatch(src, /0x[0-9a-fA-F]{6}/, "no address literal belongs in this component");
  // Deployed 11 September 2026. The string is pinned here because this is the
  // one field on the site where being wrong costs a reader their money, and a
  // silent edit to it must fail the build rather than ship.
  assert.equal(
    SITE.token.contractAddress,
    "0x4f30670d473e43524bf35c621aa5f525be6038d9",
    "the published address must be exactly the deployed one"
  );
});

test("the address exists in exactly one place in the repository", () => {
  // Two copies is two things to get wrong, and the one that drifts is the one
  // somebody pastes into a wallet. Every surface — the strip on every page,
  // /token, the footer, the assistant — reads SITE.token.contractAddress.
  const roots = ["lib", "app", "components", "scripts", "brand"];
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, e.name);
      if (e.isDirectory()) {
        walk(path);
      } else if (/\.(ts|tsx|mjs|json|md|css)$/.test(e.name)) {
        if (/0x[0-9a-fA-F]{40}/.test(readFileSync(path, "utf8"))) found.push(path);
      }
    }
  };
  for (const r of roots) walk(r);
  assert.deepEqual(found, ["lib/site.ts"], "an address literal may live only in lib/site.ts");
});

test("the assistant is given the address, and told it is the only one", () => {
  // "What is the contract address?" is the highest-stakes question this
  // assistant will ever be asked, and the one a scammer most wants it to get
  // wrong. It answers from the corpus or not at all.
  const c = corpus();
  assert.ok(c.includes(SITE.token.contractAddress!), "the corpus must carry the real address");
  assert.match(c, /ANY other address is fake/);
  assert.match(c, /never guess at one/);
});

test("the strip stands down until there is an address, and comes back by itself", () => {
  // Before launch it pinned "Coming soon" to the top of every page, which is
  // the first thing a visitor read on a site trying to show it has a working
  // product. It now renders nothing — but the layout offset and the strip must
  // agree about that, and both must be driven by the address alone, so that
  // publishing one brings the strip back with no second flag to remember.
  const src = readFileSync("components/TokenStrip.tsx", "utf8");
  assert.match(src, /if \(!contractAddress\) return null;/, "it must render nothing with no address");
  assert.match(
    src,
    /export const hasStrip = SITE\.token\.contractAddress !== null;/,
    "the layout offset must be derived from the same value the strip is"
  );

  const layout = readFileSync("app/layout.tsx", "utf8");
  assert.match(layout, /hasStrip \? "" : " no-strip"/, "the layout must zero --strip when the strip is absent");

  const css = readFileSync("app/globals.css", "utf8");
  assert.match(css, /\.no-strip\{--strip:0px\}/, "no-strip must actually zero the offset");
});

test("the status page never promises more than the generator does", () => {
  // Over-claiming on /status is worse than anywhere else: it is the page that
  // exists to be trusted about what works. "Any premise" in particular is the
  // one sentence this product cannot say — refusing is the product.
  const src = readFileSync("app/status/page.tsx", "utf8");
  assert.doesNotMatch(src, /from any premise/i, '"any premise" contradicts the refusal');

  // The lists moved to lib/status.ts when /ask began answering from them too.
  // This reads the one copy rather than a page that now only renders it.
  const lists = readFileSync("lib/status.ts", "utf8");
  const list = (name: string) =>
    (lists.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`))?.[1] ?? "")
      .split("\n").map((l) => l.trim().replace(/^"|",$/g, "")).filter((l) => l.length > 3);
  const live = list("ALWAYS_LIVE");
  const missing = list("ALWAYS_MISSING");
  assert.ok(live.length > 0 && missing.length > 0, "both lists must parse");
  const both = live.filter((l) => missing.includes(l));
  assert.deepEqual(both, [], `claimed as built and not built at once: ${both.join(", ")}`);

  // Forking shipped; the missing list must not still claim it did not.
  assert.ok(
    live.some((l) => /Forking/i.test(l)),
    "forking is built — /p/<id> offers it and the ledger stores the weights"
  );
  assert.ok(!missing.some((l) => /forking/i.test(l)), "the missing list still claims forking is absent");
});
