import { assemble, buildBook } from "../generator";
import { normalizePremise } from "../premise";
import type { BookResult } from "../types";
import { THEME_BY_ID } from "../universe";
import { matchWithModel, modelMatcherConfigured } from "./llm";

/**
 * One premise, two matchers, in the only order that is defensible.
 *
 * The keyword index runs first and always. When it produces a book, nothing
 * else happens: no request, no cost, no latency, and the book is byte-for-byte
 * the one a shared link has always rebuilt.
 *
 * The model runs only on a refusal, because that is the only place it can help.
 * A premise the keyword list already reads correctly gains nothing from a
 * second opinion, and a second opinion that could overturn a working match
 * would make the same URL mean different things on different days.
 *
 * So this never widens what matches by accident. It widens it in exactly one
 * direction: sentences a published thesis genuinely carries, written in words
 * the list does not hold — including words in another language.
 *
 * `via` is carried out to the page so the reader can be told which one
 * answered. A book the model found is not the same kind of object as one the
 * published keyword list found, and saying so is the same rule as flagging a
 * generated price.
 */
export type Via = "keywords" | "model";

export interface Composed {
  result: BookResult;
  via: Via;
  /** True when the model was asked and declined, rather than not asked. */
  modelRefused?: boolean;
}

/**
 * Answers, kept for a while.
 *
 * Every render of a refused URL would otherwise be a paid request, and a
 * refusal is exactly the page people reload while they edit their sentence.
 * In memory on purpose: a wrong answer should not outlive a deploy, and the
 * volume here is a handful of sentences, not a universe of prices.
 */
const TTL_MS = 6 * 60 * 60_000;
const MAX = 500;
const cache = new Map<string, { at: number; answer: Awaited<ReturnType<typeof matchWithModel>> }>();

/** How long a reader waits before the refusal simply stands. */
const TIMEOUT_MS = 12_000;

export async function compose(raw: string, drop: string[] = []): Promise<Composed> {
  const premise = normalizePremise(raw);
  const keyword = buildBook(premise, drop);

  // A match is a match. The model is not consulted, and cannot overturn it.
  if (keyword.ok) return { result: keyword, via: "keywords" };
  // Emptied is not a matching failure — the reader removed every holding.
  if (keyword.emptied) return { result: keyword, via: "keywords" };
  if (!modelMatcherConfigured()) return { result: keyword, via: "keywords" };

  const key = premise.toLowerCase();
  const now = Date.now();
  const hit = cache.get(key);
  let answer: Awaited<ReturnType<typeof matchWithModel>>;

  if (hit && now - hit.at < TTL_MS) {
    answer = hit.answer;
  } else {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    try {
      answer = await matchWithModel(premise, ctl.signal);
    } finally {
      clearTimeout(timer);
    }
    // A null is "no answer" — no key, an error, a timeout. Not cached: the
    // next reader should get a working matcher, not a remembered outage.
    if (answer !== null) {
      if (cache.size >= MAX) {
        const oldest = [...cache].sort((a, b) => a[1].at - b[1].at)[0];
        if (oldest) cache.delete(oldest[0]);
      }
      cache.set(key, { at: now, answer });
    }
  }

  if (!answer) return { result: keyword, via: "keywords" };
  if ("matched" in answer) return { result: keyword, via: "keywords", modelRefused: true };

  const primary = THEME_BY_ID.get(answer.themeId);
  if (!primary) return { result: keyword, via: "keywords", modelRefused: true };
  const secondary = answer.secondaryId ? (THEME_BY_ID.get(answer.secondaryId) ?? null) : null;

  // The same weighting the keyword path reaches, from the same function. The
  // model chose a thesis; it did not size anything.
  const result = assemble(premise, drop, {
    primary,
    secondary: secondary && secondary.id !== primary.id ? secondary : null,
    hits: answer.terms,
    confidence: answer.confidence,
    // The model was asked for one thesis, not a ranking. Reporting an empty
    // list is true; inventing runners-up to fill the panel would not be.
    alternatives: [],
  });

  return { result, via: "model" };
}

/** Exported for tests: the cache outlives a single case otherwise. */
export function forgetComposeCache(): void {
  cache.clear();
}
