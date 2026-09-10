"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { DEFAULT_HORIZON, HORIZONS, horizonLabel, settlesOn, type Horizon } from "@/lib/horizon";

/**
 * Put this premise on the public record.
 *
 * Deliberately a decision, not a side effect of visiting. The date recorded is
 * the server's and cannot be changed afterwards, so this is the one action on
 * the site a person cannot take back — the button says so before they press it,
 * rather than after.
 */
export function CommitPremise({
  premise,
  drop = [],
  weights = "",
  themeHorizon,
}: {
  premise: string;
  /** Holdings the author removed — part of what makes this book theirs. */
  drop?: string[];
  /** Reader-set weights, `NVDA:12,TSM:8`. */
  weights?: string;
  /** The theme's own horizon, e.g. "3–5 years". Shown, never imposed. */
  themeHorizon?: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "confirm" | "sending">("idle");
  const [error, setError] = useState<string | null>(null);
  const [horizon, setHorizon] = useState<Horizon>(DEFAULT_HORIZON);

  // Shown before the button is pressed, because the date is the part that
  // cannot be changed afterwards.
  const settles = settlesOn(new Date().toISOString().slice(0, 10), horizon);

  async function send() {
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ premise, drop, weights, horizon }),
      });
      const body = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !body.id) {
        setError(body.error ?? "The record could not be written.");
        setState("confirm");
        return;
      }
      router.push(`/p/${body.id}`);
    } catch {
      setError("No answer from the server. Nothing was recorded.");
      setState("confirm");
    }
  }

  if (state === "idle") {
    return (
      <button className="b2" type="button" onClick={() => setState("confirm")}>
        Put this on the record
      </button>
    );
  }

  return (
    <div className="cell" style={{ padding: 18, maxWidth: 520 }}>
      <h3 style={{ fontSize: 15 }}>This cannot be undone.</h3>
      <p className="p" style={{ marginTop: 8, fontSize: 13.5 }}>
        The claim, this portfolio&rsquo;s exact weights and today&rsquo;s date go on a public page.
        Anyone can read it, and it stays there whether the portfolio goes on to beat the index or lose
        to it. Nothing about you is stored — no name, no email, no identifier — which is also why
        it cannot be removed later.
      </p>

      <div style={{ marginTop: 16 }}>
        <div className="sl">How long does this claim stand?</div>
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          {HORIZONS.map((h) => (
            <button
              key={h}
              type="button"
              className={h === horizon ? "b1" : "b2"}
              onClick={() => setHorizon(h)}
              aria-pressed={h === horizon}
              disabled={state === "sending"}
            >
              {horizonLabel(h)}
            </button>
          ))}
        </div>
        <p className="p" style={{ marginTop: 10, fontSize: 13 }}>
          {/* A belief with no deadline can never be wrong, only early. This is
              the field that lets a claim be lost. */}
          On <b>{settles}</b> this claim is judged and stops moving: over {horizonLabel(horizon)},
          the portfolio beat the index or it did not.
          {themeHorizon ? (
            <>
              {" "}
              That settles the claim, not the thesis — this theme&rsquo;s own horizon is{" "}
              {themeHorizon}, so anything shorter is a checkpoint rather than a verdict on the idea.
            </>
          ) : null}
        </p>
      </div>
      {error ? (
        <p className="notice warn" style={{ marginTop: 12, fontSize: 13 }}>
          {error}
        </p>
      ) : null}
      <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
        <button className="b1" type="button" onClick={send} disabled={state === "sending"}>
          {state === "sending" ? "Recording…" : "Yes, record it"}
        </button>
        <button
          className="b2"
          type="button"
          onClick={() => {
            setState("idle");
            setError(null);
          }}
          disabled={state === "sending"}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
