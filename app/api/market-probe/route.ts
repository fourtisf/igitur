import { NextResponse } from "next/server";

import { marketIsReal, providerName, vendorError } from "@/lib/market";
import { forgetYahooSession, yahooProbe, type ProbeStep } from "@/lib/market/yahoo";

/**
 * Why the market data is, or is not, real — from the server's own point of view.
 *
 * /status already says whether figures are live and prints the last vendor
 * error, but "the source is not answering" is a symptom, not a reason. When
 * this site sat on generated prices while `curl` from the same machine got real
 * JSON back on the first try, nothing on the site could tell the two apart, and
 * finding out took shell access. That is a bad property for a site whose whole
 * claim is that you can check it.
 *
 * So this walks the vendor's actual sequence, uncached, and reports what each
 * step returned.
 *
 * ── Why this is safe to leave open ───────────────────────────────────────────
 *
 * It takes no input, so nobody can steer it at a third party. It reports status
 * codes and a price, never a key: the FMP path is described by name only,
 * because that vendor's key travels in the query string. And it is throttled to
 * one real probe a minute — without that, an open endpoint that makes the
 * server call a vendor is a way to spend someone else's rate limit.
 */
export const dynamic = "force-dynamic";

const THROTTLE_MS = 60_000;

interface Probe {
  at: string;
  provider: string;
  serving: "real" | "generated";
  lastVendorError: string | null;
  steps: ProbeStep[];
  note: string;
}

let cached: { at: number; probe: Probe } | null = null;

export async function GET() {
  if (cached && Date.now() - cached.at < THROTTLE_MS) {
    return NextResponse.json({ ...cached.probe, cached: true });
  }

  const provider = providerName();
  const steps: ProbeStep[] = [];

  if (provider === "yahoo") {
    // A probe that reads a warm session cannot tell you whether a cold render
    // would have got one.
    forgetYahooSession();
    steps.push(...(await yahooProbe()));
  }

  const probe: Probe = {
    at: new Date().toISOString(),
    provider,
    serving: (await marketIsReal()) ? "real" : "generated",
    lastVendorError: vendorError(),
    steps,
    note:
      provider === "yahoo"
        ? "Each step is one request Yahoo answered. A 200 with ok:false means it answered with something other than a price."
        : `No step-by-step probe for ${provider}; lastVendorError names the failure. The key is never included.`,
  };

  cached = { at: Date.now(), probe };
  return NextResponse.json(probe);
}
