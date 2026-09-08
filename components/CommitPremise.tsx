"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Put this premise on the public record.
 *
 * Deliberately a decision, not a side effect of visiting. The date recorded is
 * the server's and cannot be changed afterwards, so this is the one action on
 * the site a person cannot take back — the button says so before they press it,
 * rather than after.
 */
export function CommitPremise({ premise }: { premise: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "confirm" | "sending">("idle");
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ premise }),
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
        The claim and today&rsquo;s date go on a public page. Anyone can read it, and it stays there
        whether the book goes on to beat the index or lose to it. Nothing about you is stored — no
        name, no email, no identifier — which is also why it cannot be removed later.
      </p>
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
