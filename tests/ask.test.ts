/**
 * The assistant, and the line it must not cross.
 *
 * A free-text assistant on a site about portfolios is the quickest way to lose
 * the position everything here rests on: research output, never advice. One
 * helpful sentence — "NVDA looks like the best entry here" — undoes /legal,
 * /about and every disclaimer on every page, and it would be the sentence
 * somebody screenshots.
 *
 * So these test the boundary, not the model's prose. The boundary is
 * structural: what it is given, what it is told, and what the page says before
 * anyone types.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { corpus, RULES } from "../lib/ask/corpus";
import { ALWAYS_LIVE, ALWAYS_MISSING } from "../lib/status";
import { NAMES, THEMES } from "../lib/universe";

/** Line breaks in a template literal are formatting, not content. */
const flat = (t: string) => t.replace(/\s+/g, " ");
const CORPUS = flat(corpus());

test("it is told, first and plainly, never to advise", () => {
  const first = RULES.split("\n").find((l) => l.startsWith("1."));
  assert.ok(first, "there must be a first rule");
  assert.match(first!, /NEVER give investment advice/);
  assert.match(RULES, /NEVER predict a price/);
  assert.match(RULES, /never say whether something is cheap, expensive, undervalued/);
});

test("it cannot answer beyond what it was handed", () => {
  // No tools, no search, no memory. If a fact is not in the corpus it does not
  // have it, and the rules tell it to say so rather than reach for one.
  assert.match(RULES, /Answer ONLY from the material below/);
  assert.match(RULES, /Never invent a ticker, a number, a theme, a date or a feature/);
  const route = readFileSync("app/api/ask/route.ts", "utf8");
  assert.ok(!route.includes("tools:"), "the assistant must have no tools");
  assert.ok(!route.includes("web_search"), "and no search");
});

test("the corpus is built from the universe, never transcribed", () => {
  // A hand-kept copy goes stale, and an assistant answering from a stale copy
  // tells a reader a theme holds a name it no longer holds.
  for (const th of THEMES) {
    assert.ok(CORPUS.includes(flat(th.claim)), `${th.id}'s claim is missing from the corpus`);
    assert.ok(CORPUS.includes(flat(th.againstCase)), `${th.id}'s case against is missing`);
    for (const a of th.assets) {
      assert.ok(CORPUS.includes(a.t), `${a.t} is missing from the corpus`);
      assert.ok(CORPUS.includes(flat(a.why)), `${a.t}'s reason is missing`);
    }
  }
  assert.ok(CORPUS.includes(String(NAMES)), "the universe size must be stated");
});

test("what is not built is in there, as not built", () => {
  // Otherwise the friendliest thing an assistant can do is promise a feature.
  for (const line of ALWAYS_MISSING) {
    assert.ok(CORPUS.includes(flat(line)), `missing from corpus: ${line}`);
  }
  for (const line of ALWAYS_LIVE) {
    assert.ok(CORPUS.includes(flat(line)), `missing from corpus: ${line}`);
  }
  assert.match(RULES, /say it is not built/);
  assert.match(RULES, /Never imply it is coming soon/);
});

test("it says where the numbers come from", () => {
  // The most important sentence on the site, and the one every competitor
  // buries: the conviction scores are somebody's judgement.
  assert.match(CORPUS, /EDITORIAL JUDGEMENTS, not model output/);
  assert.match(RULES, /editorial judgements, published so they can be argued with/);
});

test("the refusal is described as designed, not as a fault", () => {
  assert.match(CORPUS, /refusing is a designed outcome, not a failure/);
});

test("the page warns before anyone types, not after", () => {
  const page = readFileSync("components/AskChat.tsx", "utf8");
  assert.match(page, /will not tell you what to buy/);
  assert.match(page, /nothing here is investment advice/i);
  // Placed with the field rather than at the bottom of the page.
  const warn = page.indexOf("will not tell you what to buy");
  const field = page.indexOf("Your question");
  assert.ok(warn > -1 && field > -1, "both must exist");
});

test("the endpoint is capped, bounded and off without a key", () => {
  const route = readFileSync("app/api/ask/route.ts", "utf8");
  assert.match(route, /const LIMIT = \d+/, "it must be rate limited — it spends money");
  assert.match(route, /MAX_CHARS/, "a question must be bounded");
  assert.match(route, /MAX_TURNS/, "the history sent back must be bounded");
  assert.match(route, /modelMatcherConfigured\(\)/, "no key means no assistant");
  const gate = route.indexOf("modelMatcherConfigured()");
  const call = route.indexOf("messages.stream");
  assert.ok(gate > -1 && gate < call, "the key check must come before the request");
});

test("the page does not claim an assistant the deployment lacks", () => {
  // Derived, like every other honest line on this site.
  const page = readFileSync("app/ask/page.tsx", "utf8");
  assert.match(page, /modelMatcherConfigured\(\)/);
  assert.match(page, /Not configured on this deployment/);
});

test("it is told how to write, not only what it may say", () => {
  // The first answers it gave were true, permitted and unreadable: site jargon,
  // page paths instead of answers, and the same refusal sentence twice in a
  // row. Rules that only police content produce exactly that.
  assert.match(RULES, /Answer in the first sentence/);
  assert.match(RULES, /Speak as yourself/);
  assert.match(RULES, /Explain a term the first time you use it/);
  assert.match(RULES, /Do not answer with page paths/);
  assert.match(RULES, /do not reuse the phrasing of your last refusal/);
});

test("the words it is given are the reader's, not the codebase's", () => {
  // "Compose a book from a premise" sat in the status list, so the assistant
  // learned to call a portfolio a book — the one piece of vocabulary this site
  // deliberately dropped. One list feeds both the page and the assistant, so a
  // leftover there reaches every answer.
  const jargon = CORPUS.split(/(?<=\.)\s+/).filter((s) => /\b(a|the|per|every|your) book\b/i.test(s));
  assert.deepEqual(jargon, [], "the assistant must not be taught the word the site stopped using");
  assert.match(RULES, /Never call it a book/);
});

test("a refusal must answer about the thing the reader named", () => {
  // "I won't tell you whether to buy NVDA — tell me a belief and I'll show you
  // a thesis" is a refusal that answered nothing. The reader named NVDA; the
  // answer has to be about NVDA.
  assert.match(RULES, /A refusal is ONE sentence/);
  assert.match(RULES, /conviction score in every thesis that holds it/);
  assert.match(RULES, /has answered nothing/);
});

test("every answer offers a way out, and the site decides where its pages are", () => {
  // An assistant that cannot recommend anything has to hand the reader
  // somewhere to go, or the refusal is the entire experience. The links are
  // built from the universe in code — the model writes prose and never a URL,
  // so a link on screen cannot be one it invented.
  const chat = readFileSync("components/AskChat.tsx", "utf8");
  assert.match(chat, /\/name\/\$\{n\.toLowerCase\(\)\}/, "a named holding links to its page");
  assert.match(chat, /\/compose\?p=\$\{encodeURIComponent\(thesis\.claim\)\}/, "a named thesis builds one");
  const page = readFileSync("app/ask/page.tsx", "utf8");
  assert.match(page, /UNIVERSE\.map\(\(a\) => a\.t\)/, "the tickers come from the universe");
  assert.match(page, /t !== "NOW"/, "ServiceNow's ticker is also an English word");
});
