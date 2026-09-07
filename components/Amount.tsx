"use client";

import { useState } from "react";

import type { Holding } from "@/lib/types";

/**
 * Weights into money.
 *
 * A book is percentages, and a reader with a number in mind has to do the
 * arithmetic themselves. This does it. It does not route an order and does not
 * pretend to — HANDOFF.md §14 is clear that execution needs a broker and
 * custody, not a front end.
 *
 * The amount is held in component state and nothing else: no storage, no URL,
 * nothing sent anywhere. /legal promises that what you type stays in your
 * browser, and a figure this personal is exactly what that promise is about.
 */
const CURRENCIES = [
  { code: "USD", symbol: "$", step: 1000 },
  { code: "EUR", symbol: "€", step: 1000 },
  { code: "GBP", symbol: "£", step: 1000 },
  { code: "IDR", symbol: "Rp", step: 10_000_000 },
  { code: "SGD", symbol: "S$", step: 1000 },
] as const;

export function Amount({ holdings }: { holdings: Holding[] }) {
  const [raw, setRaw] = useState("");
  const [cur, setCur] = useState<(typeof CURRENCIES)[number]>(CURRENCIES[0]);

  const total = Number(raw.replace(/[^\d.]/g, ""));
  const valid = Number.isFinite(total) && total > 0;

  const fmt = (n: number) =>
    cur.symbol +
    n.toLocaleString("en-US", {
      maximumFractionDigits: n >= 1000 ? 0 : 2,
      minimumFractionDigits: 0,
    });

  return (
    <>
      <div className="amt">
        <input
          type="text"
          inputMode="decimal"
          value={raw}
          placeholder={`Amount, e.g. ${cur.step.toLocaleString("en-US")}`}
          aria-label="Amount to allocate"
          onChange={(e) => setRaw(e.target.value)}
        />
        <select
          value={cur.code}
          aria-label="Currency"
          onChange={(e) => setCur(CURRENCIES.find((c) => c.code === e.target.value) ?? CURRENCIES[0])}
        >
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code}
            </option>
          ))}
        </select>
      </div>

      {valid ? (
        <div style={{ marginTop: 14 }}>
          {holdings.map((h) => (
            <div className="kv" key={h.t}>
              <span className="kv-k">
                {h.t} <span className="faint">{h.pct}%</span>
              </span>
              <span className="kv-v">{fmt((total * h.pct) / 100)}</span>
            </div>
          ))}
          <p className="faint" style={{ fontSize: 11.5, marginTop: 12, lineHeight: 1.5 }}>
            Arithmetic only. Nothing here places an order, and no whole-share rounding,
            fees, spread or tax is applied.
          </p>
        </div>
      ) : (
        <p className="faint" style={{ fontSize: 12, marginTop: 10 }}>
          Enter an amount to see what each weight is worth. It stays in this browser.
        </p>
      )}
    </>
  );
}
