import { NextResponse } from "next/server";

import { compose } from "@/lib/matcher/compose";
import { modelMatcherConfigured } from "@/lib/matcher/llm";
import { MAX_PREMISE, normalizePremise } from "@/lib/premise";

/**
 * Compose a book from a premise — README build order, step 3.
 *
 * The keyword index answers first and answers free. The model is asked only
 * when the index has already refused, so this endpoint costs nothing on the
 * premises the site has always handled.
 *
 * It is the second endpoint here that can be abused and the first that can be
 * made expensive: every call the keyword matcher does not absorb is a paid
 * request. So it is capped per address, and `lib/matcher/compose.ts` keeps
 * recent answers, because a refusal is exactly the page somebody reloads while
 * they reword their sentence.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Per address, per window. Generous for a person, useless for a script. */
const LIMIT = 20;
const WINDOW_MS = 60 * 60 * 1000;

const seen = new Map<string, number[]>();

function tooMany(ip: string): boolean {
  const now = Date.now();
  const hits = (seen.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  seen.set(ip, hits);
  if (seen.size > 5000) {
    for (const [k, v] of seen) {
      if (!v.some((t) => now - t < WINDOW_MS)) seen.delete(k);
    }
  }
  return hits.length > LIMIT;
}

export async function POST(req: Request) {
  // nginx sets this; the first hop is the reader. Never stored.
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (tooMany(ip)) {
    return NextResponse.json(
      { error: "That is a lot of premises for one hour. Try again later." },
      { status: 429 }
    );
  }

  let premise = "";
  try {
    const body = (await req.json()) as { premise?: unknown };
    premise = typeof body.premise === "string" ? body.premise : "";
  } catch {
    return NextResponse.json({ error: "Send JSON with a premise." }, { status: 400 });
  }

  premise = normalizePremise(premise);
  if (!premise) return NextResponse.json({ error: "No premise." }, { status: 400 });
  if (premise.length > MAX_PREMISE) {
    return NextResponse.json({ error: "Too long. State one belief." }, { status: 400 });
  }

  const { result, via, modelRefused } = await compose(premise);

  if (!result.ok) {
    // A refusal is an answer, not an error. 200 with matched:false is what the
    // build order asked for, and it is what the caller has to be able to read.
    return NextResponse.json({
      matched: false,
      premise: result.premise,
      emptied: result.emptied ?? false,
      modelAsked: modelMatcherConfigured(),
      modelRefused: modelRefused ?? false,
    });
  }

  return NextResponse.json({
    matched: true,
    via,
    premise: result.premise,
    theme: { id: result.theme.id, name: result.theme.name },
    second: result.second ? { id: result.second.id, name: result.second.name } : null,
    risk: result.risk,
    horizon: result.horizon,
    confidence: result.confidence,
    hits: result.hits,
    // Weights come from assemble(), the same function the keyword path uses.
    holdings: result.holdings.map((h) => ({
      ticker: h.t,
      name: h.n,
      kind: h.k,
      pct: h.pct,
      why: h.why,
      source: h.src,
      lead: h.lead ?? false,
      ballast: h.ballast ?? false,
    })),
  });
}
