import { NextResponse } from "next/server";

import { cleanKey, marketIsReal, providerName, vendorError } from "@/lib/market";
import { forgetYahooSession, yahooHoldingOff, yahooProbe, type ProbeStep } from "@/lib/market/yahoo";

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

/**
 * The shape of the configured key, never the key. Length and whether it is
 * wrapped in quotes are what separate "wrong key" from "the .env line is wrong"
 * — an FMP key is 32 characters, so 34 with quotes is its own diagnosis — and
 * neither reveals anything usable.
 */
interface KeyShape {
  configured: boolean;
  length: number;
  quotedInEnv: boolean;
  hasInnerWhitespace: boolean;
}

interface Probe {
  at: string;
  provider: string;
  serving: "real" | "generated";
  lastVendorError: string | null;
  /** Set while a refusal is being honoured, rather than argued with. */
  holdingOffUntil: string | null;
  key: KeyShape;
  steps: ProbeStep[];
  note: string;
}

function keyShape(): KeyShape {
  const raw = process.env.MARKET_API_KEY ?? "";
  const clean = cleanKey(raw) ?? "";
  return {
    configured: clean.length > 0,
    length: clean.length,
    quotedInEnv: /^["']|["']$/.test(raw.trim()),
    hasInnerWhitespace: /\s/.test(clean),
  };
}

let cached: { at: number; probe: Probe } | null = null;

export async function GET() {
  if (cached && Date.now() - cached.at < THROTTLE_MS) {
    return NextResponse.json({ ...cached.probe, cached: true });
  }

  const provider = providerName();
  const steps: ProbeStep[] = [];

  // Yahoo is in the chain whenever figures are meant to be real — on its own,
  // or as the fallback behind a key. Probing it only when it is the *named*
  // provider is how this endpoint answered `"steps": []` on the one run that
  // mattered, and left the question open for another round trip.
  if (provider !== "synthetic") {
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
    holdingOffUntil: yahooHoldingOff(),
    key: keyShape(),
    steps,
    note:
      provider === "synthetic"
        ? "Generated figures were asked for explicitly (MARKET_PROVIDER=synthetic)."
        : "Steps are the keyless source. A key, when set, is tried first and is " +
          "described in lastVendorError by name only — it is never included.",
  };

  cached = { at: Date.now(), probe };
  return NextResponse.json(probe);
}
