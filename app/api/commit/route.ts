import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { commit, LedgerError, MAX_PREMISE } from "@/lib/ledger";

/**
 * Put a premise on the public record.
 *
 * The only endpoint on this site that writes anything, so it is the only one
 * that can be abused. Three things guard it: the generator must be able to
 * build a book from the claim, the same claim is never recorded twice, and one
 * address may commit a few times an hour.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Per address, per window. Generous for a person, useless for a script. */
const LIMIT = 5;
const WINDOW_MS = 60 * 60 * 1000;

/**
 * In memory, so it resets when pm2 restarts and does not survive a reboot.
 * That is the right trade here: the cost of a reset is a handful of extra
 * commits, and the alternative is another store to keep and to explain in
 * /legal. Behind nginx there is one process, so one map is the whole picture.
 */
const seen = new Map<string, number[]>();

function tooMany(ip: string): boolean {
  const now = Date.now();
  const hits = (seen.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  seen.set(ip, hits);

  // Bound the map so a flood of addresses cannot grow it without limit.
  if (seen.size > 5000) {
    for (const [k, v] of seen) {
      if (!v.some((t) => now - t < WINDOW_MS)) seen.delete(k);
    }
  }
  return hits.length > LIMIT;
}

export async function POST(req: Request) {
  // nginx sets this; the first hop is the reader. Never trusted for anything
  // but rate limiting, and never stored.
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (tooMany(ip)) {
    return NextResponse.json(
      { error: "That is a lot of claims for one hour. Try again later." },
      { status: 429 }
    );
  }

  let premise = "";
  let drop: string[] = [];
  let weights = "";
  let horizon: number | undefined;
  try {
    const body = (await req.json()) as {
      premise?: unknown;
      drop?: unknown;
      weights?: unknown;
      horizon?: unknown;
    };
    premise = typeof body.premise === "string" ? body.premise : "";
    // A fork is the same belief sized differently, so the book's own shape is
    // part of what gets recorded. Both are re-validated in the ledger; nothing
    // from here is trusted as given.
    drop = Array.isArray(body.drop) ? body.drop.filter((t): t is string => typeof t === "string") : [];
    weights = typeof body.weights === "string" ? body.weights : "";
    // Validated in the ledger against the fixed list, so a hand-edited request
    // cannot write an arbitrary settlement date — nor make a claim open-ended.
    horizon = typeof body.horizon === "number" ? body.horizon : undefined;
  } catch {
    return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  }

  if (premise.length > MAX_PREMISE * 4) {
    // Reject obvious junk before it reaches the generator.
    return NextResponse.json({ error: "Too long. State one belief." }, { status: 400 });
  }

  try {
    const entry = await commit(premise, { drop, weights, horizon });
    // /ledger is prerendered on a five-minute timer. Without this, someone
    // commits a claim, is told it is on the record, follows the link and does
    // not see it — on the one page whose entire purpose is showing that it is.
    revalidatePath("/ledger");
    return NextResponse.json({
      id: entry.id,
      statedAt: entry.statedAt,
      settlesAt: entry.settlesAt,
    });
  } catch (e) {
    if (e instanceof LedgerError) {
      return NextResponse.json({ error: e.message }, { status: 422 });
    }
    // A disk that is full or read-only must not look like a rejected claim.
    console.error("commit failed", e);
    return NextResponse.json({ error: "The record could not be written." }, { status: 500 });
  }
}
