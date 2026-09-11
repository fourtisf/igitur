import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import { matchText } from "../generator";
import { normalizePremise } from "../premise";
import { THEMES, THEME_BY_ID } from "../universe";

/**
 * A model reading the premise — README build order, step 3.
 *
 * ── What this is for ─────────────────────────────────────────────────────────
 *
 * Not to match more. The keyword index already matches everything it should,
 * and the refusal is the product's main differentiator. This exists for the
 * premises that are genuinely carried by a published thesis and that the
 * keyword index cannot see: a sentence about water scarcity written without
 * any of the words in the water theme's list, or written in another language.
 * Those readers are refused today, and they are right and the site is wrong.
 *
 * So it runs ONLY after `buildBook` has already refused. A premise the keyword
 * matcher handles never reaches here and never costs a request.
 *
 * ── The three constraints, and how each is enforced ─────────────────────────
 *
 * "The weighting formula stays in application code so weights stay auditable."
 *   This file returns a theme. It never sees a weight. `assemble()` in
 *   lib/generator.ts does the sizing, the same function the keyword path uses.
 *
 * "The model must be allowed to return matched: false."
 *   `matched` is a required field and the prompt says refusing is the expected
 *   answer for most sentences. A model that matched everything would be worse
 *   than no model at all.
 *
 * "It must not invent tickers."
 *   It cannot: it never names one. It picks an id from a schema enum built out
 *   of the published themes, so an id outside the 26 is not expressible — and
 *   `THEME_BY_ID` checks it again anyway. The holdings come from the universe.
 *
 * One more guard the roadmap did not ask for: the terms it reports as the
 * match are filtered to words that actually occur in the reader's sentence.
 * Those terms are printed on the book page as "what matched"; a model that
 * paraphrased would put a quotation on screen that the reader never wrote.
 */

/** The published ids, as a schema the model answers inside. */
const NONE = "none";
// Built from THEMES rather than written out: a theme added to the universe is
// answerable the same day, and one removed stops being expressible.
const ID_ENUM: [string, ...string[]] = [NONE, ...THEMES.map((t) => t.id)];

const Answer = z.object({
  matched: z.boolean(),
  /** The thesis that carries the claim, or "none". */
  theme: z.enum(ID_ENUM),
  /** A second thesis the claim also touches, or "none". */
  secondary: z.enum(ID_ENUM),
  /** Words from the reader's own sentence that carry the match. */
  terms: z.array(z.string()),
  /** 0-96, as the rest of the site scores confidence. */
  confidence: z.number(),
});

export interface LlmMatch {
  themeId: string;
  secondaryId: string | null;
  terms: string[];
  confidence: number;
}

/**
 * The 26 theses, as the model sees them. Stable across every request, so it
 * caches: the volatile part is one sentence and goes in the user turn.
 */
function system(): string {
  const list = THEMES.map((t) => `${t.id}: ${t.name} — ${t.claim}`).join("\n");
  return [
    "You map one stated belief about the next decade onto a fixed list of investment theses.",
    "",
    "The theses, by id:",
    list,
    "",
    "Rules.",
    "1. Refusing is the expected answer. Most sentences people write are not carried by any",
    "   thesis here, and saying so is correct and useful. Set matched=false and theme=none",
    "   unless a thesis genuinely carries the claim. Do not stretch to find one.",
    "2. A sentence that is not a claim at all — a greeting, a ticker, a question, a direction",
    "   with no reason under it — is matched=false.",
    "3. Pick the thesis the claim is ABOUT, not one it merely mentions in passing.",
    "4. secondary is for a claim that genuinely spans two theses. Otherwise secondary=none.",
    "5. terms must be words copied from the reader's sentence, exactly as they wrote them.",
    "   Never paraphrase and never invent a term; return an empty list rather than guess.",
    "6. confidence is 0-96. Use under 50 when the match is arguable.",
    "7. Answer in any language the reader writes in; the ids are always English.",
  ].join("\n");
}

/** Off unless a key is configured, exactly like the market vendor layer. */
export function modelMatcherConfigured(): boolean {
  return Boolean((process.env.ANTHROPIC_API_KEY ?? "").trim());
}

let client: Anthropic | null = null;

/**
 * Ask the model. Returns null for "no answer" — no key, an error, a timeout —
 * which the caller must treat as the keyword matcher's refusal standing, never
 * as a match. Returns `{ matched: false }` when the model itself refused.
 */
export async function matchWithModel(
  raw: string,
  signal?: AbortSignal
): Promise<LlmMatch | { matched: false } | null> {
  if (!modelMatcherConfigured()) return null;
  const premise = normalizePremise(raw);
  if (premise.length < 3) return null;

  client ??= new Anthropic();

  let parsed: z.infer<typeof Answer> | null | undefined;
  try {
    const res = await client.messages.parse(
      {
        model: "claude-opus-5",
        // A classification. Effort low is the documented setting for this
        // shape of work, and thinking is on by default on this model.
        max_tokens: 2048,
        output_config: { effort: "low", format: zodOutputFormat(Answer) },
        system: [{ type: "text", text: system(), cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: premise }],
      },
      { signal }
    );
    parsed = res.parsed_output;
  } catch {
    // A vendor that will not answer is not a match. The refusal stands.
    return null;
  }
  if (!parsed) return null;

  if (!parsed.matched || parsed.theme === NONE) return { matched: false };

  // The enum makes an invented id unexpressible. This checks anyway: the book
  // is built from whatever comes back, and a miss here would be a 500 on a
  // reader's page rather than a refusal.
  const primary = THEME_BY_ID.get(parsed.theme);
  if (!primary) return { matched: false };

  const second =
    parsed.secondary !== NONE && parsed.secondary !== parsed.theme
      ? (THEME_BY_ID.get(parsed.secondary)?.id ?? null)
      : null;

  return {
    themeId: primary.id,
    secondaryId: second,
    terms: ownWords(premise, parsed.terms),
    confidence: Math.max(0, Math.min(96, Math.round(parsed.confidence))),
  };
}

/**
 * The terms, reduced to those the reader actually wrote.
 *
 * The book page prints these under "matched N terms" — it is a quotation of
 * the reader's own sentence. A paraphrase there would be the site putting
 * words in their mouth, which is a small lie in the one place this product
 * cannot afford one.
 */
function ownWords(premise: string, terms: string[]): string[] {
  const haystack = matchText(premise);
  const out: string[] = [];
  for (const t of terms) {
    const term = String(t ?? "").trim().toLowerCase();
    if (!term || term.length > 60) continue;
    if (!haystack.includes(term)) continue;
    if (!out.includes(term)) out.push(term);
    if (out.length >= 6) break;
  }
  return out;
}
